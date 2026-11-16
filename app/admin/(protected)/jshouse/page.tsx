import { notFound } from "next/navigation";
import { currentAdminSite } from "@/lib/admin-site";
import JsHouseAdmin from "@/components/jshouse/Admin";

// JS하우스 예약 관리 — 블랜드픽 관리자에서만 열린다
export const metadata = { title: "JS하우스 예약 관리" };
export default async function Page() {
  if ((await currentAdminSite()).key !== "blendpick") notFound();
  return <JsHouseAdmin />;
}
