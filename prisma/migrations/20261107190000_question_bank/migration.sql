-- Ngân hàng câu hỏi cho tạo phiếu bài tập
-- CreateEnum
CREATE TYPE "BankQuestionType" AS ENUM ('MCQ', 'FILL');

-- CreateTable
CREATE TABLE "question_bank_nodes" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "parent_id" TEXT,
    "grade" INTEGER,
    "subject" TEXT,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "question_bank_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_questions" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "type" "BankQuestionType" NOT NULL,
    "content" TEXT NOT NULL,
    "options" TEXT[],
    "correct_index" INTEGER NOT NULL,

    CONSTRAINT "bank_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "question_bank_nodes_key_key" ON "question_bank_nodes"("key");

-- CreateIndex
CREATE INDEX "question_bank_nodes_parent_id_idx" ON "question_bank_nodes"("parent_id");

-- CreateIndex
CREATE INDEX "bank_questions_node_id_idx" ON "bank_questions"("node_id");

-- AddForeignKey
ALTER TABLE "question_bank_nodes" ADD CONSTRAINT "question_bank_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "question_bank_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_questions" ADD CONSTRAINT "bank_questions_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "question_bank_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

