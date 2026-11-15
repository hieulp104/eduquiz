# EduQuiz

Nền tảng giao bài tập và thi trắc nghiệm trực tuyến — Next.js 16 · Prisma 7 · PostgreSQL · Auth.js.

## Chạy lần đầu

Yêu cầu: Node.js 20+, Docker.

```bash
npm install
cp .env.example .env     # rồi đổi AUTH_SECRET (npx auth secret)
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev              # http://localhost:3000
```

Tài khoản do quản trị cấp (không có tự đăng ký). Đăng nhập bằng username, email hoặc số điện thoại.
Tài khoản mẫu — mật khẩu `EduQuiz@2026`:

| Username | SĐT | Vai trò |
|---|---|---|
| `admin` | 0900000001 | Quản trị viên |
| `gv.lan` | 0900000002 | Giáo viên |
| `hs.an`, `hs.binh`, `hs.cuong` | 0900000003–05 | Học sinh |

## Tính năng

- Đăng nhập bằng username / email / SĐT, chế độ sáng–tối
- Giáo viên: tạo lớp (có mã vào lớp), soạn đề trắc nghiệm, giao bài có thời gian mở / hạn nộp, xem bảng điểm cả lớp
- Học sinh: vào lớp bằng mã, làm bài có đồng hồ đếm ngược (hết giờ tự nộp), xem điểm và đáp án

Cấu trúc thư mục và quy ước code: xem [CLAUDE.md](CLAUDE.md).
