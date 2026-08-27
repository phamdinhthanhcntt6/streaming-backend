import type { Request, Response } from "express";
import { cloudinary, isCloudinaryConfigured } from "../../core/cloudinary.js";
import { prisma } from "../../core/db.js";
import { env } from "../../core/env.js";
import { AppError } from "../../core/errors.js";

const getCloudinaryUrl = (cloudName: string, path: string) =>
  `https://res.cloudinary.com/${cloudName}${path.startsWith("/") ? path : `/${path}`}`;

const getFolder = (req: Request) =>
  typeof req.query.folder === "string" ? req.query.folder.trim() : "";

export const getImages = async (_req: Request, res: Response) => {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const folder = getFolder(_req);

  if (!cloudName) {
    throw new AppError(500, "Cloudinary is not configured");
  }

  if (!folder) {
    throw new AppError(400, "folder is required");
  }

  const images = await prisma.image.findMany({
    where: { folder },
    orderBy: { path: "asc" },
  });

  return res.status(200).json({
    images: images.map((image) => ({
      ...image,
      url: getCloudinaryUrl(cloudName, image.path),
    })),
  });
};

export const syncImages = async (req: Request, res: Response) => {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const folder = getFolder(req);

  if (!cloudName || !isCloudinaryConfigured) {
    throw new AppError(500, "Cloudinary is not configured");
  }

  if (!folder) {
    throw new AppError(400, "folder is required");
  }

  let imagePaths: string[];
  try {
    const result = await cloudinary.api.resources_by_asset_folder(folder, {
      max_results: 500,
    });
    const cloudPathPrefix = `/${cloudName}`;
    imagePaths = result.resources
      .filter((resource) => resource.resource_type === "image")
      .map((resource) => {
        const url = new URL(resource.secure_url);

        if (
          url.hostname !== "res.cloudinary.com" ||
          !url.pathname.startsWith(`${cloudPathPrefix}/`)
        ) {
          throw new Error("Unexpected Cloudinary delivery URL");
        }

        return url.pathname.slice(cloudPathPrefix.length);
      });
  } catch (error) {
    throw new AppError(502, "Unable to sync Cloudinary images", {
      cause: error,
    });
  }

  const images = await Promise.all(
    imagePaths.map((path) =>
      prisma.image.upsert({
        where: { path },
        update: { folder },
        create: { path, folder },
      }),
    ),
  );

  return res.status(200).json({ folder, synced: images.length, images });
};
