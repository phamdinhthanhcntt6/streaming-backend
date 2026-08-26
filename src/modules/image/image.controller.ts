import type { Request, Response } from "express";
import { cloudinary, isCloudinaryConfigured } from "../../core/cloudinary.js";
import { prisma } from "../../core/db.js";
import { env } from "../../core/env.js";

const getCloudinaryUrl = (cloudName: string, path: string) =>
  `https://res.cloudinary.com/${cloudName}${path.startsWith("/") ? path : `/${path}`}`;

const getFolder = (req: Request) =>
  typeof req.query.folder === "string" ? req.query.folder.trim() : "";

export const getImages = async (_req: Request, res: Response) => {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const folder = getFolder(_req);

  if (!cloudName) {
    return res.status(500).json({ message: "Cloudinary is not configured" });
  }

  if (!folder) {
    return res.status(400).json({ message: "folder is required" });
  }

  try {
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
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to load images" });
  }
};

export const syncImages = async (req: Request, res: Response) => {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const folder = getFolder(req);

  if (!cloudName || !isCloudinaryConfigured) {
    return res.status(500).json({ message: "Cloudinary is not configured" });
  }

  if (!folder) {
    return res.status(400).json({ message: "folder is required" });
  }

  try {
    const result = await cloudinary.api.resources_by_asset_folder(folder, {
      max_results: 500,
    });
    const cloudPathPrefix = `/${cloudName}`;
    const imagePaths = result.resources
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
  } catch (error) {
    console.error(
      "Cloudinary image sync failed:",
      error instanceof Error ? error.message : "Cloudinary request failed",
    );
    return res.status(502).json({ message: "Unable to sync Cloudinary images" });
  }
};
