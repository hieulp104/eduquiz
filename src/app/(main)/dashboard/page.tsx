import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { hasPermission, type SessionUser } from "@/common/permissions/permissions";
import {
  DASHBOARD_SECTIONS,
  FOOTER_LINKS,
  QUICK_LINKS,
  type Feature,
} from "@/config/navigation";
import { FeatureIcon } from "@/components/layout/feature-icon";
import { WelcomeBanner } from "@/modules/dashboard/components/welcome-banner";
import { FeatureTile, QuickLinkTile } from "@/modules/dashboard/components/feature-tile";
import { listAssignmentsForStudent } from "@/modules/assignments/assignments.service";
import { StudentAssignmentList } from "@/modules/assignments/components/student-assignment-list";

export const metadata: Metadata = { title: "Màn hình chính" };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-lg font-medium text-ink">{children}</h2>;
}

const GRID = "grid grid-cols-2 gap-4 lg:grid-cols-4";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowed = (f: Feature) => !f.permission || hasPermission(user as SessionUser, f.permission);
  const sections = DASHBOARD_SECTIONS.map((s) => ({ ...s, items: s.items.filter(allowed) })).filter(
    (s) => s.items.length > 0,
  );
  const quickLinks = QUICK_LINKS.filter(allowed);

  const isLearner = hasPermission(user, "submission.take");
  const assignments = isLearner ? await listAssignmentsForStudent(user.id) : null;

  return (
    // Màn 1920px: nội dung 1412px căn giữa, còn ~200px mỗi bên — giống mẫu.
    <div className="mx-auto w-full max-w-[1412px] space-y-7 pb-4">
      <WelcomeBanner
        fullName={user.fullName}
        subtitle={
          hasPermission(user, "class.create")
            ? "Quản lý lớp học, đề thi và bài tập của bạn một cách hiệu quả"
            : "Theo dõi bài được giao và kết quả học tập của bạn"
        }
      />

      {assignments && (
        <section>
          <SectionTitle>Bài được giao</SectionTitle>
          <StudentAssignmentList items={assignments} now={new Date()} />
        </section>
      )}

      {sections.map((section) => (
        <section key={section.title}>
          <SectionTitle>{section.title}</SectionTitle>
          <div className={GRID}>
            {section.items.map((f) => (
              <FeatureTile key={f.label} feature={f} />
            ))}
          </div>
        </section>
      ))}

      {quickLinks.length > 0 && (
        <section>
          <SectionTitle>Truy cập nhanh</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickLinks.map((l) => (
              <QuickLinkTile key={l.label} link={l} />
            ))}
          </div>
        </section>
      )}

      <footer className="flex gap-2 pt-2">
        {FOOTER_LINKS.map((f) => (
          <Link
            key={f.label}
            href={f.href}
            title={f.label}
            aria-label={f.label}
            className="rounded-full p-2 text-ink-soft hover:bg-muted hover:text-brand-700"
          >
            <FeatureIcon name={f.icon} className="size-5" />
          </Link>
        ))}
      </footer>
    </div>
  );
}
