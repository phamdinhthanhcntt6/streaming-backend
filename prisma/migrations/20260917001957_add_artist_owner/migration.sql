-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "userId" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "Artist_userId_key" ON "Artist"("userId");
-- AddForeignKey
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
