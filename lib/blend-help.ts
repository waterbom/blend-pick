import { kakaoChannelUrl } from "@/lib/kakao-commerce";
import { SITES } from "@/lib/sites";

/** Public, deterministic help only. Never reads an order or sends a message. */
export type HelpReply = {
  answer: string;
  links: { label: string; href: string }[];
};

type HelpTopic = HelpReply & { id: string; question: string };

const contactLink = {
  label: "카카오톡 상담",
  href: kakaoChannelUrl(SITES.blendpick.kakaoUrl) ?? "https://pf.kakao.com/_VyING/chat",
};
const orderLink = { label: "주문·배송 조회", href: "/orders/lookup" };
const productLink = { label: "공구 상품 보기", href: "/products" };
const dangungLink = { label: "단궁 예약 조회", href: "/hotel/dangung/result" };
const utopLink = { label: "유탑 예약 조회", href: "/hotel/lookup" };

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "orders",
    question: "주문·배송은 어디서 확인하나요?",
    answer: "주문·배송 조회에서 주문할 때 입력한 휴대폰 번호로 인증하면 주문 내역과 배송 상태를 확인할 수 있어요. 개별 주문 정보는 이 채팅에서 조회하지 않아요. 조회되지 않거나 배송 상태가 궁금하면 카카오톡으로 문의해 주세요.",
    links: [orderLink, contactLink],
  },
  {
    id: "shipping",
    question: "출고 일정과 배송비가 궁금해요",
    answer: "출고 일정은 상품 상세의 배송 안내에서, 배송비는 상품 상세와 최종 주문서에서 확인해 주세요. 상품 구성·수량·배송 지역에 따라 비용이 달라질 수 있어요. 정확한 도착일은 여기서 확인할 수 없어요. 이미 주문했다면 주문·배송 조회를 이용해 주세요.",
    links: [productLink, orderLink, contactLink],
  },
  {
    id: "refunds",
    question: "상품 취소·교환·환불은 어떻게 하나요?",
    answer: "일반 상품은 주문·배송 조회에서 주문 상태와 취소 또는 취소 요청 가능 여부를 확인해 주세요. 출고 상태에 따라 확인 절차가 달라질 수 있어요. 교환·반품 조건과 비용은 해당 상품 상세의 배송·교환·환불 안내를 확인하고, 개별 처리는 카카오톡으로 문의해 주세요.",
    links: [orderLink, productLink, contactLink],
  },
  {
    id: "stays",
    question: "단궁·유탑 숙박 예약을 확인하고 싶어요",
    answer: "단궁과 유탑의 예약 조회 화면이 달라요. 예약한 숙소를 선택한 뒤 예약번호와 연락처 등 화면에서 요청하는 정보를 입력해 주세요. 예약 내역과 이용 조건을 확인할 수 있어요. 예약 변경·취소는 숙소별 안내를 확인하고 카카오톡으로 문의해 주세요.",
    links: [dangungLink, utopLink, contactLink],
  },
  {
    id: "closed",
    question: "마감된 공구도 구매할 수 있나요?",
    answer: "공구 마감으로 표시된 상품은 정보를 둘러볼 수 있지만 구매할 수 없어요. 품절 상품도 현재 구매가 제한돼요. 다시 열리는 일정은 확정된 상품 안내를 확인해 주세요. 이 채팅에서는 재오픈이나 재입고 일정을 확정해 드릴 수 없어요.",
    links: [productLink, contactLink],
  },
  {
    id: "suppliers",
    question: "교육·클래스도 공구를 제안할 수 있나요?",
    answer: "생활용품·식품·뷰티부터 숙박, 교육·클래스와 서비스까지 공급사 제안을 받고 있어요. 공급사 페이지에서 제안 내용을 남겨 주세요. 검토 후 공구 구성·가격·일정·이용 조건을 협의해요. 교육·클래스는 회차·정원·이용 기간과 구매 후 예약 방법 등을 함께 정할 수 있어요.",
    links: [{ label: "공급사 제안하기", href: "/suppliers" }],
  },
  {
    id: "purchase",
    question: "비회원도 구매할 수 있나요?",
    answer: "비회원도 구매할 수 있어요. 진행 중인 상품에서 옵션과 수량을 선택하고, 주문서에 구매자·배송 정보를 입력해 주세요. 비회원 주문은 휴대폰 인증 후 결제를 진행해요. 결제 전에 최종 금액, 배송비와 상품별 이용 조건을 확인해 주세요.",
    links: [productLink, orderLink],
  },
  {
    id: "schedule",
    question: "공구 일정은 어디서 확인하나요?",
    answer: "상품 상세 옆의 작은 공구 달력에서 등록된 판매 일정을 볼 수 있어요. 달력은 일정 안내용으로 날짜를 선택하거나 예약하는 기능은 없어요. 오늘 날짜에는 빨간 테두리가 표시돼요. 구매 가능 여부는 상품의 진행 중·품절·마감 표시도 함께 확인해 주세요.",
    links: [productLink],
  },
  {
    id: "payment",
    question: "결제에 실패했거나 완료 여부가 불확실해요",
    answer: "결제 완료 여부가 불확실하면 다시 결제하기 전에 주문·배송 조회에서 주문 내역을 먼저 확인해 주세요. 결제창의 오류 안내도 확인해 주세요. 결제 금액이 빠져나갔는데 주문이 보이지 않거나 오류가 반복되면 카카오톡으로 문의해 주세요. 이 채팅에서는 결제 승인이나 취소를 처리하지 않아요.",
    links: [orderLink, contactLink],
  },
  {
    id: "contact",
    question: "상담원에게 문의하고 싶어요",
    answer: "개별 주문·예약 확인이나 담당자 상담은 카카오톡 채널로 문의해 주세요. 아래 버튼을 누르면 채널로 이동해요. 이 채팅은 자동 이용안내이며 상담원에게 질문을 전달하거나 상담을 접수하지 않아요.",
    links: [contactLink],
  },
];

