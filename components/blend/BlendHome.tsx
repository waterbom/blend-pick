"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import FallbackImg from "@/components/FallbackImg";
import type { HomeProduct, HomeUpcoming } from "@/lib/blend-home";
import styles from "./BlendHome.module.css";
import { UTOP_CLOSED } from "@/lib/hotel";

type IconName = "arrow" | "bag" | "stay" | "spark" | "box" | "check" | "leaf" | "chevron" | "pause" | "play";

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></>,
    stay: <><path d="M4 21V5l8-3 8 3v16M2 21h20M9 21v-5h6v5M8 7h1m6 0h1M8 11h1m6 0h1" /></>,
    spark: <><path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7L12 2Z" /><path d="m20 2 .5 1.5L22 4l-1.5.5L20 6l-.5-1.5L18 4l1.5-.5L20 2Z" /></>,
    box: <><path d="m3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5M12 12v10M7.5 4.5l9 5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    leaf: <><path d="M20 3C9 1 1 7 5 15s16 4 15-12Z" /><path d="M3 22 15 9" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    play: <path d="m8 4 12 8-12 8V4Z" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function PickBag() {
  return <svg viewBox="0 0 220 200" fill="none" className={styles.bagArt} aria-hidden="true">
    <ellipse cx="112" cy="179" rx="78" ry="10" fill="#244B35" opacity=".08" />
    <path d="m56 65 108-9 17 116-123 6L56 65Z" fill="#B9CEAA" />
    <path d="m164 56 17 116 17-15-19-91-15-10Z" fill="#86A374" />
    <path d="m56 65 14 8 96-9-2-8-108 9Z" fill="#D9E6CC" />
    <path d="M88 80 84 47c-2-29 40-33 44-4l5 32" stroke="#35593E" strokeWidth="8" strokeLinecap="round" />
    <path d="m84 134 21 18 39-46" stroke="#F8FBF2" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="142" y="99" width="30" height="44" rx="4" transform="rotate(-7 142 99)" fill="#F6ECD5" />
    <circle cx="151" cy="107" r="2" fill="#719164" />
    <path d="m152 107-12-24" stroke="#719164" strokeWidth="1.3" />
    <path d="m151 122 5 4 7-9" stroke="#496D4A" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}

function HeroVisual({ product }: { product?: HomeProduct }) {
  const [paused, setPaused] = useState(false);
  return <div className={`${styles.visual} ${paused ? styles.paused : ""}`}>
    <div className={styles.visualScene}>
      <div className={styles.orbit} aria-hidden="true" />
      <div className={styles.orbitInner} aria-hidden="true" />
      <span className={styles.orbitDot} aria-hidden="true" />
      <span className={styles.visualCaption}>A LITTLE MORE UNEXPECTED.</span>
      <div className={styles.floatingLabel}><span><Icon name="spark" size={17} /></span>일상 밖의 발견</div>
      <Link href="/hotel/dangung" className={styles.stayPostcard} aria-label="단궁 독채·펜션 둘러보기">
        <div className={styles.postcardPhoto}>
          <FallbackImg src="/hotel/dangung/photo-01.jpg" alt="넓은 잔디 정원과 한옥이 있는 단궁" className={styles.coverImage} />
          <span>STAY PICK</span>
        </div>
        <div className={styles.postcardInfo}><div><small>떠나고 싶은 순간도, 공구로.</small><strong>우리만의 하루, 단궁</strong></div><span><Icon name="arrow" /></span></div>
      </Link>
      <Link href={product ? `/products/${product.id}` : "/products"} className={styles.shoppingPostcard}>
        <span className={styles.shoppingLabel}>EVERYDAY PICK <Icon name="spark" size={13} /></span>
        <div className={styles.shoppingPhoto}>{product ? <FallbackImg src={product.main_image} alt={product.name} className={styles.containImage} /> : <PickBag />}</div>
        <strong>{product ? product.name : "갖고 싶던 일상"}</strong>
        <small>{product ? `${product.price.toLocaleString("ko-KR")}원` : "취향에 맞는 물건을 만나요"}</small>
      </Link>
      <div className={styles.pickSeal} aria-hidden="true"><Icon name="spark" size={27} /><strong>이것도<br />PICK!</strong></div>
      <div className={styles.pickTicket}><span className={styles.ticketIcon}><Icon name="check" size={20} /></span><span>일상도 여행도,<strong>잘 골랐다. 블랜드픽.</strong></span><span className={styles.ticketBarcode} aria-hidden="true" /></div>
      <span className={styles.visualStar} aria-hidden="true">✳</span>
    </div>
    <button className={styles.motionButton} type="button" onClick={() => setPaused(!paused)} aria-label={paused ? "메인 모션 재생" : "메인 모션 일시정지"} aria-pressed={paused}><Icon name={paused ? "play" : "pause"} size={13} /><span>모션 {paused ? "재생" : "정지"}</span></button>
  </div>;
}

