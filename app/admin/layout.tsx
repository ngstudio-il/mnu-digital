import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/admin";
import AdminShell from "@/components/admin/AdminShell";

export const metadata = { title: "Admin · mnu.digital", robots: { index: false } };
export const dynamic = "force-dynamic";

// Only emails listed in public.admins (with a confirmed address) get past this point.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) notFound();
  return <AdminShell email={admin.user.email ?? ""}>{children}</AdminShell>;
}
