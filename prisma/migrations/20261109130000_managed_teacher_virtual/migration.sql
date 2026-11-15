-- DropForeignKey
ALTER TABLE "managed_teachers" DROP CONSTRAINT "managed_teachers_teacher_id_fkey";

-- AlterTable
ALTER TABLE "managed_teachers" ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ALTER COLUMN "teacher_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "managed_teachers_owner_id_phone_key" ON "managed_teachers"("owner_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "managed_teachers_owner_id_email_key" ON "managed_teachers"("owner_id", "email");

-- AddForeignKey
ALTER TABLE "managed_teachers" ADD CONSTRAINT "managed_teachers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Bản ghi cũ (trỏ tài khoản) lấy SĐT/email từ tài khoản.
UPDATE "managed_teachers" m SET "phone" = u."phone", "email" = u."email" FROM "users" u WHERE u."id" = m."teacher_id";

-- Phải có SĐT hoặc email.
ALTER TABLE "managed_teachers" ADD CONSTRAINT "managed_teachers_contact_check" CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL);
