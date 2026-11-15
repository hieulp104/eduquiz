-- Bài tập: giao nội dung + file cho lớp

-- CreateEnum
CREATE TYPE "HomeworkPurpose" AS ENUM ('HOMEWORK', 'PRACTICE', 'REVIEW', 'QUIZ_15', 'TEST_45', 'SEMESTER_EXAM', 'OTHER');

-- CreateTable
CREATE TABLE "homeworks" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "purpose" "HomeworkPurpose" NOT NULL,
    "start_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "content_html" TEXT NOT NULL DEFAULT '',
    "show_result" BOOLEAN NOT NULL DEFAULT true,
    "require_login" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "homeworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homework_classes" (
    "homework_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,

    CONSTRAINT "homework_classes_pkey" PRIMARY KEY ("homework_id","class_id")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "homework_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "homeworks_teacher_id_idx" ON "homeworks"("teacher_id");

-- CreateIndex
CREATE INDEX "homework_classes_class_id_idx" ON "homework_classes"("class_id");

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_object_key_key" ON "stored_files"("object_key");

-- CreateIndex
CREATE INDEX "stored_files_homework_id_idx" ON "stored_files"("homework_id");

-- CreateIndex
CREATE INDEX "stored_files_owner_id_idx" ON "stored_files"("owner_id");

-- AddForeignKey
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_classes" ADD CONSTRAINT "homework_classes_homework_id_fkey" FOREIGN KEY ("homework_id") REFERENCES "homeworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homework_classes" ADD CONSTRAINT "homework_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classrooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_homework_id_fkey" FOREIGN KEY ("homework_id") REFERENCES "homeworks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

