import type { Metadata } from "next";
import Link from "next/link";

const url="https://sanjipick.blendpunch.com/group-buy";
export const metadata: Metadata={
 title:"농산물·수산물 공동구매 안내 | 산지픽",
 description:"산지픽에서 제철 농산물·수산물 공동구매 상품을 찾아보세요. 원산지, 구성·중량, 보관법, 배송 일정과 공구 기간을 확인하는 방법을 안내합니다.",
 alternates:{canonical:url},
 openGraph:{title:"제철 농산물·수산물 공동구매 | 산지픽",description:"제철 먹거리 공동구매를 고르는 기준과 상품별 정보 확인 방법을 안내합니다.",url,type:"website"},
};
export default function SanjiGroupBuyGuide(){
 return <main className="sanji-storefront mx-auto w-full max-w-3xl px-5 py-10 sm:py-16" style={{color:"#342c23",background:"#fff"}}>
  <p className="text-sm font-semibold" style={{color:"#a36252"}}>SANJI PICK GUIDE</p>
  <h1 className="mt-3 text-3xl sm:text-4xl font-bold leading-snug">제철 농산물·수산물<br/>공동구매 안내</h1>
  <p className="mt-5 text-base leading-8 text-stone-600">산지픽에서는 농산물과 수산물의 구성·가격·공구 일정을 비교할 수 있습니다. 구매 전에 원산지와 중량, 배송 조건을 상품별로 확인하세요.</p>
  <nav aria-label="먹거리 공동구매 바로가기" className="mt-8 flex flex-wrap gap-3">
   <Link className="rounded-full bg-orange-700 px-5 py-3 font-semibold text-white" href="/products?category=produce">농산물 공동구매 →</Link>
   <Link className="rounded-full border border-stone-300 px-5 py-3 font-semibold" href="/products?category=seafood">수산물 공동구매 →</Link>
   <Link className="rounded-full border border-stone-300 px-5 py-3 font-semibold" href="/products">전체 공구 보기 →</Link>
  </nav>
  <section className="mt-12"><h2 className="text-2xl font-bold">먹거리 공구, 이렇게 고르세요</h2><div className="mt-5 grid gap-4">{[
    ["01 · 원산지와 구성 확인","농산물과 수산물의 원산지, 중량, 옵션별 구성을 상품 상세에서 확인합니다."],
    ["02 · 공구 일정 확인","판매 시작·종료일, 재고 및 마감 상태를 확인합니다. 마감된 공구는 구매할 수 없을 수 있습니다."],
    ["03 · 배송·보관 안내 확인","출고 예정일과 배송비, 냉장·냉동 등 보관 조건은 상품마다 다르므로 각 상세 안내를 확인합니다."]
  ].map(([heading,body])=><article key={heading} className="rounded-2xl border border-stone-200 p-5"><h3 className="font-bold">{heading}</h3><p className="mt-2 leading-7 text-stone-600">{body}</p></article>)}</div></section>
  <section className="mt-12 rounded-2xl bg-orange-50 p-6"><h2 className="text-xl font-bold">산지픽 이야기</h2><p className="mt-3 leading-7 text-stone-600">산지에서 시작해 우리 식탁으로 이어지는 먹거리의 이야기도 만나보세요.</p><Link href="/about" className="mt-4 inline-block font-semibold underline">산지 이야기 보기 →</Link></section>
  <div className="mt-8 text-sm text-stone-600"><Link href="https://shop.blendpunch.com/group-buy" className="underline">생활용품·숙박 공동구매는 블랜드픽에서 확인하기 →</Link></div>
 </main>;
}