function Rail({ id, title, eyebrow, description, icon, href, count, children }: { id: string; title: string; eyebrow: string; description: string; icon: IconName; href: string; count: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  useEffect(() => {
    const rail = ref.current;
    if (!rail) return;
    const update = () => setEdges({ start: rail.scrollLeft < 2, end: rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 2 });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(rail);
    rail.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); rail.removeEventListener("scroll", update); };
  }, [count]);
  function move(direction: number) {
    const rail = ref.current;
    if (!rail) return;
    const card = rail.firstElementChild as HTMLElement | null;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({ left: direction * ((card?.offsetWidth || rail.clientWidth) + (Number.parseFloat(getComputedStyle(rail).gap) || 0)), behavior: reduced ? "instant" : "smooth" });
  }
  return <section className={styles.section} aria-labelledby={`${id}-title`} id={id}>
    <div className={styles.sectionHead}>
      <div className={styles.sectionTitle}><span className={styles.sectionIcon}><Icon name={icon} /></span><div><span className={styles.eyebrow}>{eyebrow}</span><h2 id={`${id}-title`}>{title}</h2><p>{description}</p></div></div>
      <div className={styles.railActions}><Link href={href}>전체 보기 <Icon name="arrow" size={16} /></Link>{count > 1 && <div className={styles.arrowButtons}><button type="button" aria-label={`${title} 이전 상품`} aria-controls={`${id}-rail`} disabled={edges.start} onClick={() => move(-1)}><span className={styles.previous}><Icon name="chevron" size={18} /></span></button><button type="button" aria-label={`${title} 다음 상품`} aria-controls={`${id}-rail`} disabled={edges.end} onClick={() => move(1)}><Icon name="chevron" size={18} /></button></div>}</div>
    </div>
    <div className={styles.rail} id={`${id}-rail`} ref={ref} tabIndex={count > 1 ? 0 : undefined} aria-label={`${title} 목록`}>{children}</div>
  </section>;
}

function ProductCard({ product: p, rank }: { product: HomeProduct; rank: number }) {
  const discount = p.original_price && p.original_price > p.price ? Math.round((1 - p.price / p.original_price) * 100) : null;
  const closed = p.sale_closed || p.status === "ended";
  const soldOut = p.stock === 0 || p.status === "soldout";
  return <Link href={`/products/${p.id}`} className={`${styles.productCard} ${closed ? styles.closedCard : ""}`} data-sale-state={closed ? "ended" : soldOut ? "soldout" : "open"}>
    <div className={styles.productImage}><FallbackImg src={p.main_image} alt={p.name} className={styles.containImage} />{(closed || soldOut) && <span className={`${styles.soldOut} ${closed ? styles.closedOverlay : ""}`}>{closed ? "공구 마감" : "품절"}</span>}</div>
    <div className={styles.productInfo}>
      <div className={styles.tags}><span className={closed ? styles.closedTag : soldOut ? styles.soldOutTag : styles.greenTag}>{closed ? "공구 마감" : soldOut ? "품절" : rank >= 0 ? `BEST ${rank + 1}` : "진행 중"}</span>{p.category && <span className={styles.softTag}>{p.category}</span>}</div>
      {p.brand && <small>{p.brand}</small>}<h3>{p.name}</h3>
      <div className={styles.price}>{!closed && discount != null && <b>{discount}%</b>}<strong>{p.price.toLocaleString("ko-KR")}<span>원</span></strong>{!closed && discount != null && <del>{p.original_price!.toLocaleString("ko-KR")}원</del>}</div>
      {closed ? <p className={styles.closedNotice}>판매 종료 · 구매 불가</p> : <p className={styles.shipping}><Icon name="box" size={14} />{p.shipping_type === "free" ? "무료배송" : p.shipping_type === "conditional_free" ? "조건부 무료배송 · 상세 확인" : p.shipping_type === "per_unit" ? "수량별 배송비 · 상세 확인" : `배송비 ${p.shipping_cost.toLocaleString("ko-KR")}원`}</p>}
    </div>
    <span className={styles.cardArrow}><Icon name="arrow" size={18} /></span>
  </Link>;
}

