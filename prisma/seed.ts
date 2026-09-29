import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  ChartPeriod,
  ChartSubject,
  CreditRole,
  PrismaClient,
  Role,
  TrackStatus,
} from "../src/generated/prisma/client.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const artists = [
  "Ariana Grande",
  "The Weeknd",
  "Shawn Mendes",
  "Ed Sheeran",
  "Selena Gomez",
  "Rihanna",
  "Sam Smith",
  "Hailee Steinfeld",
  "Rosé",
  "Sơn Tùng M-TP",
  "Astrud Gilberto",
  "Maroon 5",
  "Arcade Fire",
  "Japan",
  "David Sylvian",
  "Donna Summer",
] as const;

const artistSlugByName = new Map<string, string>([
  ["Ariana Grande", "ariana-grande"],
  ["The Weeknd", "the-weeknd"],
  ["Shawn Mendes", "shawn-mendes"],
  ["Ed Sheeran", "ed-sheeran"],
  ["Selena Gomez", "selena-gomez"],
  ["Rihanna", "rihanna"],
  ["Sam Smith", "sam-smith"],
  ["Hailee Steinfeld", "hailee-steinfeld"],
  ["Rosé", "rose"],
  ["Sơn Tùng M-TP", "son-tung-mtp"],
  ["Astrud Gilberto", "astrud-gilberto"],
  ["Maroon 5", "maroon-5"],
  ["Arcade Fire", "arcade-fire"],
  ["Japan", "japan"],
  ["David Sylvian", "david-sylvian"],
  ["Donna Summer", "donna-summer"],
]);

const tracks = [
  {
    title: "Run now",
    slug: "run-now",
    durationMs: 70_000,
    artists: ["Sơn Tùng M-TP"],
    composers: ["Sơn Tùng M-TP"],
  },
  {
    title: "Every Apple You Take",
    slug: "every-apple-you-take",
    durationMs: 190_000,
    artists: ["Astrud Gilberto"],
    composers: ["Ariana Grande"],
  },
  {
    title: "The Apple Where Your Heart Should Be",
    slug: "the-apple-where-your-heart-should-be",
    durationMs: 130_000,
    artists: ["Maroon 5"],
    composers: ["The Weeknd"],
  },
  {
    title: "Your Slippery Heart",
    slug: "your-slippery-heart",
    durationMs: 118_000,
    artists: ["Arcade Fire"],
    composers: ["Shawn Mendes"],
  },
  {
    title: "Like a Slippery Map",
    slug: "like-a-slippery-map",
    durationMs: 114_000,
    artists: ["Japan", "David Sylvian"],
    composers: ["Ed Sheeran"],
  },
  {
    title: "First chance",
    slug: "first-chance",
    durationMs: 42_000,
    artists: ["Donna Summer"],
    composers: ["Selena Gomez"],
  },
  {
    title: "There’s no one at all",
    slug: "theres-no-one-at-all",
    durationMs: 120_000,
    artists: ["Sơn Tùng M-TP"],
    composers: ["Rihanna"],
  },
  {
    title: "Midnight Echo",
    slug: "midnight-echo",
    durationMs: 176_000,
    artists: ["The Weeknd"],
    composers: ["Sam Smith"],
  },
  {
    title: "Neon Skyline",
    slug: "neon-skyline",
    durationMs: 204_000,
    artists: ["Hailee Steinfeld"],
    composers: ["Ariana Grande"],
  },
  {
    title: "Afterglow Dreams",
    slug: "afterglow-dreams",
    durationMs: 188_000,
    artists: ["Rosé"],
    composers: ["Ed Sheeran"],
  },
] as const;

