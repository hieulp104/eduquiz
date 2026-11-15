# CLAUDE.md — EduQuiz

Hướng dẫn cho AI và dev khi làm việc trên repo này.

## 1. Dự án là gì

Nền tảng giao bài tập & thi trắc nghiệm trực tuyến. Giáo viên tạo lớp, soạn đề, giao bài
có hạn nộp; học sinh vào lớp bằng mã, làm bài có đếm giờ, hệ thống tự chấm.

## 2. Tech stack

| Hạng mục | Dùng | Ghi chú |
|---|---|---|
| Framework | **Next.js 16** (App Router) | `middleware.ts` đã bị bỏ → dùng **`proxy.ts`**; `params`/`searchParams` là Promise |
| ORM | **Prisma 7** | Bắt buộc driver adapter `@prisma/adapter-pg` |
| Database | PostgreSQL 15 (Docker) | Host port **5434** |
| UI | Tailwind CSS 4 (cấu hình trong `globals.css`, không có `tailwind.config`) | |
| Auth | Auth.js v5 — Credentials, JWT | |
| Validation | Zod 4 | |

## 3. Chạy dự án

⚠️ **Thêm model / chạy `prisma generate` thì phải khởi động lại `npm run dev`** (vẫn lỗi `findMany` của undefined → xóa thư mục `.next` rồi chạy lại; trang lỗi này còn làm trình duyệt tự tải lại liên tục). Dev server giữ
Prisma Client cũ trên `globalThis` qua các lần hot-reload → lỗi `Cannot read properties of undefined
(reading 'findMany')` ở model mới.

```bash
npm install
npm run db:up        # bật Postgres
npm run db:migrate   # chạy migration — chạy lại mỗi lần pull code mới
npm run db:seed      # dữ liệu mẫu
npm run dev          # http://localhost:3010 (cổng 3000/3005 máy dev đã dùng cho app khác)
npm run verify       # kiểm thử luồng chấm điểm
```

**Không có tự đăng ký** — tài khoản do quản trị cấp. Đăng nhập bằng email, số điện thoại
hoặc username (`loginIdSchema` trong `auth.schema.ts` tự nhận dạng).

Tài khoản mẫu — mật khẩu `EduQuiz@2026`: `admin` · `gv.lan` (giáo viên) ·
`hs.an` / `hs.binh` / `hs.cuong` (học sinh), SĐT `0900000001`…`0900000005`. Lớp mẫu 10A1, mã `TOAN10`.

## 4. Cấu trúc thư mục

Tổ chức theo **module** kiểu NestJS, nhưng là Next.js monolith — không tách backend/frontend.

```
prisma/
├── schema.prisma
├── migrations/
└── seed.ts                 # idempotent
scripts/                    # dev.mjs, verify-*.ts
src/
├── app/                    # CHỈ routing — page mỏng, gọi vào modules/
│   ├── (auth)/login        # thanh trên (logo · chế độ tối) + thẻ đăng nhập
│   ├── (main)/             # layout có sidebar — mọi trang cần đăng nhập
│   │   ├── dashboard/  lop-hoc/  de-thi/
│   │   ├── lam-bai/[assignmentId]/  ket-qua/[submissionId]/
│   │   └── khong-co-quyen/ # trang 403
│   ├── (editor)/           # toàn màn hình, không sidebar: trình soạn đề /de-thi/soan, /de-thi/[id]/sua
│   └── api/auth, api/health
├── modules/                # ★ nghiệp vụ gom theo module
│   ├── auth/  classes/  exams/  assignments/  submissions/  dashboard/
├── common/
│   ├── permissions/        # ★ can(), danh mục quyền, bộ quyền theo vai trò
│   ├── guards/             # requirePagePermission()
│   ├── enums/              # nhãn tiếng Việt, trạng thái bài
│   ├── filters/            # ERROR_CODE + ok()/fail()
│   └── decorators/
├── shared/prisma/          # prisma.service.ts — client dùng chung
├── config/                 # navigation.ts
├── components/             # UI dùng chung: layout/, ui/, patterns/, theme/ (logo, tên app, chế độ tối)
├── lib/                    # utils.ts — cn, formatDate, formatScore...
├── generated/prisma/       # Prisma Client sinh ra — KHÔNG sửa tay
├── types/
└── proxy.ts
```