const fallback: HelpReply = {
  answer: "주문·배송 조회, 상품 취소·환불, 숙박 예약 확인, 공구 일정과 공급사 제안을 안내할 수 있어요. 궁금한 내용을 짧게 다시 적거나 자주 묻는 질문을 선택해 주세요. 개별 확인이 필요한 문의는 카카오톡 상담을 이용해 주세요.",
  links: [contactLink],
};

function copyReply(reply: HelpReply): HelpReply {
  return { answer: reply.answer, links: reply.links.map(link => ({ ...link })) };
}

function topic(id: string): HelpReply {
  return copyReply(HELP_TOPICS.find(item => item.id === id) ?? fallback);
}

function stayReply(text: string): HelpReply {
  const dangung = /단궁/.test(text);
  const utop = /유탑|utop/.test(text);
  const links = dangung && !utop ? [dangungLink, contactLink]
    : utop && !dangung ? [utopLink, contactLink]
    : [dangungLink, utopLink, contactLink];
  if (/취소|환불|반품|변경|위약금/.test(text)) {
    return copyReply({
      answer: "숙박 예약의 변경·취소·환불 조건은 숙소와 예약 조건에 따라 달라요. 예약한 숙소의 조회 화면에서 내역과 안내를 확인한 뒤 카카오톡으로 문의해 주세요. 이 채팅에서는 환불 금액을 계산하거나 예약 취소를 접수하지 않아요.",
      links,
    });
  }
  if (/결제|승인|카드|돈|출금|오류|실패/.test(text)) {
    return copyReply({
      answer: "숙박 결제 완료 여부가 불확실하면 다시 결제하기 전에 예약한 숙소의 예약 조회에서 내역을 확인해 주세요. 결제 금액이 빠져나갔는데 예약이 보이지 않거나 오류가 반복되면 카카오톡으로 문의해 주세요. 이 채팅에서는 결제 상태를 조회하거나 승인하지 않아요.",
      links,
    });
  }
  return copyReply({ ...topic("stays"), links });
}

/** Returns fixed plain text and allowlisted links; input is never reflected or executed. */
export function getHelpReply(input: string): HelpReply {
  if (typeof input !== "string" || !input.trim()) return copyReply(fallback);
  if (input.length > 500) {
    return copyReply({ answer: "질문은 500자 이내로 짧게 적어 주세요. 개별 주문·예약 확인이 필요하면 카카오톡 상담을 이용해 주세요.", links: [contactLink] });
  }
  const text = input.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, "");
  const exact = HELP_TOPICS.find(item => item.question.normalize("NFKC").toLowerCase().replace(/\s+/g, "") === text);
  if (exact) return copyReply(exact);

  // A hotel/class supply proposal is a supplier inquiry, not a booking inquiry.
  if (/공급|제휴|입점|제안|납품|벤더|밴더/.test(text)) return topic("suppliers");
  // Resolve lodging before generic cancellation/payment words to avoid product-policy answers.
  if (/호텔|숙박|단궁|유탑|utop|펜션|독채|리조트|체크인|체크아웃|투숙|예약/.test(text)) return stayReply(text);
  if (/상담원|담당자|사람|고객센터|고객센타|카카오|카톡|상담|전화문의/.test(text)) return topic("contact");
  if (/취소|환불|교환|반품|불량|파손|하자/.test(text)) return topic("refunds");
  if (/결제.*(실패|오류|안돼|안되|안됨|불가|중복|확인)|중복결제|돈.*(빠|나갔)|출금|승인|카드오류/.test(text)) return topic("payment");
  if (/교육|클래스|강의|수강|원데이/.test(text)) return topic("suppliers");
  if (/배송비|무료배송|추가배송|출고|발송일|배송기간/.test(text)) return topic("shipping");
  if (/배송|운송장|송장|택배|주문.*(조회|확인|내역|번호|상태)|주문했|주문한|도착|언제와|언제오/.test(text)) return topic("orders");
  if (/일정|달력|기간|마감일|종료일|오픈일|시작일|언제.*(오픈|시작|마감)/.test(text)) return topic("schedule");
  if (/마감|종료|품절|재입고|재오픈|다시오픈/.test(text)) return topic("closed");
  if (/구매|비회원|회원가입|가입|장바구니|옵션|수량|결제|주문방법|주문어떻게/.test(text)) return topic("purchase");
  return copyReply(fallback);
}
