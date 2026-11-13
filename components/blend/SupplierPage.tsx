"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { SUPPLIER_CATEGORIES, SUPPLIER_FIELD_LIMITS, SUPPLIER_CONTACT_EMAIL, validateSupplierProposal } from "@/lib/supplier-proposal";
import styles from "./SupplierPage.module.css";

type IconName = "arrow" | "bag" | "spark" | "leaf" | "stay" | "book" | "ticket" | "check" | "people" | "play" | "chart" | "layers" | "search" | "clipboard" | "shield" | "calendar" | "repeat" | "mail";

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></>,
    spark: <path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z" />,
    leaf: <><path d="M20 3C9 1 1 7 5 15s16 4 15-12Z" /><path d="M3 22 15 9" /></>,
    stay: <><path d="M4 21V5l8-3 8 3v16M2 21h20M9 21v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1" /></>,
    book: <><path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1ZM12 5v15" /><path d="M5 8h3M5 11h3M16 8h3M16 11h3" /></>,
    ticket: <><path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Z" /><path d="M15 5v3m0 3v2m0 3v3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    people: <><circle cx="9" cy="7.5" r="3" /><path d="M2 20v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6m1 4a5 5 0 0 1 5 5v1" /></>,
    play: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m10 9 5 3-5 3V9Z" /></>,
    chart: <><path d="M3 20h18M6 17v-5m6 5V8m6 9V4" /><path d="m4 8 6-3 4 2 6-5" /></>,
    layers: <><path d="m12 3 10 6-10 6L2 9l10-6Zm-10 11 10 6 10-6M2 18l10 5 10-5" /></>,
    search: <><circle cx="10" cy="10" r="6" /><path d="m14.5 14.5 6 6" /></>,
    clipboard: <><rect x="5" y="5" width="14" height="17" rx="2" /><rect x="9" y="2" width="6" height="5" rx="1" /><path d="M9 12h6m-6 4h5" /></>,
    shield: <><path d="M12 2 3.5 6v6c0 5.5 3.4 9 8.5 10 5.1-1 8.5-4.5 8.5-10V6L12 2Z" /><path d="m8.5 12 2.4 2.5 4.8-5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4m8-4v4M3 10h18m-12 5h6" /></>,
    repeat: <><path d="M20 7h-12a4 4 0 0 0-4 4v1M4 17h12a4 4 0 0 0 4-4v-1m-3-8 3 3-3 3m-10 4-3 3 3 3" /></>,
    mail: <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="m3 7 9 7 9-7" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const categoryCards: { title: string; copy: string; icon: IconName; examples: string; image: string | null; tone: string }[] = [
  { title: "식품·먹거리", copy: "우리 식탁에 좋은 발견을 더하는 상품", icon: "leaf", examples: "식품 · 간편식 · 음료", image: "/suppliers/food-natural.webp", tone: "food" },
  { title: "생활·리빙", copy: "일상을 편리하게 바꾸는 아이템", icon: "bag", examples: "주방 · 생활용품 · 소형가전", image: "/suppliers/living-natural.webp", tone: "living" },
  { title: "숙박·여행", copy: "기억에 남을 하루와 여행 경험", icon: "stay", examples: "호텔 · 리조트 · 독채", image: "/suppliers/stay-natural.webp", tone: "stay" },
  { title: "교육·클래스", copy: "새로운 취향과 배움을 연결하는 제안", icon: "book", examples: "교육 · 원데이클래스 · 수강권", image: "/suppliers/class-natural.webp", tone: "class" },
  { title: "문화·체험", copy: "물건 너머의 경험을 공구로", icon: "ticket", examples: "공간 · 체험 · 이용권", image: "/suppliers/experience-natural.webp", tone: "experience" },
  { title: "시즌·기획상품", copy: "지금 필요한 이유가 분명한 상품", icon: "spark", examples: "명절 · 선물 · 시즌 패키지", image: "/suppliers/gifts-natural.webp", tone: "season" },
];