**Quy ước đặt tên trong `modules/`:**

| File | Vai trò | Tương đương NestJS |
|---|---|---|
| `<tên>.actions.ts` | Server Action, có `"use server"` | controller |
| `<tên>.service.ts` | Truy vấn DB, logic nghiệp vụ | service |
| `<tên>.schema.ts` | Zod schema cho input | DTO |
| `components/` | Component riêng của module | — |

## 5. Convention bắt buộc

### Phân quyền

```ts
// ĐÚNG
if (!can(user, "exam.update", { ownerId: exam.teacherId })) return fail("PERMISSION_DENIED");
// SAI — cấm
if (user.role === "TEACHER") { ... }
```

- Mọi kiểm tra quyền đi qua `can()` / `hasPermission()` / `scopeOf()` trong `common/permissions/permissions.ts`.
- Trang: `requirePagePermission("exam.create")`. `proxy.ts` chỉ kiểm tra đã đăng nhập.
- Scope: `ALL` (Admin) · `OWN` (lớp mình dạy / đề mình soạn / bài mình làm).

### Server Action — đủ 4 bước, đúng thứ tự

1. `requireUser()` → 2. `can()` → 3. validate Zod → 4. ghi DB qua service, `revalidatePath`.
Trả kết quả bằng `ok()` / `fail()` (`common/filters/error.ts`), hoặc state `{ error }` cho form dùng `useActionState`.

### Đề thi & chấm điểm

- **Không bao giờ** gửi `isCorrect` xuống client khi học sinh đang làm bài — dùng `getQuestionsForTaking()`.
- Chấm điểm chỉ ở server (`gradeAndSubmit`), chốt bài bằng `updateMany where submittedAt = null` để chống nộp 2 lần.
- Đề đã giao cho lớp thì không sửa câu hỏi được (sẽ làm sai điểm cũ).

### Bài tập & file (`modules/homework`, `modules/files`)

- File tải lên qua **Route Handler** `POST /api/files` (từng file, ≤ 20MB) — không qua Server Action
  (giới hạn 1MB). `api/files` nằm ngoài matcher của `proxy.ts` nên route tự kiểm tra đăng nhập.
- File tải trước có `homeworkId = null`; lưu bài tập mới gắn vào, và chỉ gắn file của chính người tạo.
- Xem file `GET /api/files/:id` qua `canReadFile()`: người tải, giáo viên của bài, học sinh lớp được giao.
- Kho file: `shared/storage/storage.service.ts` (hiện ghi ổ đĩa `STORAGE_DIR`). Chuyển MinIO/S3 chỉ sửa file này.
- Nội dung trình soạn thảo (Tiptap) **luôn** qua `sanitizeRichText()` trước khi lưu — chỉ render HTML đã lọc.
- `RichTextEditor` import trực tiếp `@/components/ui/forms/rich-text-editor` (không qua barrel — Tiptap nặng).

### Thư viện đề thi (`/de-thi`, `exam-library.*`)

- `ExamFolder` lồng nhau (parentId); `Exam.folderId` null = gốc. URL: `?thu-muc=<id>&q=&sap-xep=name|submitted|status|assignedAt&chieu=asc|desc`.
- Xóa thư mục: xóa mềm cả cây thư mục con, nhưng **không mất đề** — mọi đề trong cây chuyển lên thư mục cha.
- Chuyển thư mục: `isInsideAny()` chặn chuyển vào chính nó / thư mục con (tránh vòng lặp).
- Kiểu + nhãn ở `exam-library.types.ts` (client import được) — đừng import `exam-library.service.ts` vào component client.

### Tạo đề mới (`/de-thi/tao-moi` → soạn / file / ma trận)

- `/de-thi/tao-moi` chỉ là trang chọn cách tạo. Trình soạn đề 2 cột (`components/composer/`) ở route group
  `(editor)`: `/de-thi/soan` (`?thu-muc=`, `?tu-file=1`) và `/de-thi/[id]/sua` (chỉ khi đề chưa giao).
  Cột phải là **văn bản đề — nguồn dữ liệu duy nhất**; cột trái chỉ là kết quả đọc lại (`parseExamText`).
  Bấm phương án ở cột trái → `setCorrectOption()` sửa văn bản (dòng "Đáp án:" hoặc bảng "ĐÁP ÁN" cuối đề).
  Luồng: Tiếp tục → hộp Thông tin đề → Cấu hình chung (khối, môn, mục đích bắt buộc) → `/de-thi/[id]/hoan-tat`.
