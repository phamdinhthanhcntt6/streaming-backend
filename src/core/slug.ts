import type { Prisma } from "../generated/prisma/client.js";

/// Turns a display name into a URL-safe slug, stripping Vietnamese diacritics
/// so that "Sơn Tùng M-TP" becomes "son-tung-m-tp".
export const slugify = (value: string) => {
  const slug = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Names written entirely in a non-Latin script reduce to an empty string.
  return slug || "artist";
};

/// Appends -2, -3, ... until the slug is free. Artist.slug is unique, so the
/// caller would otherwise fail on a name that already exists in the catalog.
export const uniqueArtistSlug = async (
  tx: Prisma.TransactionClient,
  name: string,
) => {
  const base = slugify(name);
  let candidate = base;

  for (let suffix = 2; ; suffix += 1) {
    const taken = await tx.artist.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!taken) return candidate;
    candidate = `${base}-${suffix}`;
  }
};