const benefits: { title: string; copy: string; icon: IconName }[] = [
  { title: "브랜드에 맞는 파트너", copy: "상품의 강점과 고객층을 고려해 알맞은 콘텐츠·인플루언서 협업을 검토합니다.", icon: "people" },
  { title: "콘텐츠로 설득하는 판매", copy: "가격만 내세우지 않고 실제 쓰임과 경험을 보여주는 콘텐츠를 기획합니다.", icon: "play" },
  { title: "공구 운영을 하나의 흐름으로", copy: "상품 구성부터 오픈·판매·마감까지 필요한 운영 과정을 함께 조율합니다.", icon: "bag" },
  { title: "확인할 수 있는 운영 결과", copy: "판매·정산 결과를 토대로 다음 협업 가능성을 함께 검토합니다.", icon: "chart" },
];

const steps: {title:string;copy:string;icon:IconName}[] = [
  { title: "제안 접수", copy: "브랜드와 상품·서비스의 특징을 알려 주세요.", icon: "clipboard" },
  { title: "상품·브랜드 검토", copy: "시장성, 혜택, 공급·이용 조건을 살펴봅니다.", icon: "search" },
  { title: "협업 방식 설계", copy: "필요한 콘텐츠와 파트너·공구 구성을 협의합니다.", icon: "people" },
  { title: "콘텐츠·공구 진행", copy: "진행 결정 후 일정과 페이지를 준비해 판매합니다.", icon: "play" },
  { title: "정산·성과 공유", copy: "진행 결과를 확인하고 후속 기회를 논의합니다.", icon: "chart" },
];