- **Định dạng văn bản đề** (`exam-text.ts`, client-safe, có test): "Câu n." / "Question n." / "n." (số trơn: tăng dần, không nằm trong đề bài "Câu n" chưa có phương án; dòng "A. … B. …" thừa sau câu đủ đáp án = câu mất số → tự đánh số; Word tự đánh số `<ol>` → `htmlToMarkup` gắn lại số; đáp án = `*`, "Đáp án: X", bảng "ĐÁP ÁN/Answer:/Key", hoặc nhãn "B." gạch chân/in đậm riêng.)
  phương án A–H (mỗi dòng, cách bằng Tab, hoặc 1 dấu cách khi có ≥ 3 nhãn A B C), `*B.` / "Đáp án: B" / bảng "ĐÁP ÁN 1.C | 2.A",
  "Lời giải" bỏ qua, PHẦN I–IV (chỉ nhập PHẦN I). **Chữ đứng trước câu hỏi = tiêu đề nhóm** (`QuestionGroup`: lời dẫn /
  đoạn văn chung); nhóm lặp lại y hệt cho từng câu được gộp. Chữ trước "PHẦN" không có câu → gợi ý Mô tả.
- Định dạng chữ chỉ `<b> <i> <u>` lưu thẳng trong nội dung (`lib/inline-format.ts`); hiển thị bằng `<RichInline>` —
  KHÔNG dangerouslySetInnerHTML. Câu thuộc nhóm được để trống nội dung (VD câu phát âm).
- Đọc file: `POST /api/exams/import` → `{ title, text, warnings }` (chỉ bản nháp, không lưu). docx đọc qua HTML của
  mammoth để giữ đậm/nghiêng/gạch chân; xlsx/tex → câu hỏi → `serializeExam()`. Dòng đầu trang (tên đề viết hoa,
  "Họ và tên…") bị bỏ (`tidyImportedText`). `demau/` (gitignore) chỉ là file tham khảo — KHÔNG đưa vào app.
  Bản nháp qua sessionStorage (`EXAM_DRAFT_KEY`), trình soạn tự lưu lại khi gõ (tải lại trang không mất).
- Điểm: mặc định tổng 10 chia đều (`exam-points.ts`); ô "Nhập điểm" từng câu giữ nguyên, phần còn lại chia đều.
  "Chia điểm nhanh" (`point-split-dialog.tsx`): theo loại câu hỏi hoặc theo phần/nhóm.
- Thẻ trong văn bản (đều do nút ở cột trái ghi vào, sửa tay được): sau số câu `[NB] [TH] [VD]` (mức độ → `Question.level`),
  `[cố định]` (không đảo đáp án), `[audio:<fileId>]`; dòng đầu nhóm `[cố định nhóm] [audio:<fileId>]`.
  Sửa văn bản theo câu: `setQuestionMeta / setGroupMeta / setLevel / removeQuestion` (đánh số lại + bảng đáp án) /
  `replaceQuestion` ("Đổi câu khác" — gợi ý từ đề của mình + ngân hàng chung, `exam-replace.*`).
- Audio tải qua `POST /api/files`; khi lưu đề server chỉ nhận file âm thanh của chính người soạn (`invalidAudioIds`).
  `canReadFile` cho giáo viên của đề và học sinh lớp được giao đề nghe file.
- Đảo đề khi giao (`Assignment.shuffleQuestions/shuffleOptions`): `submissions/exam-order.ts`, cố định theo id bài làm;
  nhóm luôn đi liền khối, "cố định nhóm" giữ thứ tự trong nhóm, "cố định đáp án" giữ A–D.
- File mẫu sinh tại chỗ: `GET /api/exams/template?loai=xlsx|docx|tieng-anh|tex|thu-muc` — sửa bộ đọc thì sửa mẫu cùng lúc.
- Ma trận đề: `exam-matrix.actions.ts` bốc ngẫu nhiên theo chủ đề, kiểm chủ đề thuộc đúng sách.

### Trang đề (`/de-thi/[id]`)

