-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "comment" TEXT,
ADD COLUMN     "taker_class" TEXT,
ADD COLUMN     "taker_number" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_guest" BOOLEAN NOT NULL DEFAULT false;

