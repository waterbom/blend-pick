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
  });
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);

  // 계정 발급 폼
  const [newEmail, setNewEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [accBusy, setAccBusy] = useState(false);

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
        });
        setAccountEmail(d.account_email ?? null);
        setCampaigns(d.campaigns ?? []);
      })
      .finally(() => setLoading(false));
  }, [mode, influencerId]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      followers_count: form.followers_count ? Number(form.followers_count) : null,
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
    if (!newEmail || newPw.length < 8) {
      alert("이메일과 8자 이상 비밀번호를 입력해주세요.");
      return;
    }
    setAccBusy(true);
    const res = await fetch(`/api/admin/influencers/${influencerId}/account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, password: newPw }),
    });
    const d = await res.json();
    setAccBusy(false);
    if (res.ok) {
      setAccountEmail(newEmail);
      alert(`계정 발급 완료!\n이메일: ${newEmail}\n비밀번호는 인플루언서에게 직접 전달해주세요.`);
    } else alert(d.error || "발급 실패");
  }

  async function resetPassword() {
    const pw = prompt("새 비밀번호 (8자 이상):");
    if (!pw) return;
    const res = await fetch(`/api/admin/influencers/${influencerId}/account`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const d = await res.json();
    if (res.ok) alert("비밀번호가 변경되었습니다. 인플루언서에게 전달해주세요.");
    else alert(d.error || "변경 실패");
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
            <input value={form.profile_image} onChange={(e) => set("profile_image", e.target.value)} className={inp} placeholder="https://..." />
          </div>
        </div>
        <div>
          <label className={lbl}>메모</label>
          <textarea value={form.memo} onChange={(e) => set("memo", e.target.value)} className={`${inp} h-20 resize-none`} />
        </div>
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
            {accountEmail ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700">
                  발급됨: <b className="text-green-600">{accountEmail}</b>
                </span>
                <button type="button" onClick={resetPassword}
                  className="text-xs border border-gray-200 text-gray-600 font-bold px-3 py-1.5 rounded-lg hover:bg-gray-50">
                  비밀번호 재설정
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[180px]">
                  <label className={lbl}>로그인 이메일</label>
                  <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" className={inp} />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className={lbl}>비밀번호 (8자+)</label>
                  <input value={newPw} onChange={(e) => setNewPw(e.target.value)} type="text" className={inp} />
                </div>
                <button type="button" onClick={issueAccount} disabled={accBusy}
                  className="bg-gray-900 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-40">
                  {accBusy ? "발급 중..." : "계정 발급"}
                </button>
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
