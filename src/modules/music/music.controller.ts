import type { Request, Response } from "express";
import { prisma } from "../../core/db.js";
import { AppError } from "../../core/errors.js";
import {
  ChartPeriod,
  CreditRole,
  Prisma,
} from "../../generated/prisma/client.js";
import { recordPlay } from "./music.service.js";
import type { RecordPlayInput } from "./music.schema.js";

const periods = new Set<string>(Object.values(ChartPeriod));

const formatMovement = (rank: number, previousRank: number | null) => ({
  direction:
    previousRank === null
      ? "new"
      : previousRank > rank
        ? "up"
        : previousRank < rank
          ? "down"
          : "same",
  change: previousRank === null ? null : Math.abs(previousRank - rank),
});

const getLatestSnapshot = (
  chartSlug: string,
  period: ChartPeriod,
  skip = 0,
  take = 10,
) =>
  prisma.chartSnapshot.findFirst({
    where: { period, chart: { slug: chartSlug, isActive: true } },
    orderBy: { periodStart: "desc" },
    include: {
      chart: { include: { genre: true } },
      _count: { select: { entries: true } },
      entries: {
        orderBy: { rank: "asc" },
        skip,
        take,
        include: {
          artist: true,
          track: {
            include: {
              credits: {
                where: {
                  role: {
                    in: [CreditRole.PRIMARY_ARTIST, CreditRole.FEATURED_ARTIST],
                  },
                },
                orderBy: { position: "asc" },
                include: { artist: true },
              },
              _count: { select: { favorites: true } },
            },
          },
        },
      },
    },
  });

export const getMusicDashboard = async (req: Request, res: Response) => {
  const requestedPeriod = String(
    req.query.period || ChartPeriod.DAILY,
  ).toUpperCase();
  const requestedPage = Number(req.query.page ?? 1);
  const requestedLimit = Number(req.query.limit ?? 10);

  if (!periods.has(requestedPeriod)) {
    throw new AppError(400, "period must be DAILY, WEEKLY, or MONTHLY");
  }

  if (!Number.isInteger(requestedPage) || requestedPage < 1) {
    throw new AppError(400, "page must be a positive integer");
  }

  if (
    !Number.isInteger(requestedLimit) ||
    requestedLimit < 1 ||
    requestedLimit > 50
  ) {
    throw new AppError(400, "limit must be an integer between 1 and 50");
  }

  const period = requestedPeriod as ChartPeriod;
  const page = requestedPage;
  const limit = requestedLimit;
  const skip = (page - 1) * limit;
  const [artistChart, composerChart, trendingChart] = await Promise.all([
    getLatestSnapshot("top-artists-pop", period),
    getLatestSnapshot("top-composers-pop", period),
    getLatestSnapshot("hot-trending-pop", period, skip, limit),
  ]);

  const trendingEntries =
    trendingChart?.entries.filter((entry) => entry.track) ?? [];
  const userId = res.locals.userId as string | undefined;
  const favoriteTrackIds = userId
    ? new Set(
        (
          await prisma.favoriteTrack.findMany({
            where: {
              userId,
              trackId: { in: trendingEntries.map((entry) => entry.trackId!) },
            },
            select: { trackId: true },
          })
        ).map((favorite) => favorite.trackId),
      )
    : new Set<string>();

  const mapPeopleChart = (snapshot: typeof artistChart) =>
    snapshot?.entries
      .filter((entry) => entry.artist)
      .map((entry) => ({
        rank: entry.rank,
        previousRank: entry.previousRank,
        peakRank: entry.peakRank,
        periodsOnChart: entry.periodsOnChart,
        movement: formatMovement(entry.rank, entry.previousRank),
        artist: {
          id: entry.artist!.id,
          name: entry.artist!.name,
          slug: entry.artist!.slug,
          avatarUrl: entry.artist!.avatarUrl,
        },
      })) ?? [];

  return res.status(200).json({
    genre: trendingChart?.chart.genre ?? { name: "Pop", slug: "pop" },
    period,
    artists: mapPeopleChart(artistChart),
    composers: mapPeopleChart(composerChart),
    trending: trendingEntries.map((entry) => ({
      rank: entry.rank,
      previousRank: entry.previousRank,
      peakRank: entry.peakRank,
      periodsOnChart: entry.periodsOnChart,
      movement: formatMovement(entry.rank, entry.previousRank),
      track: {
        id: entry.track!.id,
        title: entry.track!.title,
        slug: entry.track!.slug,
        durationMs: entry.track!.durationMs,
        coverUrl: entry.track!.coverUrl,
        audioUrl: entry.track!.audioUrl,
        artists: entry.track!.credits.map((credit) => ({
          id: credit.artist.id,
          name: credit.artist.name,
        })),
        favoriteCount: entry.track!._count.favorites,
        isFavorite: favoriteTrackIds.has(entry.track!.id),
      },
    })),
    pagination: {
      page,
      limit,
      total: trendingChart?._count.entries ?? 0,
      totalPages: Math.ceil((trendingChart?._count.entries ?? 0) / limit),
    },
  });
};

export const addFavoriteTrack = async (req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const trackId =
    typeof req.params.trackId === "string" ? req.params.trackId : undefined;

  if (!trackId) throw new AppError(400, "trackId is required");

  const track = await prisma.track.findUnique({ where: { id: trackId } });

  if (!track) throw new AppError(404, "Track not found");

  await prisma.favoriteTrack.upsert({
    where: { userId_trackId: { userId, trackId } },
    update: {},
    create: { userId, trackId },
  });

  return res.status(201).json({ message: "Track added to favorites" });
};

export const removeFavoriteTrack = async (req: Request, res: Response) => {
  const trackId =
    typeof req.params.trackId === "string" ? req.params.trackId : undefined;

  if (!trackId) throw new AppError(400, "trackId is required");

  await prisma.favoriteTrack.deleteMany({
    where: {
      userId: res.locals.userId as string,
      trackId,
    },
  });

  return res.status(200).json({ message: "Track removed from favorites" });
};

const isRecordNotFound = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2025"; // Record not found

export const recordTrackPlay = async (req: Request, res: Response) => {
  const userId = (res.locals.userId as string | undefined) ?? null;

  const trackId =
    typeof req.params.trackId === "string" ? req.params.trackId : undefined;

  if (!trackId) throw new AppError(400, "trackId is required");

  try {
    const play = await recordPlay(userId, trackId, req.body as RecordPlayInput);

    return res.status(201).json(play);
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new AppError(404, "Track not found");
    }
    throw error;
  }
};