- Trái: thông tin + Menu + Giao cho + Nội dung. Phải: `?xem=` danh-sach (mặc định, `?q=` `?lop=`) / thong-ke /
  bang-xep-hang / thang-diem (số liệu ở `exam-stats.ts`). Mục chưa xây → `soonHref()`.
- Trang con: `cai-dat` (thông tin chung — sửa được cả khi đã giao), `noi-dung` (câu hỏi + đáp án + cấu trúc nhóm),
  `lam-bai-online` (cài đặt làm bài online; `giao` cũ chuyển hướng về đây), `xuat-ban` (link + mã nhúng), `hoan-tat` (sau khi tạo).
  "Copy link" = `/thi/<mã>` khi đã xuất bản (chưa thì `/lam-bai/<assignmentId>`).
- Màu nền nhạt cố định (`bg-brand-50`…) + `text-ink` bị chìm khi máy tối mà chưa bấm chọn chế độ (biến `dark:` chỉ chạy
  khi có `data-theme="dark"`) — dùng `bg-muted` / `bg-surface`.

### Làm bài online & xuất bản (`modules/publish`)

- `ExamOnlineConfig` (1–1 với đề, có `code` 6 ký tự): chế độ Kiểm tra / Luyện tập, thời gian giao đề, đối tượng
  (ALL / CLASSES / STUDENTS), số lượt, mật khẩu, giám sát rời trang, đảo đề, khi nào xem điểm / đáp án…
  `saveOnlineSettingsAction`: Lưu nháp = chỉ lưu; Xuất bản = lưu + `syncAssignments` (mỗi lớp 1 `Assignment`, còn lại 1 bài
  `classId = null` "link chung"; bài giao cũ ngoài đối tượng: chưa ai làm thì gỡ, có bài làm thì giữ).
- `Assignment.classId` và `dueAt` có thể null (không gắn lớp / không giới hạn) — luôn xử lý null. Quyền làm bài:
  `canTakeAssignment()`; link chung `/thi/[code]` tự tìm bài giao phù hợp (`resolveAssignmentForStudent`). Vẫn phải đăng nhập.
- Luật lúc làm bài / xem kết quả lấy qua `takeSettings(assignment, config)` (`publish.types.ts`, client-safe, có test) —
  đừng đọc thẳng cột config. Chưa xuất bản = bài giao kiểu cũ (1 lượt, đáp án theo `showAnswer`).
  "Khi tất cả thi xong" = sau `dueAt`. Nhiều lượt: `Submission.attempt`, thống kê / xếp hạng lấy lượt điểm cao nhất.
- Luyện tập: `PracticeTaker` từng câu, `answerPracticeAction` ghi `Answer` ngay và trả đáp án đúng — action này CHỈ chạy khi
  đề ở chế độ Luyện tập (không thì thành kênh dò đáp án). `gradeAndSubmit` giữ nguyên câu đã ghi.
- Giá (`Exam.priceMode/price/priceNote`): CHỈ lưu + hiển thị (`PriceNotice`), chưa thu tiền. `priceNote` qua `sanitizeRichText`.
- Mục đích tạo đề: `Exam.purpose` là mã chuỗi trong `EXAM_PURPOSE_GROUPS` (`common/enums`), chọn bằng `PurposeSelect`;
  bài tập vẫn dùng enum `HomeworkPurpose`.
- Đảo đề: `shuffleGroups` = đổi chỗ các khối; tắt thì nhóm đứng yên, chỉ đảo câu trong nhóm / câu đứng riêng liền nhau.
- Chưa làm: chèn PowerPoint, làm bài không cần tài khoản, thu tiền online.

### In đề & phân tích cấu trúc (`/de-thi/[id]/in-de`, `/phan-tich`)

- In đề: `GET /api/exams/:id/print` → 1 file .docx (các mã đề đã đảo + phiếu trả lời + trang đáp án), dựng ở `exam-print.ts`
  (server, thư viện docx). Tùy chọn + `buildVersions()` ở `exam-print.types.ts` (client-safe): thứ tự mỗi mã đề CỐ ĐỊNH theo
  (id đề, mã đề) nên in lại ra đúng đề cũ; nhóm câu giữ vị trí. Mã mặc định 101, 102…; tối đa 24 đề.
