import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminToken } from "@/lib/auth";
import { currentAdminSite } from "@/lib/admin-site";
import { getTodayWork } from "@/lib/operations";
import TodayWork from "@/components/admin/TodayWork";

export const dynamic = "force-dynamic";
export default async function OperationsPage() {
  // 레이아웃과 별개로, 조회 전에 인증한다 (병렬 서버 렌더링에서도 보호).
  const token = (await cookies()).get("admin_token")?.value;
  if (!token || !(await verifyAdminToken(token))) redirect("/login?redirect=%2Fadmin%2Foperations");
  const site = await currentAdminSite();
  const groups = await getTodayWork(site.key);
  return <TodayWork siteName={site.name} groups={groups} updatedAt={new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} />;
}
