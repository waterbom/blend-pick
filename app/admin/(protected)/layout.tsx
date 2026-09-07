import { currentAdminSite } from "@/lib/admin-site";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminToken } from "@/lib/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const site = await currentAdminSite();
  const cookieStore = await cookies();

  // admin_token 우선 체크
  const adminToken = cookieStore.get("admin_token")?.value;
  if (adminToken) {
    const admin = await verifyAdminToken(adminToken);
    if (admin) {
      return (
        <div className="min-h-screen md:flex" style={{ background: site.key === "sanjipick" ? "#F3F0E8" : "#F3F4F6" }}>
          <AdminSidebar siteKey={site.key} />
          <main className="flex-1 p-4 md:p-8 overflow-auto">{children}</main>
        </div>
      );
    }
  }

  redirect("/login?redirect=%2Fadmin");
}
