-- AlterTable
ALTER TABLE "Image" ADD COLUMN "folder" TEXT NOT NULL DEFAULT 'banners';

-- Remove the transitional default after existing rows have been backfilled.
ALTER TABLE "Image" ALTER COLUMN "folder" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Image_folder_idx" ON "Image"("folder");