- Phiếu trả lời là mẫu TỰ THIẾT KẾ (tô ô tròn / ghi chữ cái) — chỉ in + chấm tay, CHƯA chấm từ ảnh scan.
- Phân tích cấu trúc: `exam-analysis.ts` (hàm thuần) tổng hợp theo mức độ / nhóm; `updateQuestionLevelsAction` sửa mức độ
  được cả khi đề đã giao (không đụng điểm). Điểm từng câu vẫn chỉ sửa ở trình soạn đề.
- Thêm Server Action mới mà gọi bị lỗi `Cannot read properties of undefined (reading 'apply')` → dev server giữ bản cũ:
  tắt dev, xóa `.next`, chạy lại.

### Danh sách lớp (`/lop-hoc`, `modules/classes`)

- Giáo viên/Admin thấy `ClassBoard`; học sinh giữ trang cũ (vào lớp bằng mã). Lớp có `schoolYear` ("2026-2027",
  đổi năm học từ tháng 8 — `class-board.ts`) và `groupId` (`ClassGroup` của giáo viên, null = "Khác").
- Nút "Thêm": tạo nhiều lớp (mỗi dòng 1 tên) · Excel (`GET /api/classes/template`, `POST /api/classes/import` chỉ đọc
  xem trước → `importClassesAction`) · lớp cho khóa mới (`promoteClassesAction`: tạo lớp năm học mới, tên gợi ý
  `nextClassName`, chép học sinh) · tạo nhóm.

### Quản lý giáo viên (`/quan-ly-giao-vien`, `modules/teachers`)

- Mô hình: 1 tài khoản giáo viên (thường VIP, dùng chung trên vài thiết bị) quản lý các giáo viên khác. Quyền `teacher.manage`.
- `ManagedTeacher` = bản ghi quản lý (họ tên + SĐT **đúng 10 số** hoặc email — `contactSchema`), KHÔNG cần / KHÔNG tạo tài khoản.
  Trùng SĐT/email trong danh sách bị chặn. Trùng tài khoản giáo viên có sẵn thì tự liên kết `teacherId` (null = giáo viên ảo).
  `TeacherGroup` + `ClassPermission` cấp lớp của mình cho nhóm HOẶC 1 giáo viên (CHECK đúng 1 cột).
  Excel: `GET /api/teachers/template`, `POST /api/teachers/import` (chỉ xem trước) → `importTeachersAction`.
- Người được phân quyền (chỉ khi có liên kết tài khoản; trực tiếp / qua nhóm): thấy lớp, giao đề, xem kết quả — KHÔNG `class.update`. Kiểm tra bằng
  `can(user, perm, { ownerId, sharedWith })`, `sharedWith` lấy từ `classSharedWith()` / `getClassAccess()`
  (`class-sharing.service.ts`); danh sách lớp dùng `sharedClassWhere()`. Trên `/lop-hoc` hiện ở mục "Lớp được phân quyền".
- Phân quyền khóa học: tab có sẵn, chờ module Khóa học.

### Ngân hàng câu hỏi riêng (`/ngan-hang`, `modules/banks`)

- Khác "Ngân hàng chung" (`QuestionBankNode`/`BankQuestion`, chỉ đọc, ở `/de-thi/ngan-hang-chung`): mỗi giáo viên có
  `QuestionBank` → `BankSection` (chương/bài lồng nhau, `order`) → `BankItem` (trắc nghiệm 1 đáp án: `options[]` + `correctIndex`,
  `level`). `BankActivity` = tab "Các hoạt động" (ghi qua `logActivity`). Quyền `bank.manage` (OWN). Không có Phân quyền / Chia sẻ.
- `bookId` trỏ nút gốc sách của Ngân hàng chung → "Tạo cấu trúc theo sách" chép chủ đề → bài (bỏ tầng dạng). Hiện chỉ có Toán 1 KNTT.
- Xóa chương/bài: câu bên trong về "Chưa xếp bài" (`sectionId = null`), không mất câu.
- Nhập câu (`/nhap`): dùng `parseExamText` ở client + `POST /api/exams/import` để đọc file; nhóm câu → ghép lời dẫn vào nội dung.
- Tạo đề: tự chọn (`/tu-chon`, giữ thứ tự chọn) / ma trận (`/ma-tran`, bốc ngẫu nhiên theo bài × mức độ, chỉ câu nằm trực tiếp
  trong mục) → `createExamFromItems` lấy lại câu từ DB, tổng 10 điểm, đề ở thư mục gốc.

