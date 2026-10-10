import { Suspense } from "react";

import { LoginScreen } from "@/features/admin/login-screen";
import { adminStrings } from "@/features/admin/strings";

import { localeOf } from "../../../locale";

export default async function LoginPage({ params }: PageProps<"/sheraton/[locale]/admin/login">) {
  const locale = await localeOf(params);
  return (
    <Suspense>
      <LoginScreen locale={locale} t={adminStrings(locale)} />
    </Suspense>
  );
}
