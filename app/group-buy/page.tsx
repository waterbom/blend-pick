import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";

const url = "https://shop.blendpunch.com/group-buy";
export const metadata: Metadata = {
  title: "공동구매란? 진행 중인 공구와 참여 방법 | 블랜드픽",
  description: "공동구매 뜻부터 상품 선택, 공구 기간 확인, 결제와 배송·취소 안내까지. 블랜드픽에서 생활용품·숙박 공동구매 상품을 확인하고 안전하게 참여하세요.",
  alternates: { canonical: url },
  openGraph: { title: "공동구매 안내 | 블랜드픽", description: "공동구매 참여 방법과 진행 중인 상품·숙박 공구를 살펴보세요.", url, type: "website" },
};
const faq = [
  { question: "공동구매란 무엇인가요?", answer: "여러 구매자의 참여를 바탕으로 정해진 기간과 조건에 따라 상품이나 서비스를 판매하는 방식입니다. 실제 가격과 혜택은 공구별 안내를 확인해야 합니다." },
  { question: "진행 중인 공동구매는 어디서 확인하나요?", answer: "블랜드픽 상품 목록에서 판매 중인 공구와 마감된 공구를 구분해 확인할 수 있습니다. 호텔·숙박 공동구매는 숙박 메뉴에서 따로 확인하세요." },
  { question: "공구 상품은 어떻게 구매하나요?", answer: "상품 상세에서 옵션·가격·공구 일정·배송/환불 조건을 확인한 다음 주문 및 결제를 진행합니다. 공구 기간이 종료되면 구매가 제한될 수 있습니다." },
  { question: "공동구매 상품도 취소나 환불이 가능한가요?", answer: "상품 유형, 결제·배송 상태, 적용 법령과 안내된 정책에 따라 달라집니다. 구매 전에 해당 상품의 교환·반품·환불 안내를 확인하세요." },
];
export default function GroupBuyGuide() {
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(f=>({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer }})) };
  return <><Header /><main className="mx-auto w-full max-w-4xl px-5 py-12 sm:py-20" style={{color:"var(--text-primary)"}}>
    <p className="text-sm font-semibold tracking-wide" style={{color:"var(--accent)"}}>GROUP BUY GUIDE</p>
    <h1 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight">공동구매란?<br />블랜드픽 공구 참여 안내</h1>
    <p className="mt-6 max-w-2xl leading-8" style={{color:"var(--text-secondary)"}}>생활용품부터 호텔·독채 숙박까지. 공동구매의 뜻과 참여 방법을 알아보고 현재 진행 중인 상품과 이용 조건을 확인하세요.</p>
    <div className="mt-9 flex flex-wrap gap-3"><Link className="rounded-full px-6 py-3 text-white font-semibold" style={{background:"var(--accent)"}} href="/products">진행 중인 공구 보기 →</Link><Link className="rounded-full border px-6 py-3 font-semibold" href="/hotel">호텔·숙박 공구 보기 →</Link></div>
    <section className="mt-16"><h2 className="text-2xl font-bold">공동구매 참여 방법</h2><ol className="mt-5 grid gap-4 sm:grid-cols-3">{[{title:"01 · 공구 찾기",body:"상품 목록에서 원하는 구성과 진행 상태를 확인합니다."},{title:"02 · 조건 비교",body:"옵션 가격, 판매 기간, 배송·환불 조건을 확인합니다."},{title:"03 · 주문하기",body:"판매 가능 기간에 결제하고 주문·배송 정보를 조회합니다."}].map(x=><li key={x.title} className="rounded-2xl border p-5"><h3 className="font-bold">{x.title}</h3><p className="mt-2 text-sm leading-7" style={{color:"var(--text-secondary)"}}>{x.body}</p></li>)}</ol></section>
    <section className="mt-16"><h2 className="text-2xl font-bold">자주 묻는 질문</h2><div className="mt-4 divide-y">{faq.map(f=><div key={f.question} className="py-5"><h3 className="font-bold">{f.question}</h3><p className="mt-2 leading-7" style={{color:"var(--text-secondary)"}}>{f.answer}</p></div>)}</div></section>
    <section className="mt-12 rounded-2xl p-7" style={{background:"var(--surface)"}}><h2 className="text-xl font-bold">나에게 맞는 공동구매 찾아보기</h2><p className="mt-3 leading-7">지금 판매 중인 상품과 지난 공구를 비교하고, 상세 페이지에서 상품별 조건을 확인하세요.</p><div className="mt-5 flex flex-wrap gap-5"><Link className="underline font-semibold" href="/products">상품 공동구매 →</Link><Link className="underline font-semibold" href="/hotel">숙박 공동구매 →</Link><Link className="underline font-semibold" href="https://sanjipick.blendpunch.com/group-buy">농산물·수산물 공동구매 →</Link></div></section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd).replace(/</g,"\\u003c")}} />
  </main></>;
}
