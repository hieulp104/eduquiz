-- CreateTable
CREATE TABLE "question_banks" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" INTEGER,
    "subject" TEXT,
    "book_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "question_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_sections" (
    "id" TEXT NOT NULL,
    "bank_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_items" (
    "id" TEXT NOT NULL,
    "bank_id" TEXT NOT NULL,
    "section_id" TEXT,
    "content" TEXT NOT NULL,
    "options" TEXT[],
    "correct_index" INTEGER NOT NULL,
    "level" "QuestionLevel",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_activities" (
    "id" TEXT NOT NULL,
    "bank_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "question_banks_owner_id_idx" ON "question_banks"("owner_id");

-- CreateIndex
CREATE INDEX "bank_sections_bank_id_parent_id_idx" ON "bank_sections"("bank_id", "parent_id");

-- CreateIndex
CREATE INDEX "bank_items_bank_id_section_id_idx" ON "bank_items"("bank_id", "section_id");

-- CreateIndex
CREATE INDEX "bank_activities_bank_id_created_at_idx" ON "bank_activities"("bank_id", "created_at");

-- AddForeignKey
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_banks" ADD CONSTRAINT "question_banks_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "question_bank_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_sections" ADD CONSTRAINT "bank_sections_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "question_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_sections" ADD CONSTRAINT "bank_sections_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "bank_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_items" ADD CONSTRAINT "bank_items_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "question_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_items" ADD CONSTRAINT "bank_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "bank_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_activities" ADD CONSTRAINT "bank_activities_bank_id_fkey" FOREIGN KEY ("bank_id") REFERENCES "question_banks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_activities" ADD CONSTRAINT "bank_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

