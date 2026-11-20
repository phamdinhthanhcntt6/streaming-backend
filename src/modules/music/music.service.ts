import { prisma } from "../../core/db.js";
import { AppError } from "../../core/errors.js";
import { TrackStatus } from "../../generated/prisma/client.js";
import type { RecordPlayInput } from "./music.schema.js";

const COMPLETED_RATIO = 0.9;

const incrementPlayCount = (trackId: string) => {
  return prisma.track.update({
    where: { id: trackId },
    data: { playCount: { increment: 1 } },
    select: { playCount: true },
  });
};

export const recordPlay = async (
  userId: string | null,
  trackId: string,
  { progressMs }: RecordPlayInput,
) => {
  const track = await prisma.track.findUnique({
    where: { id: trackId, status: TrackStatus.PUBLISHED },
    select: { durationMs: true },
  });

  if (!track) throw new AppError(404, "Track not found");

  if (!userId) {
    const { playCount } = await incrementPlayCount(trackId);
    return { id: null, playCount };
  }

  const playedMs = Math.min(progressMs, track.durationMs);
  const completed = playedMs >= track.durationMs * COMPLETED_RATIO;

  const [play, { playCount }] = await prisma.$transaction([
    prisma.playHistory.create({
      data: { userId, trackId, progressMs: playedMs, completed },
      select: { id: true },
    }),
    incrementPlayCount(trackId),
  ]);

  return { id: play.id, playCount };
};
