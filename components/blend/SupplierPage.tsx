"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { SUPPLIER_CATEGORIES, SUPPLIER_FIELD_LIMITS, SUPPLIER_CONTACT_EMAIL, validateSupplierProposal } from "@/lib/supplier-proposal";
import styles from "./SupplierPage.module.css";

type IconName = "arrow" | "bag" | "spark" | "leaf" | "stay" | "book" | "ticket" | "check";

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
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const categoryCards: { title: string; copy: string; icon: IconName; examples: string }[] = [
  { title: "생활·리빙", copy: "매일 쓰는 물건의 새로운 발견", icon: "bag", examples: "생활용품 · 주방 · 가전" },
  { title: "뷰티·패션", copy: "나를 위한 취향 있는 선택", icon: "spark", examples: "뷰티 · 의류 · 잡화" },
  { title: "식품", copy: "맛있는 일상을 함께 나누는 일", icon: "leaf", examples: "먹거리 · 간편식 · 음료" },
  { title: "숙박·여행", copy: "머무는 하루도 특별해지도록", icon: "stay", examples: "호텔 · 독채 · 여행 경험" },
  { title: "교육·클래스", copy: "배우고 싶던 경험을 더 가까이", icon: "book", examples: "교육 프로그램 · 원데이 클래스" },
  { title: "문화·서비스", copy: "물건을 넘어, 일상의 경험까지", icon: "ticket", examples: "문화 체험 · 이용권 · 생활 서비스" },
];

const steps = [
  { title: "제안 보내기", copy: "상품이나 서비스의 특징과 함께 소개하고 싶은 내용을 알려 주세요." },
  { title: "상품·혜택 설계", copy: "제안 내용을 바탕으로 공구 구성과 가격, 이용 조건을 논의해요." },
  { title: "페이지·일정 준비", copy: "진행이 결정되면 소개 자료와 판매 일정, 전달할 정보를 준비해요." },
  { title: "판매·이용·정산", copy: "협의한 조건에 따라 판매와 배송·이용, 정산 절차를 진행해요." },
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
    <section className={styles.hero} aria-labelledby="supplier-title">
      <div className={styles.heroInner}>
        <span className={styles.heroBadge}><span />새로운 공구를 만드는 공급사 제안</span>
        <h1 id="supplier-title">좋은 제안이라면,<br className={styles.mobileBreak} /> <em>블랜드픽.</em></h1>
        <p className={styles.heroLead}>이런 것까지 공구가 된다고?</p>
        <p className={styles.heroDescription}>물건부터 머무는 하루, 배우는 경험까지.<br />함께 소개하고 싶은 상품과 서비스를 제안해 주세요.</p>
        <div className={styles.heroActions}><a href="#proposal" className={styles.primaryButton}>공급사 제안하기 <Icon name="arrow" size={20} /></a><a href="#process" className={styles.secondaryButton}>진행 과정 알아보기</a></div>
        <div className={styles.heroFoot}><span>PRODUCT</span><span className={styles.heroDot} />STAY<span className={styles.heroDot} />CLASS<span className={styles.heroDot} />SERVICE</div>
      </div>
      <div className={styles.heroMarkOne} aria-hidden="true"><Icon name="spark" size={55} /></div><div className={styles.heroMarkTwo} aria-hidden="true"><Icon name="spark" size={27} /></div>
    </section>

    <div className={styles.container}>
      <section className={styles.categories} aria-labelledby="supplier-categories-title">
        <div className={styles.sectionHead}><div><span className={styles.eyebrow}>BEYOND THE ORDINARY</span><h2 id="supplier-categories-title">공구의 경계는,<br /><em>생각보다 넓으니까.</em></h2></div><p>익숙한 상품도, 새로운 경험도 좋아요.<br />함께 나누고 싶은 가치를 기다립니다.</p></div>
        <div className={styles.categoryGrid}>{categoryCards.map(category => <article className={styles.category} key={category.title}><span className={styles.categoryIcon}><Icon name={category.icon} size={25} /></span><h3>{category.title}</h3><p>{category.copy}</p><small>{category.examples}</small></article>)}</div>
        <p className={styles.categoryNote}><Icon name="spark" size={15} />분류에 꼭 맞지 않아도 괜찮아요. 그 밖의 제안은 ‘기타’를 선택해 주세요.</p>
      </section>

      <section className={styles.process} id="process" aria-labelledby="supplier-process-title">
        <div className={styles.sectionHead}><div><span className={styles.eyebrow}>FROM IDEA TO PICK</span><h2 id="supplier-process-title">제안이 공구가 되기까지</h2></div><p>필요한 내용을 하나씩 확인하며,<br />서로에게 맞는 진행 방식을 찾아가요.</p></div>
        <ol className={styles.steps}>{steps.map((step, index) => <li key={step.title}><span className={styles.stepNumber}>0{index + 1}</span><h3>{step.title}</h3><p>{step.copy}</p>{index < steps.length - 1 && <span className={styles.stepArrow}><Icon name="arrow" size={19} /></span>}</li>)}</ol>
        <div className={styles.classExample}><span className={styles.classExampleIcon}><Icon name="book" size={24} /></span><div><h3>교육·클래스라면, 이렇게 함께 준비해요.</h3><p>회차·정원·이용 기간을 정한 <strong>수강권 구성</strong><span aria-hidden="true"> → </span>공구 판매 일정 협의<span aria-hidden="true"> → </span>구매 후 예약·이용 방법 안내</p><small>온라인 강의, 오프라인 클래스 등 운영 방식에 맞춰 수강 조건과 예약 방법을 협의합니다.</small></div></div>
        <p className={styles.processNote}>상품·서비스 특성에 따라 준비 과정은 달라질 수 있어요. 판매 구성, 비용과 정산 조건은 진행 전 협의합니다.</p>
      </section>

      <section className={styles.proposalSection} id="proposal" aria-labelledby="supplier-proposal-title">
        <div className={styles.proposalIntro}><span className={styles.eyebrow}>YOUR NEXT PICK STARTS HERE</span><h2 id="supplier-proposal-title">다음 공구는,<br /><em>당신의 제안에서.</em></h2><p>먼저, 어떤 제안인지 들려주세요.<br />아래 내용을 남겨 주시면 검토 후<br className={styles.desktopBreak} /> 연락드릴게요.</p><div className={styles.introNote}><Icon name="check" size={19} /><span>회원가입 없이 제안할 수 있어요.</span></div><div className={styles.introNote}><Icon name="check" size={19} /><span>확정되지 않은 구성은 함께 논의해요.</span></div><p>이메일로도 제안할 수 있어요.<br /><a href={`mailto:${SUPPLIER_CONTACT_EMAIL}`} style={{ overflowWrap: "anywhere", textDecoration: "underline" }}>{SUPPLIER_CONTACT_EMAIL}</a></p><span className={styles.introMark} aria-hidden="true"><Icon name="spark" size={112} /></span></div>
        <ProposalForm />
      </section>
    </div>
  </main>;
}
