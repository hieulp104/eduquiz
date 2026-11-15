-- Mức độ, cố định đáp án / nhóm, audio cho câu hỏi; đảo câu / đáp án khi giao đề

-- CreateEnum
CREATE TYPE "QuestionLevel" AS ENUM ('RECOGNITION', 'COMPREHENSION', 'APPLICATION');

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "shuffle_options" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shuffle_questions" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "question_groups" ADD COLUMN     "audio_file_id" TEXT,
ADD COLUMN     "fixed_order" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "audio_file_id" TEXT,
ADD COLUMN     "fixed_options" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "level" "QuestionLevel";

-- AddForeignKey
ALTER TABLE "question_groups" ADD CONSTRAINT "question_groups_audio_file_id_fkey" FOREIGN KEY ("audio_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_audio_file_id_fkey" FOREIGN KEY ("audio_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

