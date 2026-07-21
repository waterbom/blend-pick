"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BUSINESS_TYPE_LABEL } from "@/lib/settlement";

const REQUIRED_DOCS: Record<string, string> = {
  general: "필수 서류: 사업자등록증 + 통장사본 (+ 세금계산서 수신 이메일)",
  simplified: "필수 서류: 사업자등록증 + 통장사본",
  freelancer: "필수 서류: 신분증사본 + 통장사본",
};

interface CampaignRow {
  id: string;
  product_name: string;
  start_date: string;
  end_date: string;
  commission_rate: number | null;
  is_archived: boolean;
}

const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400";
const lbl = "text-xs font-bold text-gray-500 block mb-1.5";

// DB의 timestamptz(UTC ISO) → 화면 입력용 KST "YYYY-MM-DDTHH:mm"
function isoToLocalKST(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 16);
}
// 화면 입력(KST) → 서버 저장용 ISO(+09:00 명시)
function localKSTToISO(v: string): string | null {
  return v ? `${v}:00+09:00` : null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
      <h2 className="text-sm font-black text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function DocUpload({
  label, value, onChange,
}: { label: string; value: string; onChange: (f: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/private-upload", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (res.ok) onChange(data.file);
    else alert(data.error || "업로드 실패");
  }

  return (
    <div>
      <label className={lbl}>{label}</label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="text-xs border border-gray-200 text-gray-600 font-bold px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-40"
        >
          {busy ? "업로드 중..." : value ? "파일 교체" : "파일 업로드"}
        </button>
        {value && (
          <>
            <a
              href={`/api/admin/private-files/${value}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-500 font-bold hover:underline"
            >
              보기
            </a>
            <button type="button" onClick={() => onChange("")} className="text-xs text-red-400 hover:text-red-600">
              삭제
            </button>
          </>
        )}
        {!value && <span className="text-xs text-gray-300">미등록</span>}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </div>
    </div>
  );
}

export default function InfluencerFormClient({
  mode, influencerId,
}: { mode: "new" | "edit"; influencerId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "", platform: "", profile_image: "", phone: "",
    followers_count: "", category: "", memo: "",
    business_type: "", bank_name: "", bank_account: "", bank_holder: "", tax_email: "",
    id_card_file: "", biz_cert_file: "", bankbook_file: "",
    hotel_sale_start: "", hotel_sale_deadline: "", // datetime-local (KST) 형식
  });
  const [linkCopied, setLinkCopied] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [portalPassword, setPortalPassword] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  // 상품 공구 — 요율이 설정된 판매중 상품의 인플루언서별 전용 링크 (중앙관리)
  const [shopProducts, setShopProducts] = useState<{ id: string; name: string; influencer_rate: number }[]>([]);
  const [prodLinkCopied, setProdLinkCopied] = useState<string | null>(null);

  // 계정 발급 — 자동 생성된 아이디/비밀번호 (발급 직후 1회만 표시)
  const [accBusy, setAccBusy] = useState(false);
  const [issued, setIssued] = useState<{ login_id: string; password: string } | null>(null);
  const [credCopied, setCredCopied] = useState(false);

  useEffect(() => {
    if (mode !== "edit" || !influencerId) return;
    fetch(`/api/admin/influencers/${influencerId}`)
      .then((r) => r.json())
      .then((d) => {
        setForm({
          name: d.name ?? "", platform: d.platform ?? "", profile_image: d.profile_image ?? "",
          phone: d.phone ?? "", followers_count: d.followers_count != null ? String(d.followers_count) : "",
          category: d.category ?? "", memo: d.memo ?? "",
          business_type: d.business_type ?? "", bank_name: d.bank_name ?? "",
          bank_account: d.bank_account ?? "", bank_holder: d.bank_holder ?? "",
          tax_email: d.tax_email ?? "",
          id_card_file: d.id_card_file ?? "", biz_cert_file: d.biz_cert_file ?? "",
          bankbook_file: d.bankbook_file ?? "",
          hotel_sale_start: isoToLocalKST(d.hotel_sale_start ?? null),
          hotel_sale_deadline: isoToLocalKST(d.hotel_sale_deadline ?? null),
        });
        setAccountEmail(d.account_email ?? null);
        setPortalPassword(d.portal_password ?? null);
        setCampaigns(d.campaigns ?? []);
      })
      .finally(() => setLoading(false));
    // 상품 공구 링크 발급용 — 요율 설정된 판매중 상품 목록
    fetch("/api/admin/products")
      .then((r) => r.json())
      .then((list: { id: string; name: string; status: string; influencer_rate: number | null }[]) => {
        if (!Array.isArray(list)) return;
        setShopProducts(
          list
            .filter((p) => p.status === "active" && p.influencer_rate != null)
            .map((p) => ({ id: p.id, name: p.name, influencer_rate: Number(p.influencer_rate) }))
        );
      })
      .catch(() => {});
  }, [mode, influencerId]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    // 일정은 둘 다 있거나 둘 다 없어야 함 (한쪽만 있으면 링크 게이트가 애매해짐)
    if (!!form.hotel_sale_start !== !!form.hotel_sale_deadline) {
      setSaving(false);
      setError("호텔 공구 일정은 오픈·마감 시각을 모두 입력하거나 모두 비워주세요.");
      return;
    }
    if (form.hotel_sale_start && form.hotel_sale_deadline && form.hotel_sale_deadline <= form.hotel_sale_start) {
      setSaving(false);
      setError("호텔 공구 마감은 오픈 이후 시각이어야 해요.");
      return;
    }
    const payload = {
      ...form,
      followers_count: form.followers_count ? Number(form.followers_count) : null,
      hotel_sale_start: localKSTToISO(form.hotel_sale_start),
      hotel_sale_deadline: localKSTToISO(form.hotel_sale_deadline),
    };
    const url = mode === "new" ? "/api/admin/influencers" : `/api/admin/influencers/${influencerId}`;
    const res = await fetch(url, {
      method: mode === "new" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      router.push("/admin/influencers");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "저장 실패");
    }
  }

  async function issueAccount() {
    setAccBusy(true);
    const res = await fetch(`/api/admin/influencers/${influencerId}/account`, { method: "POST" });
    const d = await res.json();
    setAccBusy(false);
    if (res.ok) {
      setIssued({ login_id: d.login_id, password: d.password });
      setAccountEmail(d.login_id);
      setPortalPassword(d.password);
    } else alert(d.error || "발급 실패");
  }

  async function resetPassword() {
    if (!window.confirm("비밀번호를 새로 발급할까요? 기존 비밀번호는 사용할 수 없게 됩니다.")) return;
    setAccBusy(true);
    const res = await fetch(`/api/admin/influencers/${influencerId}/account`, { method: "PUT" });
    const d = await res.json();
    setAccBusy(false);
    if (res.ok) {
      setIssued({ login_id: d.login_id, password: d.password });
      setPortalPassword(d.password);
    } else alert(d.error || "변경 실패");
  }

  // 비밀번호 없이 이 인플루언서 계정으로 바로 로그인 → 인플루언서 페이지 새 탭
  // (브라우저의 쇼핑몰 로그인(shop_token)이 이 계정으로 바뀜 — 관리자 로그인은 유지)
  async function impersonate() {
    setAccBusy(true);
    const res = await fetch(`/api/admin/influencers/${influencerId}/impersonate`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setAccBusy(false);
    if (res.ok) window.open(d.redirect || "/influencer", "_blank");
    else alert(d.error || "로그인 실패");
  }

  async function copyCredentials() {
    const creds = issued ?? (accountEmail && portalPassword ? { login_id: accountEmail, password: portalPassword } : null);
    if (!creds) return;
    const text = `블렌드픽 인플루언서 계정\n아이디: ${creds.login_id}\n비밀번호: ${creds.password}\n로그인: ${window.location.origin}/login`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCredCopied(true);
    setTimeout(() => setCredCopied(false), 1500);
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>;

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-black text-gray-900">
        {mode === "new" ? "인플루언서 등록" : "인플루언서 수정"}
      </h1>

      <Section title="기본 정보">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>이름/닉네임 *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inp} required />
          </div>
          <div>
            <label className={lbl}>연락처</label>
            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inp} placeholder="010-0000-0000" />
          </div>
          <div>
            <label className={lbl}>플랫폼</label>
            <input value={form.platform} onChange={(e) => set("platform", e.target.value)} className={inp} placeholder="인스타그램 / 유튜브 등" />
          </div>
          <div>
            <label className={lbl}>팔로워 수</label>
            <input value={form.followers_count} onChange={(e) => set("followers_count", e.target.value)} type="number" min="0" className={inp} />
          </div>
          <div>
            <label className={lbl}>카테고리</label>
            <input value={form.category} onChange={(e) => set("category", e.target.value)} className={inp} placeholder="뷰티 / 육아 / 요리 등" />
          </div>
          <div>
            <label className={lbl}>프로필 이미지 URL</label>
            <div className="flex items-center gap-2">
              <input value={form.profile_image} onChange={(e) => set("profile_image", e.target.value)} className={inp} placeholder="이미지 주소 복사 후 붙여넣기" />
              {form.profile_image && (
                <img
                  src={form.profile_image}
                  alt="미리보기"
                  className="w-10 h-10 rounded-full object-cover bg-gray-100 shrink-0 border border-gray-100"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  onLoad={(e) => { (e.target as HTMLImageElement).style.display = "block"; }}
                />
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">저장 시 이미지를 서버로 복사해둬요 (원본 링크가 만료돼도 안전)</p>
          </div>
        </div>
        <div>
          <label className={lbl}>메모</label>
          <textarea value={form.memo} onChange={(e) => set("memo", e.target.value)} className={`${inp} h-20 resize-none`} />
        </div>
      </Section>

      <Section title="호텔 공구 일정 · 전용 링크">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>공구 오픈 시각 (한국시간)</label>
            <input type="datetime-local" value={form.hotel_sale_start}
              onChange={(e) => set("hotel_sale_start", e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>공구 마감 시각 (한국시간)</label>
            <input type="datetime-local" value={form.hotel_sale_deadline}
              onChange={(e) => set("hotel_sale_deadline", e.target.value)} className={inp} />
          </div>
        </div>
        {mode === "edit" ? (
          form.hotel_sale_start && form.hotel_sale_deadline ? (
            <div className="rounded-xl border border-orange-100 bg-orange-50 p-4 space-y-2">
              <p className="text-xs font-bold text-orange-700">
                🔗 전용 링크 — 이 인플루언서 링크로 들어온 예약은 위 일정으로만 열려요 (저장 후 적용)
              </p>
              <div className="flex gap-1.5">
                <input readOnly value={`/hotel/reserve?inf=${influencerId}`}
                  className="flex-1 min-w-0 text-xs font-mono bg-white border border-orange-200 rounded-lg px-2 py-2 text-gray-600"
                  onFocus={(e) => e.target.select()} />
                <button type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(`${window.location.origin}/hotel/reserve?inf=${influencerId}`);
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 1500);
                    } catch { alert("복사에 실패했어요. 링크를 직접 선택해 복사해주세요."); }
                  }}
                  className={`shrink-0 px-3 py-2 text-xs font-bold rounded-lg ${linkCopied ? "bg-green-600 text-white" : "bg-orange-500 hover:bg-orange-600 text-white"}`}>
                  {linkCopied ? "✓ 복사됨" : "링크 복사"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              오픈·마감 시각을 입력하고 저장하면 전용 링크가 여기에 표시돼요. 일정 없이 링크를 쓰면 기본 공구 일정이 적용됩니다.
            </p>
          )
        ) : (
          <p className="text-xs text-gray-400">등록 후 수정 화면에서 전용 링크를 복사할 수 있어요.</p>
        )}
      </Section>

      <Section title="상품 공구 전용 링크">
        {mode !== "edit" ? (
          <p className="text-xs text-gray-400">등록 후 수정 화면에서 상품별 전용 링크를 복사할 수 있어요.</p>
        ) : shopProducts.length === 0 ? (
          <p className="text-xs text-gray-400">
            수수료율이 설정된 판매중 상품이 없어요. Shop 상품 등록/수정에서 인플루언서 수수료율을 입력하면 여기에 링크가 떠요.
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-500 -mt-1">
              링크를 복사해 전달하면 그 링크로 들어온 구매가 이 인플루언서 실적으로 집계돼요 (상품별 공통 요율)
            </p>
            <div className="space-y-2">
              {shopProducts.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    <p className="text-[11px] text-gray-400">수수료 {p.influencer_rate}% · /products/{p.id}?inf=…</p>
                  </div>
                  <button type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`${window.location.origin}/products/${p.id}?inf=${influencerId}`);
                        setProdLinkCopied(p.id);
                        setTimeout(() => setProdLinkCopied(null), 1500);
                      } catch { alert("복사에 실패했어요. 잠시 후 다시 시도해주세요."); }
                    }}
                    className={`shrink-0 px-3 py-2 text-xs font-bold rounded-lg ${prodLinkCopied === p.id ? "bg-green-600 text-white" : "bg-orange-500 hover:bg-orange-600 text-white"}`}>
                    {prodLinkCopied === p.id ? "✓ 복사됨" : "링크 복사"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section title="정산 정보">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>사업자유형</label>
            <select value={form.business_type} onChange={(e) => set("business_type", e.target.value)} className={inp}>
              <option value="">선택</option>
              {Object.entries(BUSINESS_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {form.business_type && (
              <p className="text-xs text-orange-500 mt-1.5">{REQUIRED_DOCS[form.business_type]}</p>
            )}
          </div>
          <div>
            <label className={lbl}>세금계산서 수신 이메일 (일반사업자)</label>
            <input value={form.tax_email} onChange={(e) => set("tax_email", e.target.value)} type="email" className={inp} />
          </div>
          <div>
            <label className={lbl}>은행</label>
            <input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>예금주</label>
            <input value={form.bank_holder} onChange={(e) => set("bank_holder", e.target.value)} className={inp} />
          </div>
          <div className="sm:col-span-2">
            <label className={lbl}>계좌번호</label>
            <input value={form.bank_account} onChange={(e) => set("bank_account", e.target.value)} className={inp} />
          </div>
        </div>
      </Section>

      <Section title="첨부 서류 (관리자만 열람 가능)">
        <div className="space-y-3">
          <DocUpload label="사업자등록증" value={form.biz_cert_file} onChange={(f) => set("biz_cert_file", f)} />
          <DocUpload label="통장사본" value={form.bankbook_file} onChange={(f) => set("bankbook_file", f)} />
          <DocUpload label="신분증사본 (프리랜서)" value={form.id_card_file} onChange={(f) => set("id_card_file", f)} />
        </div>
      </Section>

      {mode === "edit" && (
        <>
          <Section title="포털 계정 (공구현황 로그인)">
            {issued ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="text-xs font-bold text-green-700 mb-2">
                  ✅ 발급 완료 — 비밀번호는 지금만 확인할 수 있어요. 복사해서 인플루언서에게 전달하세요.
                </p>
                <div className="text-sm font-mono text-gray-800 space-y-1 mb-3">
                  <p>아이디: <b>{issued.login_id}</b></p>
                  <p>비밀번호: <b>{issued.password}</b></p>
                </div>
                <button type="button" onClick={copyCredentials}
                  className={`text-xs font-bold px-3 py-2 rounded-lg border transition-colors ${
                    credCopied ? "bg-green-600 border-green-600 text-white" : "bg-white border-green-300 text-green-700 hover:bg-green-100"
                  }`}>
                  {credCopied ? "복사됨 ✓" : "아이디+비밀번호 복사"}
                </button>
              </div>
            ) : accountEmail ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-gray-700 font-mono">
                  아이디: <b className="text-green-600">{accountEmail}</b>
                  {portalPassword && (
                    <> <span className="text-gray-300 mx-1">·</span> 비밀번호: <b className="text-green-600">{portalPassword}</b></>
                  )}
                </span>
                {portalPassword && (
                  <button type="button" onClick={copyCredentials}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                      credCopied ? "bg-green-600 border-green-600 text-white" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}>
                    {credCopied ? "복사됨 ✓" : "복사"}
                  </button>
                )}
                <button type="button" onClick={resetPassword} disabled={accBusy}
                  className="text-xs border border-gray-200 text-gray-600 font-bold px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                  {accBusy ? "처리 중..." : "비밀번호 재발급"}
                </button>
                <button type="button" onClick={impersonate} disabled={accBusy}
                  className="text-xs bg-green-600 text-white font-bold px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-40">
                  이 계정으로 로그인하기 →
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button type="button" onClick={issueAccount} disabled={accBusy}
                  className="bg-gray-900 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-40">
                  {accBusy ? "발급 중..." : "아이디/비밀번호 발급"}
                </button>
                <span className="text-xs text-gray-400">버튼을 누르면 아이디와 비밀번호가 자동 생성됩니다</span>
              </div>
            )}
          </Section>

          {campaigns.length > 0 && (
            <Section title="진행 공구">
              <div className="space-y-2">
                {campaigns.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm border border-gray-100 rounded-lg px-3 py-2">
                    <div>
                      <p className="font-medium text-gray-800">{c.product_name}</p>
                      <p className="text-xs text-gray-400">
                        {String(c.start_date).slice(0, 10)} ~ {String(c.end_date).slice(0, 10)}
                        {c.is_archived && " · 종료"}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-gray-600">
                      {c.commission_rate != null ? `수수료 ${Number(c.commission_rate)}%` : "요율 미설정"}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2 items-center">
        <button type="submit" disabled={saving}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-6 py-2.5 rounded-lg disabled:opacity-40">
          {saving ? "저장 중..." : mode === "new" ? "등록" : "저장"}
        </button>
        <button type="button" onClick={() => router.back()}
          className="border border-gray-200 text-gray-600 text-sm font-bold px-6 py-2.5 rounded-lg hover:bg-gray-50">
          취소
        </button>
        {mode === "edit" && (
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm("이 인플루언서를 삭제할까요? (진행한 공구가 있으면 삭제되지 않습니다)")) return;
              const res = await fetch(`/api/admin/influencers/${influencerId}`, { method: "DELETE" });
              const d = await res.json().catch(() => ({}));
              if (res.ok) { router.push("/admin/influencers"); router.refresh(); }
              else alert(d.error || "삭제 실패");
            }}
            className="ml-auto text-sm text-red-400 hover:text-red-600 font-bold px-3 py-2.5"
          >
            삭제
          </button>
        )}
      </div>
    </form>
  );
}
