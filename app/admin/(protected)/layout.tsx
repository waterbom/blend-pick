import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminToken, verifyToken } from "@/lib/auth";
import AdminSidebar from "@/components/admin/AdminSidebar";

const ADMIN_EMAIL = "admin@blendpick.com";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();

  // admin_token 우선 체크
  const adminToken = cookieStore.get("admin_token")?.value;
  if (adminToken) {
    const admin = await verifyAdminToken(adminToken);
    if (admin) {
      return (
        <div className="flex min-h-screen bg-gray-100">
          <AdminSidebar  />
          <main className="flex-1 p-8 overflow-auto">{children}</main>
        </div>
      );
    }
  }

  // shop_token으로 admin@blendpick.com 여부 체크
  const shopToken = cookieStore.get("shop_token")?.value;
  if (shopToken) {
    const payload = await verifyToken(shopToken);
    if (payload?.email === ADMIN_EMAIL) {
      return (
        <div className="flex min-h-screen bg-gray-100">
          <AdminSidebar />
          <main className="flex-1 p-8 overflow-auto">{children}</main>
        </div>
      );
    }
  }

  redirect("/admin/login");
}
