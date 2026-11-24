import type { Metadata } from "next";
import Link from "next/link";
import { Be_Vietnam_Pro } from "next/font/google";
import { BrandLogo, ThemeToggle, APP_NAME } from "@/components/theme";
import { auth } from "@/modules/auth/auth.service";
import { SubjectDemo } from "./subject-demo";

export const metadata: Metadata = {
  title: "Giới thiệu",
  description:
    "EduQuiz — ra đề, giao bài và chấm điểm trắc nghiệm cho mọi môn học.",
};

// Font tiêu đề thiết kế riêng cho tiếng Việt — dấu đặt gọn, đậm đẹp ở cỡ lớn.
const display = Be_Vietnam_Pro({
  variable: "--font-heading",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700"],
});

/** Quy trình thật của một bài kiểm tra — có thứ tự nên đánh số. */
const STEPS = [
  {
    title: "Soạn đề",
    text: "Dán văn bản hoặc tải file Word, Excel, LaTeX. Câu hỏi, phương án và đáp án được nhận ra tự động.",
  },
  {
    title: "Giao bài",
    text: "Chọn lớp, đặt giờ mở đề và hạn nộp. Mỗi học sinh nhận một thứ tự câu và đáp án riêng.",
  },
  {
    title: "Làm bài",
    text: "Học sinh làm trên điện thoại hoặc máy tính, có đồng hồ đếm ngược và cảnh báo khi rời trang.",
  },
  {
    title: "Chấm và phân tích",
    text: "Nộp bài là có điểm. Giáo viên xem phổ điểm, xếp hạng và tỉ lệ đúng của từng câu.",
  },
];

/** Hỗ trợ theo môn — chỉ ghi những gì app làm được thật. */
const SUBJECTS = [
  {
    name: "Toán, Vật lý, Hóa học",
    points: [
      "Nhập đề từ file LaTeX",
      "Ngân hàng câu hỏi theo bài, theo mức độ nhận biết – thông hiểu – vận dụng",
    ],
  },
  {
    name: "Tiếng Anh",
    points: [
      "Gắn file nghe cho từng câu hoặc cả nhóm câu",
      "Giữ chữ gạch chân, in đậm cho câu phát âm, trọng âm",
      "Đoạn đọc hiểu dùng chung cho nhiều câu",
    ],
  },
  {
    name: "Lịch sử, Địa lý, GDCD",
    points: [
      "Một đoạn tư liệu đi kèm nhiều câu hỏi",
      "Đảo đề nhưng nhóm câu tư liệu vẫn đi liền nhau",
    ],
  },
  {
    name: "Ngữ văn",
    points: [
      "Đoạn trích đọc hiểu dùng chung",
      "Câu hỏi tới 8 phương án, từ A đến H",
    ],
  },
];

export default async function IntroPage() {
  const session = await auth();
  const loggedIn = Boolean(session?.user);
  const href = loggedIn ? "/dashboard" : "/login";
  const label = loggedIn ? "Vào trang tổng quan" : "Đăng nhập";

  return (
    <div className={`${display.variable} min-h-screen overflow-x-hidden`}>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <BrandLogo />
          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link
              href={href}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              {label}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Mở đầu: chọn môn, xem câu hỏi + phiếu tô được chấm ── */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:pt-20">
          <div>
            <h1 className="font-display text-4xl leading-[1.12] font-bold text-balance text-ink sm:text-5xl">
              Ra đề, giao bài và chấm điểm trắc nghiệm cho mọi môn học.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-pretty text-ink-soft">
              Dán đề từ Word, giao cho lớp bằng một đường link. Học sinh nộp bài
              là có điểm, giáo viên thấy ngay câu nào cả lớp còn yếu.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-6">
              <Link
                href={href}
                className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                {loggedIn ? label : "Bắt đầu soạn đề"}
              </Link>
              <a
                href="#quy-trinh"
                className="rounded font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
              >
                Xem quy trình
              </a>
            </div>
          </div>

          <SubjectDemo />
        </section>

        {/* ── Quy trình 4 bước ── */}
        <section
          id="quy-trinh"
          className="scroll-mt-6 border-y border-line bg-surface"
        >
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="font-display max-w-xl text-3xl font-bold text-balance text-ink">
              Một bài kiểm tra, từ lúc soạn đến lúc có điểm
            </h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-4 md:gap-6">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative md:pr-4">
                  <div className="flex items-center gap-3">
                    <span className="font-display flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-brand-600 text-sm font-bold text-brand-600 dark:border-brand-300 dark:text-brand-300">
                      {i + 1}
                    </span>
                    {i < STEPS.length - 1 && (
                      <span
                        aria-hidden
                        className="hidden h-px flex-1 bg-line md:block"
                      />
                    )}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-ink">
                    {s.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-pretty text-ink-soft">
                    {s.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Theo từng môn ── */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-16">
            <div>
              <h2 className="font-display text-3xl font-bold text-balance text-ink">
                Mỗi môn một kiểu đề
              </h2>
              <p className="mt-4 max-w-sm leading-relaxed text-pretty text-ink-soft">
                Môn nào cũng dùng chung đảo đề, chấm tự động, thống kê và in
                nhiều mã đề. Ngoài ra, mỗi môn có thêm những thứ riêng.
              </p>
            </div>
            <dl className="divide-y divide-line border-y border-line">
              {SUBJECTS.map((s) => (
                <div
                  key={s.name}
                  className="grid gap-2 py-6 sm:grid-cols-[12rem_1fr] sm:gap-6"
                >
                  <dt className="font-display font-semibold text-ink">
                    {s.name}
                  </dt>
                  <dd>
                    <ul className="space-y-1.5">
                      {s.points.map((p) => (
                        <li key={p} className="flex gap-2.5 text-ink-soft">
                          <span
                            aria-hidden
                            className="mt-[0.45rem] size-2 shrink-0 rounded-full bg-brand-600 dark:bg-brand-300"
                          />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── Kết ── */}
        <section className="bg-navy-950">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:flex-row sm:items-center sm:px-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-balance text-white sm:text-3xl">
                Bắt đầu với đề kiểm tra tiếp theo của bạn
              </h2>
              <p className="mt-2 text-pretty text-brand-100">
                Tài khoản do nhà trường cấp. Đăng nhập bằng email, số điện thoại
                hoặc tên đăng nhập.
              </p>
            </div>
            <Link
              href={href}
              className="shrink-0 rounded-lg bg-white px-6 py-3 font-semibold text-navy-950 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {label}
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-6 text-sm text-ink-faint sm:px-6">
        <span>
          © {new Date().getFullYear()} {APP_NAME}
        </span>
        <ThemeToggle className="sm:hidden" />
      </footer>
    </div>
  );
}
