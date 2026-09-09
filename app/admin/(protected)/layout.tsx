import '../commerce.css';
import AdminWorkspaceHeader from '@/components/admin/AdminWorkspaceHeader';
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
        <div className="admin-commerce" data-admin-site={site.key}>
          <AdminSidebar siteKey={site.key} />
          <main className="commerce-main"><AdminWorkspaceHeader siteKey={site.key} /><div className="commerce-content">{children}</div></main>
        </div>
      );
    }
  }

  redirect("/login?redirect=%2Fadmin");
}
