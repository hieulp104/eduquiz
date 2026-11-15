-- Nhóm lớp + năm học của lớp

-- AlterTable
ALTER TABLE "classrooms" ADD COLUMN     "group_id" TEXT,
ADD COLUMN     "school_year" TEXT;

-- CreateTable
CREATE TABLE "class_groups" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "class_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_groups_teacher_id_idx" ON "class_groups"("teacher_id");

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "class_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

