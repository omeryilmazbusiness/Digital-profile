import { AdminShell } from "@/features/admin/admin-shell";
import { AdminSession } from "@/features/admin/session";
import { adminStrings } from "@/features/admin/strings";

import { localeOf } from "../../../locale";

/** Every page behind sign-in shares one session check and one frame. */
export default async function PanelLayout({
  children,
  params,
}: LayoutProps<"/sheraton/[locale]/admin">) {
  const locale = await localeOf(params);
  return (
    <AdminSession locale={locale} t={adminStrings(locale)}>
      <AdminShell>{children}</AdminShell>
    </AdminSession>
  );
}