export default function BlendHome({ products, upcoming, categories, topSellerIds, catalogUnavailable }: { products: HomeProduct[]; upcoming: HomeUpcoming[]; categories: string[]; topSellerIds: string[]; catalogUnavailable: boolean }) {
  const heroProduct = products.find(p => p.main_image && p.stock !== 0 && p.status === "active" && !p.sale_closed);
  return <div className={styles.home}>
    <div className={styles.announcement}><span>일상부터 여행까지,</span> 공구의 새로운 발견 <Icon name="spark" size={13} /></div>
    <div className={styles.container}>
      <section className={styles.hero} aria-labelledby="blend-home-title">
        <div className={styles.heroCopy}>
          <span className={styles.heroKicker}><span />취향의 경계를 넓히는 공동구매</span>
          <h1 id="blend-home-title">이런 것까지<br /><em>공구가 된다고?</em><span className={styles.titleSpark} aria-hidden="true">✳</span></h1>
          <p className={styles.heroLead}>매일 쓰는 물건부터,<br className={styles.mobileBreak} /> 오래 기억할 하루까지.</p>
          <p className={styles.heroDescription}>생각지 못한 공구를 만나는 곳, 블랜드픽.<br />당신의 일상에 새로운 선택을 더해요.</p>
          <div className={styles.heroButtons}><Link className={styles.primaryButton} href="/products">공구 쇼핑 <Icon name="arrow" size={19} /></Link><Link className={styles.secondaryButton} href="/hotel"><Icon name="stay" size={18} />숙박·호텔 둘러보기</Link></div>
          <div className={styles.heroLinks}><Link href="/orders/lookup">주문·배송 조회 <Icon name="arrow" size={14} /></Link><span /><details className={styles.lookupMenu}><summary>숙박 예약 조회 <Icon name="arrow" size={14} /></summary><div><Link href="/hotel/dangung/result">단궁 예약 조회</Link><Link href="/hotel/lookup">유탑 예약 조회</Link></div></details></div>
        </div>
        <HeroVisual product={heroProduct} />
      </section>

      <nav className={styles.categories} aria-label="공동구매 카테고리">
        <div className={styles.categoryIntro}><span className={styles.eyebrow}>FIND YOUR PICK</span><h2>오늘은 어떤 발견을<br />해볼까요?</h2></div>
        <Link href="/products" className={styles.categoryCard}><span className={styles.categoryIcon}><Icon name="bag" size={26} /></span><span><strong>공구 쇼핑</strong><small>일상을 채우는 좋은 물건</small></span><Icon name="arrow" size={18} /></Link>
        <Link href="/hotel" className={`${styles.categoryCard} ${styles.stayCategory}`}><span className={styles.categoryIcon}><Icon name="stay" size={26} /></span><span><strong>숙박·호텔</strong><small>머무는 순간까지 특별하게</small></span><Icon name="arrow" size={18} /></Link>
      </nav>
      {categories.length > 0 && <nav className={styles.categoryChips} aria-label="상품 세부 카테고리"><Link href="/products">전체 상품</Link>{categories.map(category => <Link key={category} href={`/products?category=${encodeURIComponent(category)}`}>{category}</Link>)}</nav>}

      <Rail id="shopping-picks" eyebrow="EVERYDAY PICKS" title="일상을 바꾸는 공구" description="진행 중인 공구부터 마감된 공구까지, 한눈에 살펴보세요." icon="bag" href="/products" count={products.length}>
        {products.length ? products.map(p => <ProductCard key={p.id} product={p} rank={topSellerIds.indexOf(p.id)} />) : <div className={styles.emptyCatalog} role="status"><span className={styles.emptyIcon}><Icon name="bag" size={30} /></span><div><h3>{catalogUnavailable ? "상품을 잠시 불러오지 못했어요" : "다음 발견을 준비하고 있어요"}</h3><p>{catalogUnavailable ? "잠시 후 상품 목록에서 다시 확인해 주세요." : "새로운 공구가 열리면 이곳에서 만나보세요."}</p></div><Link href="/products">상품 목록 보기 <Icon name="arrow" size={18} /></Link></div>}
      </Rail>

      <Rail id="stay-picks" eyebrow="STAY & HOTEL" title="이런 하루도, 공구로" description="호텔부터 우리만의 독채까지. 여행의 시작도 블랜드픽." icon="stay" href="/hotel" count={2}>
        <Link className={styles.stayCard} href="/hotel/dangung"><div className={styles.stayImage}><FallbackImg src="/hotel/dangung/photo-01.jpg" alt="단궁의 한옥과 잔디 정원" className={styles.coverImage} /><span>독채·펜션</span></div><div className={styles.stayInfo}><small>한옥 독채 · 단궁</small><h3>우리만의 정원에서 보내는 하루</h3><p>한옥의 여유, 넓은 잔디 정원, 함께하는 시간.</p><div><span>숙소·예약 정보 확인</span><Icon name="arrow" size={20} /></div></div></Link>
        <Link className={`${styles.stayCard} ${UTOP_CLOSED ? styles.closedStay : ""}`} href="/hotel/utop" data-sale-state={UTOP_CLOSED ? "ended" : undefined}><div className={styles.stayImage}><FallbackImg src="/room/double-1.png" alt="여수 유탑 마리나 객실" className={styles.coverImage} /><span>{UTOP_CLOSED ? "공구 마감" : "호텔·리조트"}</span></div><div className={styles.stayInfo}><small>여수 · 유탑 마리나</small><h3>바다 곁에서 쉬어가는 여행</h3><p>여수에서 만나는 오션뷰 리조트의 여유.</p><div><span>{UTOP_CLOSED ? "예약 마감 · 숙소 정보 보기" : "공구 상세·진행 상태 확인"}</span><Icon name="arrow" size={20} /></div></div></Link>
      </Rail>

      {upcoming.length > 0 && <Rail id="upcoming-picks" eyebrow="COMING NEXT" title="다음 공구, 미리 만나기" description="곧 열릴 새로운 발견을 먼저 확인하세요." icon="spark" href="/products" count={upcoming.length}>{upcoming.map(p => <Link className={styles.productCard} href={`/products/${p.id}`} key={p.id}><div className={styles.productImage}><FallbackImg src={p.main_image} alt={p.name} className={styles.containImage} /></div><div className={styles.productInfo}><span className={styles.orangeTag}>{p.open_label} 오픈 예정</span><small>{p.brand}</small><h3>{p.name}</h3><p className={styles.shipping}>공구 일정 확인하기 <Icon name="arrow" size={16} /></p></div></Link>)}</Rail>}

      <section className={styles.brandNote} aria-labelledby="brand-note-title"><div><span className={styles.eyebrow}>A GOOD PICK, TOGETHER.</span><h2 id="brand-note-title">물건을 넘어, 경험까지.<br /><span>공구의 가능성을 넓혀요.</span></h2></div><p>생활 속 작은 즐거움부터 특별한 여행까지.<br />블랜드픽은 함께 고를수록 더 즐거운<br className={styles.desktopBreak} /> 새로운 공구를 소개합니다.</p><span className={styles.noteMark} aria-hidden="true"><Icon name="spark" size={55} /></span></section>

      <section className={styles.help} aria-labelledby="home-help-title"><div className={styles.helpIntro}><span className={styles.eyebrow}>HERE TO HELP</span><h2 id="home-help-title">궁금한 점이 있나요?</h2><p>공구부터 예약까지,<br />편하게 확인하세요.</p><Link href="/guide">이용안내 보기 <Icon name="arrow" size={17} /></Link></div><div className={styles.faq}><details><summary>어떤 상품을 공동구매할 수 있나요?<span>+</span></summary><p>공구 쇼핑에서는 현재 판매 중인 상품을, 숙박·호텔에서는 호텔·리조트와 독채·펜션 정보를 확인할 수 있어요. 판매 기간과 구매·예약 가능 여부는 각 상세 페이지에서 안내합니다.</p></details><details><summary>주문과 숙박 예약은 어디서 확인하나요?<span>+</span></summary><p>일반 상품은 <Link href="/orders/lookup">주문·배송 조회</Link>, 숙박은 <Link href="/hotel/dangung/result">단궁 예약 조회</Link> 또는 <Link href="/hotel/lookup">유탑 예약 조회</Link>에서 확인해 주세요. 비회원 주문도 조회 화면에서 확인할 수 있어요.</p></details><details><summary>상품·숙소·교육 프로그램을 제안하고 싶어요.<span>+</span></summary><p>생활용품부터 숙박, 교육·클래스와 서비스까지 새로운 공구를 제안받고 있어요. <Link href="/suppliers">공급사 제안</Link>에서 진행 과정을 확인하고 제안을 남겨 주세요.</p></details></div></section>
    </div>
  </div>;
}
