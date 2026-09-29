import type { Request, Response } from "express";
import { prisma } from "../../core/db.js";
import { AppError } from "../../core/errors.js";
import { uniqueArtistSlug } from "../../core/slug.js";
import { Prisma, VerificationStatus } from "../../generated/prisma/client.js";
import {
  listVerificationRequestsSchema,
  type CreateVerificationRequestInput,
  type ReviewVerificationRequestInput,
} from "./verification.schema.js";

const requestSelect = {
  id: true,
  artistName: true,
  links: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
  targetArtist: { select: { id: true, slug: true, name: true } },
} satisfies Prisma.ArtistVerificationRequestSelect;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

export const createVerificationRequest = async (
  req: Request,
  res: Response,
) => {
  const userId = res.locals.userId as string;
  const { artistName, links } = req.body as CreateVerificationRequestInput;

  const ownedArtist = await prisma.artist.findUnique({
    where: { userId },
    select: { name: true },
  });

  if (ownedArtist) {
    throw new AppError(409, `This account already manages ${ownedArtist.name}`);
  }

  // Pre-match the typed name against the catalog so the reviewer can see
  // whether approving means claiming an existing artist or creating one.
  const match = await prisma.artist.findFirst({
    where: { name: { equals: artistName, mode: "insensitive" }, userId: null },
    select: { id: true },
  });

  try {
    const request = await prisma.artistVerificationRequest.create({
      data: { userId, artistName, links, targetArtistId: match?.id ?? null },
      select: requestSelect,
    });

    return res.status(201).json({ request });
  } catch (error) {
    // The partial unique index is what actually enforces one pending request
    // per user, including against two requests sent at the same moment.
    if (isUniqueViolation(error)) {
      throw new AppError(409, "You already have a request under review");
    }

    throw error;
  }
};

export const getMyVerificationRequest = async (
  _req: Request,
  res: Response,
) => {
  const request = await prisma.artistVerificationRequest.findFirst({
    where: { userId: res.locals.userId as string },
    orderBy: { createdAt: "desc" },
    select: requestSelect,
  });

  return res.status(200).json({ request });
};

export const cancelMyVerificationRequest = async (
  _req: Request,
  res: Response,
) => {
  const { count } = await prisma.artistVerificationRequest.updateMany({
    where: {
      userId: res.locals.userId as string,
      status: VerificationStatus.PENDING,
    },
    data: { status: VerificationStatus.CANCELLED },
  });

  if (count === 0) {
    throw new AppError(404, "You have no request under review");
  }

  return res.status(200).json({ message: "Verification request cancelled" });
};

export const listVerificationRequests = async (req: Request, res: Response) => {
  const parsed = listVerificationRequestsSchema.safeParse(req.query);

  if (!parsed.success) {
    throw new AppError(400, "Invalid query parameters");
  }

  const { status, page, pageSize } = parsed.data;
  const where = status ? { status } : {};

  const [total, requests] = await Promise.all([
    prisma.artistVerificationRequest.count({ where }),
    prisma.artistVerificationRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        ...requestSelect,
        user: { select: { id: true, email: true, displayName: true } },
      },
    }),
  ]);

  return res.status(200).json({
    requests,
    pagination: { page, pageSize, total },
  });
};

export const reviewVerificationRequest = async (
  req: Request,
  res: Response,
) => {
  const reviewerId = res.locals.userId as string;
  const requestId =
    typeof req.params.id === "string" ? req.params.id : undefined;
  const { action, note, targetArtistId } =
    req.body as ReviewVerificationRequestInput;

  if (!requestId) throw new AppError(400, "Request id is required");

  const request = await prisma.artistVerificationRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      userId: true,
      artistName: true,
      status: true,
      targetArtistId: true,
    },
  });

  if (!request) throw new AppError(404, "Verification request not found");

  if (request.status !== VerificationStatus.PENDING) {
    throw new AppError(
      409,
      `This request was already ${request.status.toLowerCase()}`,
    );
  }

  const reviewedAt = new Date();

  if (action === "REJECT") {
    const rejected = await prisma.artistVerificationRequest.update({
      where: { id: requestId },
      data: {
        status: VerificationStatus.REJECTED,
        reviewedById: reviewerId,
        reviewedAt,
        reviewNote: note ?? null,
      },
      select: requestSelect,
    });

    return res.status(200).json({ request: rejected });
  }

  // Leaving targetArtistId out keeps the match made at submission time; passing
  // null explicitly tells us to create a new artist instead.
  const artistId =
    targetArtistId === undefined ? request.targetArtistId : targetArtistId;

  // Postgres aborts the entire transaction as soon as one statement fails, so
  // conflicts are checked up front rather than caught inside the transaction.
  // The unique constraints are still the real guarantee: these checks only
  // exist to return a readable error instead of a raw P2002.
  const ownedArtist = await prisma.artist.findUnique({
    where: { userId: request.userId },
    select: { name: true },
  });

  if (ownedArtist) {
    throw new AppError(409, `This account already manages ${ownedArtist.name}`);
  }

  if (artistId) {
    const target = await prisma.artist.findUnique({
      where: { id: artistId },
      select: { name: true, userId: true },
    });

    if (!target) {
      throw new AppError(
        404,
        "The artist this request points to no longer exists",
      );
    }

    if (target.userId) {
      throw new AppError(
        409,
        `${target.name} is already managed by another account`,
      );
    }
  }

  try {
    const approved = await prisma.$transaction(async (tx) => {
      const artist = artistId
        ? await tx.artist.update({
            where: { id: artistId },
            data: {
              userId: request.userId,
              claimedAt: reviewedAt,
              isVerified: true,
            },
            select: { id: true },
          })
        : await tx.artist.create({
            data: {
              name: request.artistName,
              slug: await uniqueArtistSlug(tx, request.artistName),
              userId: request.userId,
              claimedAt: reviewedAt,
              isVerified: true,
            },
            select: { id: true },
          });

      return tx.artistVerificationRequest.update({
        where: { id: requestId },
        data: {
          status: VerificationStatus.APPROVED,
          reviewedById: reviewerId,
          reviewedAt,
          reviewNote: note ?? null,
          targetArtistId: artist.id,
        },
        select: requestSelect,
      });
    });

    return res.status(200).json({ request: approved });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        409,
        "This artist was claimed by someone else just now",
      );
    }

    throw error;
  }
};
