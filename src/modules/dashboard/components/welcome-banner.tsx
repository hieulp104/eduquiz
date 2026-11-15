/** Băng chào mừng đầu trang Tổng quan. */
export function WelcomeBanner({ fullName, subtitle }: { fullName: string; subtitle: string }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-linear-to-r from-navy-950 via-navy-800 to-brand-800 px-6 py-6 text-white">
      {/* Vòng tròn trang trí góc phải */}
      <span
        aria-hidden
        className="absolute top-1/2 -right-16 size-64 -translate-y-1/2 rounded-full bg-white/5 sm:right-0 sm:size-72 sm:translate-x-1/3"
      />
      <h1 className="relative text-lg font-bold">
        Chào mừng trở lại, {fullName} <span aria-hidden>👋</span>
      </h1>
      <p className="relative mt-1.5 text-sm text-white/80 sm:text-base">{subtitle}</p>
    </section>
  );
}
