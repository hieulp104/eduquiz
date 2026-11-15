import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { AppShell } from "@/components/layout";
import { hasPermission, PERMISSIONS, ROLE_LABEL } from "@/common/permissions/permissions";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowedPermissions = PERMISSIONS.map((p) => p.code).filter((code) =>
    hasPermission(user, code),
  );

  return (
    <AppShell
      allowedPermissions={allowedPermissions}
      fullName={user.fullName}
      roleLabel={ROLE_LABEL[user.role]}
    >
      {children}
    </AppShell>
  );
}
