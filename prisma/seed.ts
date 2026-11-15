/**
 * Seed dữ liệu mẫu cho EduQuiz.
 * Chạy: npm run db:seed   (hoặc npm run db:reset để xóa sạch rồi seed lại)
 *
 * Idempotent — chạy nhiều lần không tạo trùng (khóa theo email / mã lớp / tên đề).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { RoleCode } from "../src/generated/prisma/enums";
import { seedQuestionBank } from "./question-bank/seed-question-bank";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? "EduQuiz@2026";

const USERS: { email: string; username: string; phone: string; fullName: string; role: RoleCode }[] = [
  { email: "admin@eduquiz.vn", username: "admin", phone: "0900000001", fullName: "Quản trị viên", role: "ADMIN" },
  { email: "gv.lan@eduquiz.vn", username: "gv.lan", phone: "0900000002", fullName: "Nguyễn Thị Lan", role: "TEACHER" },
  { email: "hs.an@eduquiz.vn", username: "hs.an", phone: "0900000003", fullName: "Trần Văn An", role: "STUDENT" },
  { email: "hs.binh@eduquiz.vn", username: "hs.binh", phone: "0900000004", fullName: "Lê Thị Bình", role: "STUDENT" },
  { email: "hs.cuong@eduquiz.vn", username: "hs.cuong", phone: "0900000005", fullName: "Phạm Minh Cường", role: "STUDENT" },
];

const SAMPLE_EXAM = {
  title: "Kiểm tra 15 phút — Toán 10",
  description: "Chọn một đáp án đúng cho mỗi câu.",
  durationMinutes: 15,
  questions: [
    { content: "Giá trị của 2 + 3 × 4 là bao nhiêu?", options: ["20", "14", "24", "11"], correct: 1 },
    { content: "Nghiệm của phương trình 2x − 6 = 0 là:", options: ["x = 2", "x = −3", "x = 3", "x = 6"], correct: 2 },
    { content: "Tập hợp nào sau đây là tập rỗng?", options: ["{0}", "{x ∈ ℝ | x² + 1 = 0}", "{∅}", "{x ∈ ℝ | x² = 0}"], correct: 1 },
    { content: "Căn bậc hai của 81 là:", options: ["9", "8", "7", "18"], correct: 0 },
  ],
};

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const users: Record<string, { id: string }> = {};
  for (const u of USERS) {
    users[u.email] = await prisma.user.upsert({
      where: { email: u.email },
      create: { ...u, passwordHash },
      update: { fullName: u.fullName, role: u.role, username: u.username, phone: u.phone },
      select: { id: true },
    });
  }
  const teacherId = users["gv.lan@eduquiz.vn"].id;

  const classroom = await prisma.classroom.upsert({
    where: { joinCode: "TOAN10" },
    create: { name: "10A1", subject: "Toán", joinCode: "TOAN10", teacherId },
    update: {},
  });

  for (const email of ["hs.an@eduquiz.vn", "hs.binh@eduquiz.vn", "hs.cuong@eduquiz.vn"]) {
    await prisma.classMember.upsert({
      where: { classId_studentId: { classId: classroom.id, studentId: users[email].id } },
      create: { classId: classroom.id, studentId: users[email].id },
      update: {},
    });
  }

  let exam = await prisma.exam.findFirst({
    where: { teacherId, title: SAMPLE_EXAM.title, deletedAt: null },
  });
  if (!exam) {
    exam = await prisma.exam.create({
      data: {
        teacherId,
        title: SAMPLE_EXAM.title,
        description: SAMPLE_EXAM.description,
        durationMinutes: SAMPLE_EXAM.durationMinutes,
        questions: {
          create: SAMPLE_EXAM.questions.map((q, qi) => ({
            order: qi + 1,
            content: q.content,
            points: 2.5,
            options: {
              create: q.options.map((content, oi) => ({
                order: oi + 1,
                content,
                isCorrect: oi === q.correct,
              })),
            },
          })),
        },
      },
    });
  }

  const hasAssignment = await prisma.assignment.findFirst({
    where: { examId: exam.id, classId: classroom.id },
  });
  if (!hasAssignment) {
    await prisma.assignment.create({
      data: {
        examId: exam.id,
        classId: classroom.id,
        openAt: new Date(),
        dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log("✔ Seed xong. Mật khẩu tất cả tài khoản:", DEFAULT_PASSWORD);
  console.table(USERS.map(({ username, phone, email, role }) => ({ username, phone, email, role })));
  console.log("Lớp mẫu 10A1 — mã vào lớp: TOAN10");

  const bank = await seedQuestionBank(prisma);
  console.log(`Ngân hàng câu hỏi: ${bank.book} — ${bank.total} câu`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