const rankingArtists = artists.slice(0, 10);

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfPeriod(start: Date, period: ChartPeriod) {
  const end = new Date(start);

  if (period === ChartPeriod.DAILY) end.setDate(end.getDate() + 1);
  if (period === ChartPeriod.WEEKLY) end.setDate(end.getDate() + 7);
  if (period === ChartPeriod.MONTHLY) end.setMonth(end.getMonth() + 1);

  end.setMilliseconds(end.getMilliseconds() - 1);
  return end;
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();

  if (adminEmail) {
    const admin = await prisma.user.updateMany({
      where: { email: adminEmail },
      data: { role: Role.ADMIN },
    });

    console.log(
      admin.count > 0
        ? `Promoted ${adminEmail} to ADMIN.`
        : `ADMIN_EMAIL ${adminEmail} has no account yet; register first, then re-run the seed.`,
    );
  }

  await prisma.image.upsert({
    where: { path: "/image/upload/v1787154675/banner.png" },
    update: { folder: "banners" },
    create: {
      path: "/image/upload/v1787154675/banner.png",
      folder: "banners",
    },
  });

  const pop = await prisma.genre.upsert({
    where: { slug: "pop" },
    update: { name: "Pop" },
    create: { name: "Pop", slug: "pop" },
  });

  const artistIds = new Map<string, string>();

  for (const name of artists) {
    const slug = artistSlugByName.get(name);
    if (!slug) throw new Error(`Missing slug for artist: ${name}`);

    const artist = await prisma.artist.upsert({
      where: { slug },
      update: { name },
      create: {
        name,
        slug,
        avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`,
        isVerified: true,
      },
    });

    artistIds.set(name, artist.id);
  }

  const trackIds = new Map<string, string>();

  for (const [trackIndex, item] of tracks.entries()) {
    const track = await prisma.track.upsert({
      where: { slug: item.slug },
      update: {
        title: item.title,
        durationMs: item.durationMs,
        status: TrackStatus.PUBLISHED,
      },
      create: {
        title: item.title,
        slug: item.slug,
        durationMs: item.durationMs,
        audioUrl: `/media/demo/${item.slug}.mp3`,
        coverUrl: `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(item.slug)}`,
        releaseDate: new Date(2026, 6, trackIndex + 1),
        status: TrackStatus.PUBLISHED,
        playCount: (tracks.length - trackIndex) * 12_500,
      },
    });

    trackIds.set(item.slug, track.id);

    await prisma.trackGenre.upsert({
      where: { trackId_genreId: { trackId: track.id, genreId: pop.id } },
      update: {},
      create: { trackId: track.id, genreId: pop.id },
    });

    for (const [position, artistName] of item.artists.entries()) {
      const artistId = artistIds.get(artistName);
      if (!artistId) throw new Error(`Missing artist: ${artistName}`);

      await prisma.trackCredit.upsert({
        where: {
          trackId_artistId_role: {
            trackId: track.id,
            artistId,
            role:
              position === 0
                ? CreditRole.PRIMARY_ARTIST
                : CreditRole.FEATURED_ARTIST,
          },
        },
        update: { position },
        create: {
          trackId: track.id,
          artistId,
          role:
            position === 0
              ? CreditRole.PRIMARY_ARTIST
              : CreditRole.FEATURED_ARTIST,
          position,
        },
      });
    }

    for (const [position, composerName] of item.composers.entries()) {
      const artistId = artistIds.get(composerName);
      if (!artistId) throw new Error(`Missing composer: ${composerName}`);

      await prisma.trackCredit.upsert({
        where: {
          trackId_artistId_role: {
            trackId: track.id,
            artistId,
            role: CreditRole.COMPOSER,
          },
        },
        update: { position },
        create: {
          trackId: track.id,
          artistId,
          role: CreditRole.COMPOSER,
          position,
        },
      });
    }
  }

  const chartDefinitions = [
    {
      name: "Top Artists",
      slug: "top-artists-pop",
      subject: ChartSubject.ARTIST,
    },
    {
      name: "Top Composers",
      slug: "top-composers-pop",
      subject: ChartSubject.COMPOSER,
    },
    {
      name: "Hot Trending",
      slug: "hot-trending-pop",
      subject: ChartSubject.TRACK,
    },
  ] as const;

  const now = new Date();
  const periods = [
    { period: ChartPeriod.DAILY, start: startOfDay(now) },
    { period: ChartPeriod.WEEKLY, start: startOfWeek(now) },
    { period: ChartPeriod.MONTHLY, start: startOfMonth(now) },
  ] as const;

  for (const definition of chartDefinitions) {
    const chart = await prisma.chart.upsert({
      where: { slug: definition.slug },
      update: {
        name: definition.name,
        subject: definition.subject,
        genreId: pop.id,
      },
      create: { ...definition, genreId: pop.id },
    });

    for (const { period, start } of periods) {
      const snapshot = await prisma.chartSnapshot.upsert({
        where: {
          chartId_period_periodStart: {
            chartId: chart.id,
            period,
            periodStart: start,
          },
        },
        update: { periodEnd: endOfPeriod(start, period), generatedAt: now },
        create: {
          chartId: chart.id,
          period,
          periodStart: start,
          periodEnd: endOfPeriod(start, period),
        },
      });

      await prisma.chartEntry.deleteMany({
        where: { snapshotId: snapshot.id },
      });

      if (definition.subject === ChartSubject.TRACK) {
        await prisma.chartEntry.createMany({
          data: tracks.map((track, index) => ({
            snapshotId: snapshot.id,
            trackId: trackIds.get(track.slug)!,
            rank: index + 1,
            previousRank: [1, 1, null, 1, 1, null, 1, 9, 7, null][index],
            peakRank: Math.min(index + 1, index === 1 ? 1 : index + 1),
            periodsOnChart: tracks.length - index,
            score: 100 - index * 8,
          })),
        });
      } else {
        await prisma.chartEntry.createMany({
          data: rankingArtists.map((artistName, index) => ({
            snapshotId: snapshot.id,
            artistId: artistIds.get(artistName)!,
            rank: index + 1,
            previousRank: index === 1 ? 1 : index + 1,
            peakRank: Math.max(1, index - 1),
            periodsOnChart: 8,
            score: 100 - index * 7,
          })),
        });
      }
    }
  }

  console.log(
    `Seeded 1 image, ${artists.length} artists, ${tracks.length} tracks, and ${chartDefinitions.length} charts.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
