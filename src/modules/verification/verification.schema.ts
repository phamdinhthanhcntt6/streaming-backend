import { z } from "zod";

export const createVerificationRequestSchema = z.object({
  artistName: z
    .string()
    .trim()
    .min(1, "Artist name is required")
    .max(200, "Artist name must be at most 200 characters"),
  links: z
    .array(z.url("Each link must be a valid URL").max(500))
    .max(10, "You can add at most 10 links")
    .default([]),
});

export const reviewVerificationRequestSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(500).optional(),
  // Lets a reviewer correct the catalog artist the request was matched to,
  // or clear it so that approving creates a brand new artist.
  targetArtistId: z.uuid().nullable().optional(),
});

export const listVerificationRequestsSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateVerificationRequestInput = z.infer<
  typeof createVerificationRequestSchema
>;
export type ReviewVerificationRequestInput = z.infer<
  typeof reviewVerificationRequestSchema
>;
