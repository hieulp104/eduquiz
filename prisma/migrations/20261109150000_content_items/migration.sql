-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('EXAM', 'REFERENCE', 'VIDEO', 'SLIDE', 'LESSON_PLAN');

-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "kind" "ContentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "grade" INTEGER,
    "subject" TEXT,
    "exam_id" TEXT,
    "file_id" TEXT,
    "url" TEXT,
    "download_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_items_file_id_key" ON "content_items"("file_id");

-- CreateIndex
CREATE INDEX "content_items_kind_grade_idx" ON "content_items"("kind", "grade");

-- CreateIndex
CREATE INDEX "content_items_owner_id_idx" ON "content_items"("owner_id");

-- CreateIndex
CREATE INDEX "content_items_exam_id_idx" ON "content_items"("exam_id");

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Mỗi loại có đúng nguồn của nó: đề → exam_id, video → url, còn lại → file_id
-- (exam_id / file_id có thể về NULL khi đề / file bị xóa hẳn → mục bị ẩn).
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_source_check" CHECK (
  ("kind" = 'VIDEO' AND "url" IS NOT NULL) OR ("kind" <> 'VIDEO' AND "url" IS NULL)
);
