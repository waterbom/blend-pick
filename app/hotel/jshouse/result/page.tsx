import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentSite } from "@/lib/site-server";
import { Fonts } from "@/components/jshouse/Sections";
import StayResult from "@/components/jshouse/Result";
import "@/components/jshouse/jshouse.css";

// JS하우스 카드 결제 결과 — 토스 결제창에서 돌아와 승인·예약 확정을 보여 주는 화면 (검색 노출 안 함)
export const metadata: Metadata = { title: "JS하우스 예약 확인", robots: { index: false, follow: false } };

export default async function JsHouseResultPage() {
  if ((await currentSite()).key !== "blendpick") notFound();
  return <div className="jsh">
    <Fonts />
    <StayResult />
  </div>;
}
