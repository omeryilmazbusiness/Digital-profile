import { redirect } from "next/navigation";

import { adminHref } from "@/features/admin/paths";

import { localeOf } from "../../locale";

export default async function AdminHome({ params }: PageProps<"/sheraton/[locale]/admin">) {
  redirect(adminHref(await localeOf(params), "/discover"));
}