### Kho nội dung (`/kho-noi-dung`, `modules/content`)

- `ContentItem` kind: `EXAM` (trỏ đề có sẵn, examId) · `REFERENCE` / `SLIDE` / `LESSON_PLAN` (file qua `POST /api/files`, fileId unique)
  · `VIDEO` — **CHỈ lưu link** (http/https), bấm mở tab mới qua `/api/kho-noi-dung/:id/tai-ve` (302, đếm lượt). Không nhúng, không tải video lên.
- Quyền: `content.view` (giáo viên = ALL, học sinh không có) · `content.share` (OWN — gỡ được mục của mình, xóa mềm).
  `canReadFile` cho người có `content.view` đọc file / audio đề đã lên kho (gỡ rồi thì lại riêng tư).
- URL `?loai=de-thi|tham-khao|video|slide|ke-hoach|moi-nhat|cua-toi&khoi=0..12&q=`; `?dong-gop=<examId>` mở sẵn hộp đóng góp
  (nút "Chia sẻ" ở trang đề). Kiểu / nhãn client-safe ở `content.types.ts`.
- Tải đề = .docx sinh từ `serializeExam` (`exam-docx.ts`) → nhập lại được bằng bộ đọc đề. "Lưu về thư viện" = `copyContentExam`
  chép nhóm + câu + đáp án thành đề mới (thư mục gốc) của người lưu.

### Phiếu bài tập & ngân hàng câu hỏi (`modules/worksheet`, `prisma/question-bank`)

- Cây kiến thức `QuestionBankNode`: sách (gốc) → chủ đề → bài → dạng (lá). Câu hỏi `BankQuestion` gắn ở lá.
- Mọi câu (kể cả "điền chỗ trống") đều lưu `options + correctIndex` → đổi được sang đề trắc nghiệm online.
- Nội dung mẫu Toán 1 – KNTT do `prisma/question-bank/toan1-kntt.ts` **tự sinh** (RNG seed cố định), chạy
  trong `db:seed`. Thêm sách mới: viết file tương tự rồi gọi trong `seed-question-bank.ts`.
- Phiếu đang soạn chỉ nằm ở client (localStorage nháp). Tạo đề thi online: server **lấy lại câu từ DB**
  theo id, không tin nội dung client gửi. Xuất docx chạy trên trình duyệt (`worksheet.docx.ts`).
- `npm run verify` tính lại toàn bộ phép tính trong ngân hàng để bắt bộ sinh sai đáp án.

### Dữ liệu

- Ngày giờ lưu UTC, hiển thị `Asia/Ho_Chi_Minh` qua `formatDate` / `formatDateTime`.
- Ô `datetime-local` dùng `parseVnDateTimeLocal` / `toVnDateTimeLocal` — không `new Date(value)`.
- Soft delete: query mặc định lọc `deletedAt: null`.
- Model PascalCase · bảng snake_case qua `@@map` · enum SCREAMING_SNAKE.

### Điều hướng & thêm trang mới

- `src/config/navigation.ts` là nguồn chung cho sidebar, các ô ở trang Tổng quan và tiêu đề header.
- Chức năng chưa xây dùng `href: soon("Tên")` → trang `/sap-ra-mat`. Xây xong thì đổi `href` sang route
  thật và thêm `{ prefix, title }` vào `EXTRA_TITLES` nếu cần tiêu đề header riêng.
- Ô/mục ẩn theo `permission`. Admin không có quyền người học (`class.join`, `submission.take`).

### Giao diện

- Toàn bộ tiếng Việt.
- Màu dùng token (`bg-brand-600`, `text-ink`, `border-line`, `bg-surface`) — không hard-code hex.
  Bảng màu ở `src/app/globals.css`.
- Chế độ tối: `<html data-theme="light|dark">` do `ThemeToggle` đặt, lưu localStorage; chưa chọn thì
  theo hệ điều hành. Màu nền/chữ/viền tự đổi qua biến CSS; màu riêng cho chế độ tối dùng tiền tố `dark:`.
