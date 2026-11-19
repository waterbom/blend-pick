import { notFound } from "next/navigation";
import { currentAdminSite } from "@/lib/admin-site";
import LimenAdmin from "@/components/limen/Admin";

// LIMEN 예약 관리 — 블랜드픽 관리자에서만 열린다
export const metadata = { title: "LIMEN 예약 관리" };
export default async function Page() {
  if ((await currentAdminSite()).key !== "blendpick") notFound();
  return <LimenAdmin />;
}
