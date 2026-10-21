import type { Metadata } from "next";
import SanjiStory from "@/components/sanji/SanjiStory";
import { sanjiLinkBase } from "@/lib/sanji-link";

const title = "산지 이야기 — 산지에서 시작해, 우리의 한 끼로";
const description = "밭과 바다의 먹거리를 함께 고르는 즐거움. 산지와 구성, 공구 일정까지 살펴보고 필요한 때에 만나는 산지픽의 이야기를 소개합니다.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://sanjipick.blendpunch.com/about" },
  openGraph: {
    title,
    description,
    url: "https://sanjipick.blendpunch.com/about",
    siteName: "산지픽",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "https://sanjipick.blendpunch.com/sanji/story/table-v1.webp", width: 960, height: 640, alt: "식탁 위에 놓인 제철 먹거리의 연출 이미지" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["https://sanjipick.blendpunch.com/sanji/story/table-v1.webp"] },
};

// Keep story links on the current storefront, including /sanji previews on the Blendpick host.
export default async function SanjiAbout() {
  return <SanjiStory linkBase={await sanjiLinkBase()} />;
}
