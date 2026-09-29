-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ArtistVerificationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "artistName" TEXT NOT NULL,
    "links" TEXT[],
    "targetArtistId" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistVerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArtistVerificationRequest_status_createdAt_idx" ON "ArtistVerificationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ArtistVerificationRequest_userId_createdAt_idx" ON "ArtistVerificationRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ArtistVerificationRequest_targetArtistId_idx" ON "ArtistVerificationRequest"("targetArtistId");

-- AddForeignKey
ALTER TABLE "ArtistVerificationRequest" ADD CONSTRAINT "ArtistVerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistVerificationRequest" ADD CONSTRAINT "ArtistVerificationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistVerificationRequest" ADD CONSTRAINT "ArtistVerificationRequest_targetArtistId_fkey" FOREIGN KEY ("targetArtistId") REFERENCES "Artist"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Only one PENDING request per user. Prisma cannot express a partial unique
-- index, so it is declared here; other statuses may repeat freely.
CREATE UNIQUE INDEX "ArtistVerificationRequest_userId_pending_key"
  ON "ArtistVerificationRequest" ("userId")
  WHERE "status" = 'PENDING';
