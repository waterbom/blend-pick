import styles from "./SanjiStory.module.css";

function Arrow({ down = false }: { down?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={down ? { transform: "rotate(90deg)" } : undefined}><path d="M4 12h15M13 5l7 7-7 7" /></svg>;
}

const STEPS = [
  { no: "01", title: "공구가 열리면", text: "진행 중인 먹거리와 마감 일정을 살펴봐요." },
  { no: "02", title: "우리 집에 맞게", text: "상품별 중량과 수량을 보고 원하는 구성을 골라요." },
  { no: "03", title: "기다림까지 알 수 있게", text: "상품에 안내된 출고 일정을 확인하고, 주문·배송 조회에서 이후 과정을 살펴봐요." },
];

export default function SanjiStory({ linkBase }: { linkBase: string }) {
  const productsHref = `${linkBase}/products`;
  return <main className={styles.story} id="sanji-story">
    <header className={styles.cover}>
      <div className={styles.eyebrow}><span>산지 이야기</span><span lang="en">THE SANJI WAY</span></div>
      <h1>산지에서 시작해,<br />우리의 <em>한 끼로.</em></h1>
      <p className={styles.coverCopy}>좋은 먹거리를 발견하고, 함께 고르는 즐거움.<br />산지와 식탁 사이, 산지픽이 있습니다.</p>
      <a className={styles.readLink} href="#sanji-origin">우리의 이야기 <Arrow down /></a>
    </header>

    <figure className={styles.field}>
      <img src="/sanji/story/field-v1.webp" alt="아침 햇살과 이슬이 내려앉은 초록 배추밭의 연출 이미지" width="960" height="1440" fetchPriority="high" decoding="async" />
      <figcaption><span lang="en">FROM THE LAND, TO YOUR TABLE</span><p>식탁에 오르기 전,<br />계절을 지나는 시간이 있습니다.</p></figcaption>
    </figure>

    <section className={styles.origin} id="sanji-origin" aria-labelledby="sanji-origin-title">
      <div className={styles.sectionLabel}><span>01</span> 먹거리의 시작</div>
      <h2 id="sanji-origin-title">맛있는 이야기는<br /><em>산지에서</em> 시작되니까.</h2>
      <p>햇볕을 머금은 과일, 흙 속에서 여문 뿌리채소.<br />익숙한 먹거리에도 자라온 곳과 계절이 있어요.</p>
      <p>산지픽은 그 이야기를 조금 더 가까이 전하고 싶어요.<br />어디서 왔는지, 어떤 구성인지 살펴보고<br />우리 집 식탁에 맞는 먹거리를 고를 수 있도록.</p>
      <figure className={styles.harvest}>
        <img src="/sanji/story/harvest-v1.webp" alt="장갑 낀 손으로 흙 묻은 고구마를 들어 올리는 수확 장면의 연출 이미지" width="960" height="640" loading="lazy" decoding="async" />
        <figcaption>한 끼를 고를 때, 그 시작도 함께 생각합니다.</figcaption>
      </figure>
      <blockquote className={styles.belief}>어디서 왔는지 아는 즐거움이<br /><strong>먹는 즐거움으로 이어지도록.</strong></blockquote>
    </section>

    <section className={styles.together} aria-labelledby="sanji-together-title">
      <div className={styles.sectionLabel}><span>02</span> 산지픽이 연결하는 방식</div>
      <h2 id="sanji-together-title">좋은 먹거리를 만나는<br /><em>함께의 방식, 공구.</em></h2>
      <p className={styles.togetherIntro}>정기구독 없이, 필요한 때에.<br />먹고 싶은 것이 있을 때 원하는 공구에 참여해요.<br />각자의 식탁에 필요한 선택이 모입니다.</p>
      <div className={styles.keywords} aria-label="산지픽 공동구매의 특징"><span>필요한 때에</span><span>원하는 구성으로</span><span>일정을 살펴보고</span></div>
      <ol className={styles.steps}>{STEPS.map(step => <li key={step.no}><span className={styles.stepNumber} aria-hidden="true">{step.no}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol>
      <a className={styles.lightLink} href={linkBase || "/"}>지금 진행 중인 공구 둘러보기 <Arrow /></a>
    </section>

    <section className={styles.table} aria-labelledby="sanji-table-title">
      <figure className={styles.tablePhoto}>
        <img src="/sanji/story/table-v1.webp" alt="고구마, 사과, 감귤과 배추가 놓인 소박한 식탁의 연출 이미지" width="960" height="640" loading="lazy" decoding="async" />
      </figure>
      <div className={styles.tableCopy}>
        <div className={styles.sectionLabel}><span>03</span> 일상으로 이어지는 산지</div>
        <h2 id="sanji-table-title">밭의 맛부터,<br /><em>바다의 맛까지.</em></h2>
        <p>한 가지 먹거리가 바뀌면 오늘의 식탁도 달라져요.<br />익숙한 장보기에 새로운 산지의 맛을 더해보세요.</p>
        <div className={styles.collections}>
          <a href={`${productsHref}?category=produce`}><span><small>밭과 과수원에서</small><strong>농산물 둘러보기</strong></span><Arrow /></a>
          <a href={`${productsHref}?category=seafood`}><span><small>바다의 먹거리까지</small><strong>수산물 둘러보기</strong></span><Arrow /></a>
        </div>
      </div>
    </section>

    <aside className={styles.note} aria-labelledby="sanji-note-title">
      <span className={styles.noteMark} aria-hidden="true">i</span>
      <div><h2 id="sanji-note-title">좋은 선택을 위한 작은 확인</h2><p>원산지·중량·구성·배송비·출고일은 상품마다 달라요. 주문 전 각 상품의 상세 안내를 확인해주세요.</p></div>
    </aside>

    <section className={styles.closing} aria-labelledby="sanji-closing-title">
      <span className={styles.closingWordmark}>산지픽<span aria-hidden="true">.</span></span>
      <h2 id="sanji-closing-title">오늘의 식탁에,<br />산지를 더해보세요.</h2>
      <p>다음 한 끼의 이야기를 여기서 만나보세요.</p>
      <a className={styles.cta} href={linkBase || "/"}>지금 열린 공구 보기 <Arrow /></a>
      <a className={styles.allLink} href={productsHref}>전체 먹거리 살펴보기</a>
      <p className={styles.imageNote}>이 페이지의 사진은 산지의 분위기를 표현한 AI 제작 이미지로,<br />실제 판매 상품이나 특정 공급사의 현장 사진이 아닙니다.</p>
    </section>
  </main>;
}
