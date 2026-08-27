import type { Request, Response } from "express";
import { prisma } from "../../core/db.js";
import { AppError } from "../../core/errors.js";
import {
  ChartPeriod,
  CreditRole,
} from "../../generated/prisma/client.js";

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

const getLatestSnapshot = (chartSlug: string, period: ChartPeriod) =>
  prisma.chartSnapshot.findFirst({
    where: { period, chart: { slug: chartSlug, isActive: true } },
    orderBy: { periodStart: "desc" },
    include: {
      chart: { include: { genre: true } },
      entries: {
        orderBy: { rank: "asc" },
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
  const requestedPeriod = String(req.query.period || ChartPeriod.DAILY).toUpperCase();

  if (!periods.has(requestedPeriod)) {
    throw new AppError(400, "period must be DAILY, WEEKLY, or MONTHLY");
  }

  const period = requestedPeriod as ChartPeriod;
  const [artistChart, composerChart, trendingChart] = await Promise.all([
    getLatestSnapshot("top-artists-pop", period),
    getLatestSnapshot("top-composers-pop", period),
    getLatestSnapshot("hot-trending-pop", period),
  ]);

  const trendingEntries = trendingChart?.entries.filter((entry) => entry.track) ?? [];
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
  });
};

export const addFavoriteTrack = async (req: Request, res: Response) => {
  const userId = res.locals.userId as string;
  const trackId = typeof req.params.trackId === "string" ? req.params.trackId : undefined;

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
  const trackId = typeof req.params.trackId === "string" ? req.params.trackId : undefined;

  if (!trackId) throw new AppError(400, "trackId is required");

  await prisma.favoriteTrack.deleteMany({
    where: {
      userId: res.locals.userId as string,
      trackId,
    },
  });

  return res.status(200).json({ message: "Track removed from favorites" });
};
