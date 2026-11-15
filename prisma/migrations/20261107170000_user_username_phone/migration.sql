-- Đăng nhập bằng username / số điện thoại (tài khoản do quản trị cấp)
ALTER TABLE "users" ADD COLUMN "username" TEXT,
ADD COLUMN "phone" TEXT;

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
