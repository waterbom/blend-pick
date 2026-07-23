"use client";

import { useEffect, useState } from "react";

/**
 * 비회원 결제용 휴대폰 인증 필드 — 연락처 입력 아래에 붙여 쓴다.
 * 인증 자체는 /api/verify/phone(발송) · /confirm(확인) 쿠키 방식(호텔 결제와 공유)이라
 * 여기서 verified 가 되면 결제 승인 API 의 서버측 검증도 함께 통과한다.
 */
export default function PhoneVerifyField({
  phone,
  verified,
  onVerified,
}: {
  phone: string;
  verified: boolean;
  onVerified: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [left > 0]);

  async function sendCode() {
    if (phone.replace(/[^0-9]/g, "").length < 10) {
      alert("휴대폰 번호를 정확히 입력해주세요.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/verify/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) { alert(d.error || "인증번호 발송에 실패했어요."); return; }
      setCodeSent(true); setCode(""); setLeft(180);
    } finally { setSending(false); }
  }

  async function confirmCode() {
    if (code.trim().length < 4) { alert("인증번호를 입력해주세요."); return; }
    setVerifying(true);
    try {
      const res = await fetch("/api/verify/phone/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: code.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) { alert(d.error || "인증에 실패했어요."); return; }
      onVerified(); setCodeSent(false); setLeft(0);
    } finally { setVerifying(false); }
  }

  if (verified) {
    return (
      <p className="mt-1.5 text-xs font-bold" style={{ color: "#2D5A27" }}>✓ 휴대폰 인증 완료</p>
    );
  }

  return (
    <div className="mt-1.5 space-y-2">
      <button
        type="button"
        onClick={sendCode}
        disabled={sending}
        className="ds-btn px-4"
        style={{ height: "40px", fontSize: "12.5px", border: "1px solid #244B1F", color: "#244B1F", background: "#fff" }}
      >
        {sending ? "발송 중…" : codeSent ? "인증번호 재전송" : "인증번호 받기"}
      </button>
      {codeSent && (
        <div className="flex gap-2 items-center">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="인증번호 6자리"
            inputMode="numeric"
            maxLength={6}
            className="ds-input"
            style={{ maxWidth: "180px", height: "40px" }}
          />
          <button
            type="button"
            onClick={confirmCode}
            disabled={verifying}
            className="ds-btn ds-btn-primary px-5"
            style={{ height: "40px", fontSize: "12.5px" }}
          >
            {verifying ? "확인 중…" : "확인"}
          </button>
          {left > 0 && (
            <span className="ds-mono text-xs" style={{ color: "#8B927F" }}>
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
