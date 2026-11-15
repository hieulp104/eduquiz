-- Thư mục đề thi
-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "folder_id" TEXT;

-- CreateTable
CREATE TABLE "exam_folders" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "exam_folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_folders_teacher_id_parent_id_idx" ON "exam_folders"("teacher_id", "parent_id");

-- CreateIndex
CREATE INDEX "exams_folder_id_idx" ON "exams"("folder_id");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "exam_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_folders" ADD CONSTRAINT "exam_folders_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_folders" ADD CONSTRAINT "exam_folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "exam_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