const questions = [
  { question: "어떤 상품이나 서비스를 제안할 수 있나요?", answer: "식품·생활용품·뷰티 같은 상품부터 숙박·호텔, 교육·클래스, 체험·이용권까지 다양한 형태를 검토합니다. 목록에 없는 상품도 제안서의 ‘기타’ 항목으로 보내 주세요." },
  { question: "수수료나 진행 비용은 어떻게 결정하나요?", answer: "상품의 구성과 판매 방식, 콘텐츠 제작 범위, 운영 조건에 따라 협의합니다. 정해진 비용을 임의로 약속하지 않고, 제안 검토 후 진행 가능 조건을 안내합니다." },
  { question: "공구 시작까지 얼마나 걸리나요?", answer: "상품 자료, 배송·예약 방식, 콘텐츠 제작 일정에 따라 달라집니다. 구체적인 판매 기간과 오픈 일정은 협의 후 정합니다." },
  { question: "정식 입점이 아닌 단일 캠페인도 제안할 수 있나요?", answer: "네. 단일 상품이나 특정 시즌을 위한 제안도 보내실 수 있습니다. 진행 여부와 반복 운영 가능성은 별도 검토합니다." },
];
function ProposalForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [uncertainSubmission, setUncertainSubmission] = useState(false);
  const [emailPending, setEmailPending] = useState(false);
  const submitting = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const focusFirstField = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controllerRef.current?.abort(); };
  }, []);

  useEffect(() => {
    if (status === "success" || status === "error") resultRef.current?.focus();
    if (status === "idle" && focusFirstField.current) {
      focusFirstField.current = false;
      formRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    }
  }, [status, error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || status === "success") return;
    const fields = new FormData(event.currentTarget);
    const validation = validateSupplierProposal({
      kind: "supplier-proposal",
      name: fields.get("name"),
      contact: fields.get("contact"),
      company: fields.get("company"),
      proposalCategory: fields.get("proposalCategory"),
      productName: fields.get("productName"),
      message: fields.get("message"),
      consent: fields.get("consent") === "on",
    });
    if (!validation.ok) {
      setUncertainSubmission(false);
      setError(validation.error);
      setStatus("error");
      return;
    }

    submitting.current = true;
    setStatus("submitting");
    setError("");
    setUncertainSubmission(false);
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    let responseError = "";
    let responseUncertain = true;
    try {
      const response = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.value),
        signal: controller.signal,
      });
      const result: { ok?: boolean; error?: string; emailSent?: boolean } = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok !== true) {
        responseUncertain = response.status >= 500 || response.ok;
        responseError = typeof result?.error === "string" ? result.error : "제안을 접수하지 못했어요. 잠시 후 다시 시도해 주세요.";
        throw new Error(responseError);
      }
      if (mounted.current) { setEmailPending(result.emailSent === false); setStatus("success"); }
    } catch {
      if (mounted.current) {
        setError(responseUncertain ? "접수 결과를 확인하지 못했어요. 고객센터에서 접수 여부를 확인해 주세요." : responseError);
        setUncertainSubmission(responseUncertain);
        setStatus("error");
      }
    } finally {
      window.clearTimeout(timeout);
      submitting.current = false;
      controllerRef.current = null;
    }
  }

  if (status === "success") {
    return <div className={styles.success} role="status" tabIndex={-1} ref={resultRef}>
      <span className={styles.successIcon}><Icon name="check" size={30} /></span>
      <span className={styles.eyebrow}>THANK YOU FOR YOUR PICK</span>
      <h3>새로운 제안이 도착했어요.</h3>
      <p>남겨 주신 내용을 확인한 뒤,<br />기재한 연락처로 안내드릴게요.</p>
      {emailPending && <p>제안은 접수됐지만 이메일 전달이 완료되지 않았어요.<br />빠른 확인이 필요하면 <a href={`mailto:${SUPPLIER_CONTACT_EMAIL}`}>{SUPPLIER_CONTACT_EMAIL}</a>으로 연락해 주세요.</p>}
      <div className={styles.successLinks}><Link href="/">블랜드픽 둘러보기 <Icon name="arrow" size={17} /></Link><button type="button" onClick={() => { focusFirstField.current = true; setStatus("idle"); setError(""); }}>다른 제안 보내기</button></div>
    </div>;
  }

  return <form className={styles.form} onSubmit={submit} ref={formRef} aria-label="공급사 제안" aria-busy={status === "submitting"}>
    <div className={styles.formHead}><h3>공구 제안서</h3><span>모든 항목은 필수예요</span></div>
    <fieldset disabled={status === "submitting"}>
      <legend className={styles.srOnly}>제안 정보 입력</legend>
      <div className={styles.fieldGrid}>
        <label className={styles.field} htmlFor="supplier-company"><span>업체·브랜드명</span><input id="supplier-company" name="company" autoComplete="organization" placeholder="업체명 또는 브랜드명" required minLength={SUPPLIER_FIELD_LIMITS.company.min} maxLength={SUPPLIER_FIELD_LIMITS.company.max} /></label>
        <label className={styles.field} htmlFor="supplier-name"><span>담당자명</span><input id="supplier-name" name="name" autoComplete="name" placeholder="제안 담당자 성함" required minLength={SUPPLIER_FIELD_LIMITS.name.min} maxLength={SUPPLIER_FIELD_LIMITS.name.max} /></label>
        <label className={`${styles.field} ${styles.fullField}`} htmlFor="supplier-contact"><span>연락처 또는 이메일</span><input id="supplier-contact" name="contact" autoComplete="off" placeholder="010-1234-5678 또는 hello@brand.com" required minLength={SUPPLIER_FIELD_LIMITS.contact.min} maxLength={SUPPLIER_FIELD_LIMITS.contact.max} aria-describedby="supplier-contact-hint" /><small id="supplier-contact-hint">답변받을 전화번호나 이메일 중 하나를 입력해 주세요.</small></label>
        <label className={styles.field} htmlFor="supplier-category"><span>제안 카테고리</span><select id="supplier-category" name="proposalCategory" required defaultValue=""><option value="" disabled>카테고리 선택</option>{SUPPLIER_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
        <label className={styles.field} htmlFor="supplier-product"><span>상품·서비스명</span><input id="supplier-product" name="productName" placeholder="함께 소개하고 싶은 이름" required minLength={SUPPLIER_FIELD_LIMITS.productName.min} maxLength={SUPPLIER_FIELD_LIMITS.productName.max} /></label>
        <label className={`${styles.field} ${styles.fullField}`} htmlFor="supplier-message"><span>제안 내용</span><textarea id="supplier-message" name="message" rows={6} required minLength={SUPPLIER_FIELD_LIMITS.message.min} maxLength={SUPPLIER_FIELD_LIMITS.message.max} placeholder={"상품·서비스의 특징과 공구로 소개하고 싶은 이유를 알려 주세요.\n희망 구성, 가격, 공급·이용 가능 일정, 소개 링크가 있다면 함께 적어 주세요."} aria-describedby="supplier-message-hint" /><small id="supplier-message-hint">{SUPPLIER_FIELD_LIMITS.message.min}자 이상, {SUPPLIER_FIELD_LIMITS.message.max.toLocaleString("ko-KR")}자 이내로 적어 주세요.</small></label>
      </div>
      <div className={styles.consentBox}>
        <label className={styles.consent} htmlFor="supplier-consent"><input type="checkbox" id="supplier-consent" name="consent" required /><span>제안 검토와 답변을 위한 개인정보 수집·이용에 동의합니다. <b>(필수)</b></span></label>
        <p>담당자명, 연락처와 제안 내용을 문의 처리에 이용합니다. <Link href="/privacy" target="_blank" rel="noopener noreferrer">블랜드픽 개인정보처리방침 보기<span className={styles.srOnly}> (새 창)</span></Link></p>
      </div>
      <button type="submit" className={styles.submit} disabled={status === "submitting"}>{status === "submitting" ? "제안 보내는 중…" : "공구 제안 보내기"}<Icon name="arrow" size={19} /></button>
    </fieldset>
    {status === "error" && <div className={styles.error} ref={resultRef} tabIndex={-1} role="alert">{error}<p>입력하신 내용은 유지되어 있어요.</p>{uncertainSubmission && <a href={`mailto:${SUPPLIER_CONTACT_EMAIL}?subject=%EA%B3%B5%EA%B8%89%EC%82%AC%20%EC%A0%9C%EC%95%88%20%EC%A0%91%EC%88%98%20%ED%99%95%EC%9D%B8`}>고객센터에 접수 여부 문의하기 <Icon name="arrow" size={15} /></a>}</div>}
    <p className={styles.formNote}>접수 후 제안 내용을 검토해요. 진행 여부와 세부 조건은 협의 후 결정됩니다.</p>
  </form>;
}

