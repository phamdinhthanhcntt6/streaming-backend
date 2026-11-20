import z from "zod";

const MAX_PROGRESS_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export const recordPlaySchema = z.object({
  progressMs: z.number().int().min(0).max(MAX_PROGRESS_MS),
});

export type RecordPlayInput = z.infer<typeof recordPlaySchema>;
