import type { Metadata } from "next";
import Header from "@/components/Header";
import SupplierPage from "@/components/blend/SupplierPage";

export const metadata: Metadata = {
  title: "공급사 제안 · 블랜드픽",
  description: "생활용품과 뷰티, 식품, 숙박부터 교육·클래스와 서비스까지. 블랜드픽과 함께 소개할 새로운 공동구매를 제안해 주세요.",
  alternates: { canonical: "/suppliers" },
  openGraph: {
    title: "좋은 제안이라면, 블랜드픽.",
    description: "물건부터 머무는 하루, 배우는 경험까지. 공동구매의 새로운 가능성을 함께 만들어가요.",
    url: "/suppliers",
  },
};

export default function SuppliersPage() {
  return (
    <>
      <Header variant="discovery" />
      <SupplierPage />
    </>
  );
}
