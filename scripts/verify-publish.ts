/**
 * Kiểm thử "Cài đặt làm bài online" trên DB dev (cần đã chạy db:seed).
 * - Luật hiển thị điểm / đáp án, số lượt làm (hàm thuần).
 * - Xuất bản: sinh bài giao theo đối tượng, đổi đối tượng thì gỡ bài giao chưa ai làm.
 * - Làm nhiều lượt + hết lượt; quyền làm bài theo đối tượng; link /thi/<mã>.
 * - Luyện tập: trả lời từng câu, không trả lời lại được, chốt bài tính đúng điểm.
 * Dữ liệu thử bị xóa sau khi chạy.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "@/shared/prisma/prisma.service";
import { EXAM_PURPOSES, examPurposeLabel } from "@/common/enums";
import { createExam } from "@/modules/exams/exams.service";
import { examSettingsSchema } from "@/modules/exams/exams.schema";
import { listAssignmentsForStudent } from "@/modules/assignments/assignments.service";
import { onlineSettingsSchema } from "@/modules/publish/publish.schema";
import {
  createGuestUser,
  findActiveGuest,
  getTakerProfile,
  renameGuest,
  signGuestTicket,
  verifyGuestTicket,
} from "@/modules/auth/guest";
import {
  findOpenAssignmentByCode,
  findPublishedByCode,
  resolveAssignmentForStudent,
  saveOnlineSettings,
} from "@/modules/publish/publish.service";
import { attemptsLeft, canSeeAnswers, canSeeScore, takeSettings } from "@/modules/publish/publish.types";
import {
  answerPracticeQuestion,
  canTakeAssignment,
  countExamSubmissions,
  getSubmissionResult,
  setSubmissionComment,
  gradeAndSubmit,
  startSubmission,
} from "@/modules/submissions/submissions.service";

function verifyRules() {
  assert.equal(EXAM_PURPOSES.length, 13, "13 mục đích trong 3 nhóm");
  assert.equal(examPurposeLabel("HK1_MIDTERM"), "Kiểm tra giữa kỳ I");
  assert.equal(examPurposeLabel("HK2_OTHER", true), "Khác (Học kỳ 2)");
  assert.equal(examPurposeLabel("QUIZ_15"), null, "mã cũ không còn hợp lệ");

  // Bài giao kiểu cũ (chưa có cấu hình / mới lưu nháp): 1 lượt, đáp án theo showAnswer.
  const legacy = takeSettings({ showAnswer: false }, null);
  assert.deepEqual([legacy.maxAttempts, legacy.showAnswers, legacy.mode], [1, "NEVER", "EXAM"]);

  const base = {
    mode: "EXAM" as const,
    publishedAt: new Date(),
    maxAttempts: 3,
    password: "abc",
    monitorLeave: true,
    labMode: false,
    hideGroupTitles: false,
    showScore: "AFTER_CLOSE" as const,
    showAnswers: "MIN_SCORE" as const,
    minScoreForAnswers: 8,
    hideWrongAnswers: true,
    retryWrong: true,
    headerNote: "",
    preNotice: "",
  };
  assert.equal(takeSettings({ showAnswer: true }, { ...base, publishedAt: null }).maxAttempts, 1, "nháp chưa có hiệu lực");
  const exam = takeSettings({ showAnswer: true }, base);
  assert.equal(exam.retryWrong, false, "luyện lại câu sai chỉ có ở chế độ Luyện tập");
  const practice = takeSettings({ showAnswer: true }, { ...base, mode: "PRACTICE" });
  assert.deepEqual(
    [practice.maxAttempts, practice.password, practice.showAnswers, practice.hideWrongAnswers, practice.retryWrong],
    [0, null, "AFTER_SUBMIT", false, true],
    "Luyện tập: không giới hạn lượt, không mật khẩu, xem đáp án ngay",
  );

  const past = new Date(Date.now() - 1000);
  const future = new Date(Date.now() + 60_000);
  assert.equal(canSeeScore(exam, { dueAt: future, score10: 10 }), false, "chưa hết đợt thi → chưa xem điểm");
  assert.equal(canSeeScore(exam, { dueAt: past, score10: 0 }), true);
  assert.equal(canSeeScore(exam, { dueAt: null, score10: 10 }), false, "không đặt hạn → chưa bao giờ 'thi xong'");
  assert.equal(canSeeAnswers(exam, { dueAt: null, score10: 7.75 }), false);
  assert.equal(canSeeAnswers(exam, { dueAt: null, score10: 8 }), true);
  assert.deepEqual([attemptsLeft(0, 99), attemptsLeft(3, 1), attemptsLeft(3, 5)], [Infinity, 2, 0]);

  // Giá: có thu phí thì phải nhập giá.
  const settings = { title: "x", description: "", durationMinutes: 10 };
  assert.equal(examSettingsSchema.safeParse({ ...settings, priceMode: "PAID_ENTRY", price: 0 }).success, false);
  assert.equal(examSettingsSchema.safeParse({ ...settings, priceMode: "PAID_ENTRY", price: 50_000 }).success, true);
  assert.equal(examSettingsSchema.safeParse({ ...settings, purpose: "QUIZ_15" }).success, false, "mục đích cũ bị từ chối");
}

const FORM = {
  publish: true,
  title: "Đề verify xuất bản",
  grade: 10,
  subject: "Toán",
  purpose: "HK1_MIDTERM",
  durationMinutes: 15,
  mode: "EXAM",
  openAt: "",
  dueAt: "",
  audience: "ALL",
  classIds: [] as string[],
  studentIds: [] as string[],
  labMode: false,
  maxAttempts: 2,
  password: "",
  monitorLeave: false,
  shuffle: true,
  shuffleGroups: false,
  hideGroupTitles: false,
  showScore: "AFTER_SUBMIT",
  showAnswers: "AFTER_SUBMIT",
  minScoreForAnswers: null,
  hideWrongAnswers: false,
  retryWrong: false,
  headerNote: "",
  preNotice: "",
  priceMode: "PAID_ENTRY",
  price: 50_000,
  priceNote: '<p>Phí thi thử <script>alert(1)</script><b>1 lần</b></p>',
};

async function main() {
  verifyRules();

  const teacher = await prisma.user.findUniqueOrThrow({ where: { username: "gv.lan" } });
  const an = await prisma.user.findUniqueOrThrow({ where: { username: "hs.an" } });
  const binh = await prisma.user.findUniqueOrThrow({ where: { username: "hs.binh" } });
  const classroom = await prisma.classroom.findUniqueOrThrow({ where: { joinCode: "TOAN10" } });

  const option = (content: string, isCorrect = false) => ({ content, isCorrect });
  const exam = await createExam(teacher.id, {
    title: FORM.title,
    description: null,
    durationMinutes: 15,
    questions: [1, 2, 3, 4].map((n) => ({
      content: `Câu verify ${n}`,
      points: 2.5,
      options: [option("đúng", true), option("sai 1"), option("sai 2")],
    })),
  });
  const save = (patch: Record<string, unknown>) =>
    saveOnlineSettings(onlineSettingsSchema.parse({ ...FORM, examId: exam.id, ...patch }));
  const active = () =>
    prisma.assignment.findMany({ where: { examId: exam.id, deletedAt: null }, include: { exam: { select: { onlineConfig: true } } } });

  try {
    assert.equal(onlineSettingsSchema.safeParse({ ...FORM, examId: exam.id, audience: "CLASSES" }).success, false, "giao theo lớp phải chọn lớp");
    assert.equal(
      onlineSettingsSchema.safeParse({ ...FORM, examId: exam.id, openAt: "2026-11-20T10:00", dueAt: "2026-11-20T09:00" }).success,
      false,
      "giờ kết thúc phải sau giờ bắt đầu",
    );

    // ── Lưu nháp: chưa sinh bài giao, link chưa dùng được
    const draft = await save({ publish: false });
    assert.match(draft.code, /^[a-z2-9]{6}$/);
    assert.equal(draft.published, false);
    assert.equal((await active()).length, 0, "lưu nháp không tạo bài giao");
    assert.equal(await findPublishedByCode(draft.code), null);

    // ── Xuất bản theo lớp
    const pub = await save({ audience: "CLASSES", classIds: [classroom.id] });
    assert.equal(pub.code, draft.code, "mã đề giữ nguyên qua các lần lưu");
    let rows = await active();
    assert.deepEqual(rows.map((a) => a.classId), [classroom.id]);
    assert.deepEqual([rows[0].shuffleQuestions, rows[0].shuffleOptions, rows[0].shuffleGroups, rows[0].dueAt], [true, true, false, null]);
    const saved = await prisma.exam.findUniqueOrThrow({ where: { id: exam.id } });
    assert.deepEqual([saved.purpose, saved.priceMode, saved.price], ["HK1_MIDTERM", "PAID_ENTRY", 50_000]);
    assert.ok(!saved.priceNote.includes("script") && saved.priceNote.includes("<b>1 lần</b>"), "mô tả giá phải được lọc HTML");
    assert.ok((await listAssignmentsForStudent(an.id)).some((a) => a.examId === exam.id), "học sinh trong lớp thấy bài");
    assert.equal(await findOpenAssignmentByCode(pub.code), null, "đề giao theo lớp: khách chưa đăng nhập không làm được");

    // ── Đổi sang "Tất cả mọi người": bài giao lớp chưa ai làm bị gỡ, còn 1 bài "link chung"
    await save({ audience: "ALL" });
    rows = await active();
    assert.deepEqual(rows.map((a) => a.classId), [null]);
    const open = rows[0];
    assert.equal(await canTakeAssignment(an.id, open), true);
    const config = await findPublishedByCode(pub.code.toUpperCase());
    assert.ok(config, "mã link không phân biệt hoa thường");
    assert.equal(await resolveAssignmentForStudent(config, an.id), open.id);

    // ── Khách (chưa đăng nhập) làm qua link: tài khoản ẩn danh mang tên vừa nhập, điểm gắn vào tài khoản đó
    assert.equal((await findOpenAssignmentByCode(pub.code.toUpperCase()))?.id, open.id, "đề cho tất cả mọi người: khách làm được");
    const guest = await createGuestUser("Khách verify");
    try {
      const ticket = signGuestTicket(guest.id);
      assert.equal(verifyGuestTicket(ticket), guest.id);
      assert.equal(verifyGuestTicket(ticket.replace(/.$/, (c) => (c === "0" ? "1" : "0"))), null, "vé bị sửa chữ ký");
      assert.equal(verifyGuestTicket(ticket, Date.now() + 2 * 60 * 1000), null, "vé hết hạn sau 1 phút");
      assert.equal(verifyGuestTicket("abc"), null);
      assert.ok(await findActiveGuest(guest.id));
      assert.equal(await findActiveGuest(an.id), null, "vé ẩn danh không đăng nhập được tài khoản thật");

      assert.equal(await canTakeAssignment(guest.id, open), true);
      const run = await startSubmission(open.id, exam.id, guest.id, 2, { className: "8A", number: "17" });
      assert.deepEqual([run?.takerClass, run?.takerNumber], ["8A", "17"]);
      await renameGuest(guest.id, "Nguyễn Văn Khách");
      await renameGuest(an.id, "Không được đổi");
      assert.deepEqual(await getTakerProfile(guest.id), { fullName: "Nguyễn Văn Khách", isGuest: true });
      assert.equal((await getTakerProfile(an.id)).isGuest, false);
      assert.notEqual((await getTakerProfile(an.id)).fullName, "Không được đổi", "chỉ đổi tên tài khoản ẩn danh");

      assert.equal(await gradeAndSubmit(run!.id, {}), true);
      await setSubmissionComment(run!.id, "Cần cố gắng hơn");
      const graded = await getSubmissionResult(run!.id);
      assert.deepEqual(
        [graded?.submission.student.fullName, graded?.submission.student.isGuest, graded?.submission.comment],
        ["Nguyễn Văn Khách", true, "Cần cố gắng hơn"],
      );
      assert.equal(await countExamSubmissions(exam.id), 1);
    } finally {
      await prisma.submission.deleteMany({ where: { studentId: guest.id } });
      await prisma.user.delete({ where: { id: guest.id } });
    }

    // ── 2 lượt làm, lượt 3 bị chặn
    const settings = takeSettings(open, open.exam.onlineConfig);
    assert.equal(settings.maxAttempts, 2);
    const first = await startSubmission(open.id, exam.id, an.id, settings.maxAttempts);
    assert.ok(first);
    assert.equal((await startSubmission(open.id, exam.id, an.id, settings.maxAttempts))?.id, first.id, "đang làm dở → trả lượt cũ");
    assert.equal(await gradeAndSubmit(first.id, {}), true);
    const second = await startSubmission(open.id, exam.id, an.id, settings.maxAttempts);
    assert.equal(second?.attempt, 2);
    await gradeAndSubmit(second!.id, {});
    assert.equal(await startSubmission(open.id, exam.id, an.id, settings.maxAttempts), null, "hết lượt");

    // ── Giao theo học sinh: chỉ người được chọn; bài "link chung" đã có bài làm nên được giữ
    await save({ audience: "STUDENTS", studentIds: [binh.id] });
    rows = await active();
    assert.deepEqual(rows.map((a) => a.id), [open.id]);
    assert.equal(await canTakeAssignment(an.id, rows[0]), false);
    assert.equal(await canTakeAssignment(binh.id, rows[0]), true);
    assert.ok((await listAssignmentsForStudent(binh.id)).some((a) => a.id === open.id), "học sinh được chọn thấy bài ở Tổng quan");
    assert.ok(!(await listAssignmentsForStudent(an.id)).some((a) => a.id === open.id));

    // ── Luyện tập: trả lời từng câu
    await save({ mode: "PRACTICE", audience: "STUDENTS", studentIds: [binh.id], retryWrong: true });
    const practice = takeSettings(open, (await active())[0].exam.onlineConfig);
    assert.deepEqual([practice.mode, practice.maxAttempts, practice.retryWrong], ["PRACTICE", 0, true]);
    const run = await startSubmission(open.id, exam.id, binh.id, practice.maxAttempts);
    assert.ok(run);
    const questions = await prisma.question.findMany({ where: { examId: exam.id }, orderBy: { order: "asc" }, include: { options: true } });
    const right = (i: number) => questions[i].options.find((o) => o.isCorrect)!.id;
    const wrong = (i: number) => questions[i].options.find((o) => !o.isCorrect)!.id;
    assert.deepEqual(await answerPracticeQuestion(run.id, exam.id, questions[0].id, right(0)), { isCorrect: true, correctOptionId: right(0) });
    assert.deepEqual(await answerPracticeQuestion(run.id, exam.id, questions[1].id, wrong(1)), { isCorrect: false, correctOptionId: right(1) });
    assert.equal(await answerPracticeQuestion(run.id, exam.id, questions[1].id, right(1)), null, "không trả lời lại câu đã làm");
    assert.equal(await answerPracticeQuestion(run.id, exam.id, questions[2].id, right(0)), null, "phương án không thuộc câu hỏi");
    // Chốt bài: client gửi đáp án đúng cho câu 2 (đã trả lời sai) → phải bị bỏ qua.
    assert.equal(await gradeAndSubmit(run.id, { [questions[1].id]: right(1) }), true);
    const result = await getSubmissionResult(run.id);
    assert.equal(result?.submission.score, 2.5, "chỉ câu 1 đúng");
    assert.equal(result?.submission.answers.length, 4);

    console.log(
      "✔ verify-publish: mục đích theo nhóm, xuất bản theo đối tượng, khách làm qua link (tài khoản ẩn danh), nhiều lượt làm, luyện tập, luật xem điểm / đáp án",
    );
  } finally {
    await prisma.submission.deleteMany({ where: { assignment: { examId: exam.id } } });
    await prisma.assignment.deleteMany({ where: { examId: exam.id } });
    await prisma.exam.delete({ where: { id: exam.id } });
  }
}

main()
  .catch((e) => {
    console.error("✘ verify-publish:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
