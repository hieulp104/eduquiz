-- Nhóm câu hỏi (lời dẫn / đoạn văn chung) + khối, môn, mục đích của đề

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "grade" INTEGER,
ADD COLUMN     "purpose" "HomeworkPurpose",
ADD COLUMN     "subject" TEXT;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "group_id" TEXT;

-- CreateTable
CREATE TABLE "question_groups" (
    "id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "question_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_groups_exam_id_idx" ON "question_groups"("exam_id");

-- CreateIndex
CREATE INDEX "questions_group_id_idx" ON "questions"("group_id");

-- AddForeignKey
ALTER TABLE "question_groups" ADD CONSTRAINT "question_groups_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "question_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

