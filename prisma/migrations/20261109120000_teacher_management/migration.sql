-- CreateTable
CREATE TABLE "teacher_groups" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teacher_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "managed_teachers" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "managed_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_group_members" (
    "group_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,

    CONSTRAINT "teacher_group_members_pkey" PRIMARY KEY ("group_id","member_id")
);

-- CreateTable
CREATE TABLE "class_permissions" (
    "id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "group_id" TEXT,
    "member_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_groups_owner_id_idx" ON "teacher_groups"("owner_id");

-- CreateIndex
CREATE INDEX "managed_teachers_teacher_id_idx" ON "managed_teachers"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "managed_teachers_owner_id_teacher_id_key" ON "managed_teachers"("owner_id", "teacher_id");

-- CreateIndex
CREATE INDEX "teacher_group_members_member_id_idx" ON "teacher_group_members"("member_id");

-- CreateIndex
CREATE INDEX "class_permissions_group_id_idx" ON "class_permissions"("group_id");

-- CreateIndex
CREATE INDEX "class_permissions_member_id_idx" ON "class_permissions"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_permissions_class_id_group_id_key" ON "class_permissions"("class_id", "group_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_permissions_class_id_member_id_key" ON "class_permissions"("class_id", "member_id");

-- AddForeignKey
ALTER TABLE "teacher_groups" ADD CONSTRAINT "teacher_groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "managed_teachers" ADD CONSTRAINT "managed_teachers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "managed_teachers" ADD CONSTRAINT "managed_teachers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_group_members" ADD CONSTRAINT "teacher_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "teacher_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_group_members" ADD CONSTRAINT "teacher_group_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "managed_teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_permissions" ADD CONSTRAINT "class_permissions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_permissions" ADD CONSTRAINT "class_permissions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "teacher_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_permissions" ADD CONSTRAINT "class_permissions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "managed_teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Đúng 1 trong 2: phân quyền cho nhóm HOẶC cho 1 giáo viên.
ALTER TABLE "class_permissions" ADD CONSTRAINT "class_permissions_target_check" CHECK (("group_id" IS NULL) <> ("member_id" IS NULL));
