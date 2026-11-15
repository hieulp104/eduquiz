-- CreateEnum
CREATE TYPE "PriceMode" AS ENUM ('FREE', 'PAID_ENTRY', 'PAID_EXPLANATION');

-- CreateEnum
CREATE TYPE "ExamMode" AS ENUM ('EXAM', 'PRACTICE');

-- CreateEnum
CREATE TYPE "ExamAudience" AS ENUM ('ALL', 'CLASSES', 'STUDENTS');

-- CreateEnum
CREATE TYPE "RevealMode" AS ENUM ('NEVER', 'AFTER_SUBMIT', 'AFTER_CLOSE', 'MIN_SCORE');

-- DropIndex
DROP INDEX "submissions_assignment_id_student_id_key";

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "shuffle_groups" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "class_id" DROP NOT NULL,
ALTER COLUMN "due_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "price" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "price_mode" "PriceMode" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "price_note" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "purpose" TYPE TEXT USING (CASE "purpose"::text
  WHEN 'SEMESTER_EXAM' THEN 'HK1_FINAL'
  WHEN 'HOMEWORK' THEN 'OTHER_REVIEW'
  WHEN 'PRACTICE' THEN 'OTHER_REVIEW'
  WHEN 'REVIEW' THEN 'OTHER_REVIEW'
  WHEN 'QUIZ_15' THEN 'OTHER_OTHER'
  WHEN 'TEST_45' THEN 'OTHER_OTHER'
  WHEN 'OTHER' THEN 'OTHER_OTHER'
  ELSE NULL END);

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "attempt" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "leave_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "exam_online_configs" (
    "exam_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "mode" "ExamMode" NOT NULL DEFAULT 'EXAM',
    "published_at" TIMESTAMP(3),
    "open_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "audience" "ExamAudience" NOT NULL DEFAULT 'ALL',
    "class_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "student_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lab_mode" BOOLEAN NOT NULL DEFAULT false,
    "max_attempts" INTEGER NOT NULL DEFAULT 1,
    "password" TEXT,
    "monitor_leave" BOOLEAN NOT NULL DEFAULT false,
    "shuffle" BOOLEAN NOT NULL DEFAULT false,
    "shuffle_groups" BOOLEAN NOT NULL DEFAULT false,
    "hide_group_titles" BOOLEAN NOT NULL DEFAULT false,
    "show_score" "RevealMode" NOT NULL DEFAULT 'AFTER_SUBMIT',
    "show_answers" "RevealMode" NOT NULL DEFAULT 'AFTER_SUBMIT',
    "min_score_for_answers" DOUBLE PRECISION,
    "hide_wrong_answers" BOOLEAN NOT NULL DEFAULT false,
    "retry_wrong" BOOLEAN NOT NULL DEFAULT false,
    "header_note" TEXT NOT NULL DEFAULT '',
    "pre_notice" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_online_configs_pkey" PRIMARY KEY ("exam_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_online_configs_code_key" ON "exam_online_configs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_assignment_id_student_id_attempt_key" ON "submissions"("assignment_id", "student_id", "attempt");

-- AddForeignKey
ALTER TABLE "exam_online_configs" ADD CONSTRAINT "exam_online_configs_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Bài đã giao có bật đảo câu trước đây = đảo cả vị trí nhóm (giữ nguyên hành vi cũ).
UPDATE "assignments" SET "shuffle_groups" = "shuffle_questions";
