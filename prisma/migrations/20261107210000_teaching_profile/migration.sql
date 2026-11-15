-- Khối / môn giáo viên đang dạy
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "teaching_grades" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "teaching_subjects" TEXT[] DEFAULT ARRAY[]::TEXT[];