export default function SupplierPage() {
  return <main className={styles.page}>
    <section className={styles.newHero} aria-labelledby="supplier-title">
      <div className={styles.heroWrap}>
        <div className={styles.heroCopy}>
          <span className={styles.heroBadge}><span />SUPPLIER PARTNERSHIP</span>
          <h1 id="supplier-title">좋은 상품,<br /><em>더 큰 기회로.</em></h1>
          <p className={styles.heroLead}>브랜드·공급사와 함께 만드는 공동구매</p>
          <p className={styles.heroDescription}>일상의 좋은 물건부터 머무는 하루, 특별한 경험까지.<br />상품의 매력을 콘텐츠로 보여주고 구매로 연결되는<br className={styles.desktopBreak} /> 협업 구조를 함께 고민합니다.</p>
          <p className={styles.heroEligibility}><Icon name="check" size={18} />식품 · 생활용품 · 숙박·호텔 · 교육·클래스 · 서비스 제안 가능</p>
          <div className={styles.heroActions}>
            <a href="#proposal" className={styles.primaryButton}>공급사 제안하기 <Icon name="arrow" size={19} /></a>
            <a href="#process" className={styles.secondaryButton}>진행 방식 보기 <Icon name="arrow" size={17} /></a>
          </div>
          <div className={styles.heroFoot}><span>BRANDS</span><span className={styles.heroDot} />CONTENT<span className={styles.heroDot} />COMMERCE</div>
        </div>
        <div className={styles.heroVisual} aria-label="상품, 숙박과 콘텐츠를 연결하는 공동구매 운영 이미지">
          <div className={styles.visualHalo} aria-hidden="true" />
          <div className={styles.heroStayPhoto}><img src="/suppliers/stay-natural.webp" alt="초록 풍경이 보이는 편안한 숙소" /></div>
          <div className={styles.heroProductPhoto}><img src="/suppliers/food-natural.webp" alt="신선한 식재료와 빵을 담은 식탁" /></div>
          <div className={styles.heroPhone}>
            <div className={styles.phoneTop}><span>BLEND PICK</span><span aria-hidden="true">● ● ●</span></div>
            <div className={styles.phonePhoto}><img src="/suppliers/phone-natural.webp" alt="식품 공동구매 콘텐츠 구성 예시" /></div>
            <div className={styles.phoneBody}><span>CONTENT × COMMERCE</span><strong>좋은 상품을<br />사고 싶어지는 이야기로.</strong><small>콘텐츠 기획 · 공구 구성 · 판매 운영</small></div>
          </div>
          <div className={styles.heroResultCard}><span className={styles.smallIcon}><Icon name="chart" size={23} /></span><div><strong>공동구매 운영</strong><small>브랜드에 맞는 판매 구조 설계</small></div></div>
          <span className={styles.visualSpark} aria-hidden="true"><Icon name="spark" size={38} /></span>
        </div>
      </div>
      <div className={styles.trustBand}>
        <div className={styles.trustStats} aria-label="블랜드펀치 그룹 공개 소개 실적">
          <div><span><Icon name="people" size={27} /></span><strong>300+</strong><small>파트너 인플루언서</small></div>
          <div><span><Icon name="layers" size={27} /></span><strong>500+</strong><small>진행 캠페인</small></div>
          <div><span><Icon name="chart" size={27} /></span><strong>50억+</strong><small>그룹 누적 파트너 매출</small></div>
        </div>
        <p className={styles.statSource}>블랜드펀치 공식 소개 페이지의 그룹 실적이며 블랜드픽 단독 실적은 아닙니다. <a href="https://blendpunch.com/" target="_blank" rel="noopener noreferrer">공식 소개 보기</a></p>
      </div>
    </section>

    <div className={styles.container}>
      <section className={styles.benefits} aria-labelledby="why-suppliers">
        <div className={styles.sectionHead}><div><span className={styles.eyebrow}>WHY BLEND PICK</span><h2 id="why-suppliers">판매를 넘어, <em>브랜드의 다음 기회까지.</em></h2></div><p>좋은 상품을 알아보는 사람에게 닿게 하고,<br />콘텐츠와 운영을 하나의 흐름으로 연결합니다.</p></div>
        <div className={styles.benefitGrid}>{benefits.map((item,index)=><article key={item.title} className={styles.benefitCard}>
          <span className={styles.benefitNumber}>0{index+1}</span><span className={styles.benefitIcon}><Icon name={item.icon} size={27} /></span>
          <h3>{item.title}</h3><p>{item.copy}</p>
        </article>)}</div>
      </section>

      <section className={styles.visualCategories} aria-labelledby="supplier-categories-title">
        <div className={styles.sectionHead}><div><span className={styles.eyebrow}>WHAT WE CAN BUILD</span><h2 id="supplier-categories-title">이런 제안을 <em>기다리고 있어요.</em></h2></div><p>정해진 상품군에만 머무르지 않습니다.<br />브랜드의 강점을 함께 살펴봅니다.</p></div>
        <div className={styles.visualCategoryGrid}>{categoryCards.map(category => <article className={styles.visualCategoryCard} key={category.title}>
          <div className={styles.categoryMedia}>
            {category.image ? <img src={category.image} loading="lazy" alt="" /> : <div className={styles.categoryArt} aria-hidden="true"><Icon name={category.icon} size={72} /><span>CLASS & LEARNING</span></div>}
            <span className={styles.categoryIcon}><Icon name={category.icon} size={20} /></span>
          </div>
          <div className={styles.categoryContent}><h3>{category.title}</h3><p>{category.copy}</p><small>{category.examples}</small></div>
        </article>)}</div>
        <p className={styles.categoryNote}><Icon name="spark" size={16} />다른 분야도 제안해 주세요. 접수된 내용을 보고 함께 검토하겠습니다.</p>
      </section>

      <section className={styles.newProcess} id="process" aria-labelledby="supplier-process-title">
        <div className={styles.sectionHead}><div><span className={styles.eyebrow}>HOW WE WORK</span><h2 id="supplier-process-title">제안부터 정산까지, <em>한눈에.</em></h2></div><p>무엇을 준비하고 어떤 순서로 진행하는지<br />미리 확인하실 수 있도록 정리했습니다.</p></div>
        <ol className={styles.journey}>{steps.map((step,index)=><li key={step.title} className={styles.journeyStep}>
          <div className={styles.journeyTop}><span className={styles.journeyNumber}>{String(index+1).padStart(2,"0")}</span><span className={styles.journeyIcon}><Icon name={step.icon} size={23} /></span></div>
          <h3>{step.title}</h3><p>{step.copy}</p>{index<steps.length-1&&<span className={styles.journeyArrow} aria-hidden="true"><Icon name="arrow" size={17} /></span>}
        </li>)}</ol>
        <p className={styles.processNote}>상품 특성과 협업 조건에 따라 세부 절차·일정은 달라질 수 있으며, 비용과 정산 기준은 시작 전에 협의합니다.</p>
      </section>

      <section className={styles.strategy} aria-labelledby="supplier-strategy">
        <div className={styles.sectionHead}><div><span className={styles.eyebrow}>BUILT FOR THE NEXT CAMPAIGN</span><h2 id="supplier-strategy">단발성 홍보가 아닌, <em>구매로 이어지는 흐름.</em></h2></div><p>노출만으로 끝내지 않고,<br />상품의 매력이 전달되는 과정을 설계합니다.</p></div>
        <div className={styles.strategyGrid}>
          <article className={styles.strategyCard}><div className={styles.strategyImage}><img src="/suppliers/food-natural.webp" alt="" loading="lazy" /></div><div><span>01 · CAMPAIGN</span><h3>상품에 맞는 공구 구성</h3><p>누구에게 어떤 구성이 필요한지 고민하고 판매 혜택과 기간을 논의합니다.</p></div></article>
          <article className={styles.strategyCard}><div className={styles.strategyImage}><img src="/suppliers/living-natural.webp" alt="" loading="lazy" /></div><div><span>02 · CONTENT</span><h3>설득력 있는 콘텐츠</h3><p>제품의 기능과 경험을 이해하기 쉬운 이야기로 풀어냅니다.</p></div></article>
          <article className={styles.strategyCard}><div className={styles.strategyImage}><img src="/suppliers/stay-natural.webp" alt="" loading="lazy" /></div><div><span>03 · FOLLOW-UP</span><h3>데이터 기반의 다음 협업</h3><p>공구 종료 뒤 결과를 살펴보고 후속 진행 가능성을 검토합니다.</p></div></article>
          <aside className={styles.strategyInsight} aria-label="공구 운영에서 확인하는 핵심 정보">
            <div className={styles.insightTop}><Icon name="chart" size={26} /><span>PERFORMANCE VIEW</span></div>
            <h3>공구 결과를<br />다음 기회로.</h3>
            <div className={styles.insightBars} aria-hidden="true"><span /><span /><span /><span /><span /></div>
            <ul><li><Icon name="check" size={17} /> 주문·판매 흐름 확인</li><li><Icon name="check" size={17} /> 정산 조건 및 결과 공유</li><li><Icon name="check" size={17} /> 후속 운영 방향 검토</li></ul>
            <small>위 그래픽은 운영 방식 설명을 위한 예시이며 실제 매출 수치가 아닙니다.</small>
          </aside>
        </div>
      </section>

      <section className={styles.faq} aria-labelledby="supplier-faq">
        <div className={styles.sectionHead}><div><span className={styles.eyebrow}>FREQUENT QUESTIONS</span><h2 id="supplier-faq">제안 전에 <em>궁금한 점</em></h2></div><p>처음 제안하시는 브랜드도<br />진행 방식을 이해할 수 있도록 안내합니다.</p></div>
        <div className={styles.faqList}>{questions.map((item,index)=><details key={item.question} className={styles.faqItem} open={index===0}>
          <summary><span><b>Q.</b> {item.question}</span><span className={styles.faqPlus} aria-hidden="true">+</span></summary>
          <p>{item.answer}</p>
        </details>)}</div>
      </section>
    </div>

    <section className={styles.proposalBand} id="proposal" aria-labelledby="supplier-proposal-title">
      <div className={styles.proposalShell}>
        <div className={styles.proposalIntro}>
          <span className={styles.eyebrow}>START A PARTNERSHIP</span>
          <h2 id="supplier-proposal-title">좋은 상품을,<br /><em>더 많은 사람에게.</em></h2>
          <p>상품, 숙소, 클래스, 서비스까지.<br />지금 제안서를 남겨 주시면 내용을 검토한 뒤<br />담당자가 안내드리겠습니다.</p>
          <div className={styles.promiseList}><span><Icon name="check" size={18} /> 회원가입 없이 접수</span><span><Icon name="check" size={18} /> 상품 특성에 맞는 협업 검토</span><span><Icon name="check" size={18} /> 조건·일정 사전 협의</span></div>
          <div className={styles.proposalContact}>이메일로 제안하기 <a href={"mailto:"+SUPPLIER_CONTACT_EMAIL}>{SUPPLIER_CONTACT_EMAIL}</a></div>
        </div>
        <ProposalForm />
      </div>
    </section>
  </main>;
}
