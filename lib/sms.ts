import crypto from "crypto";

/**
 * SOLAPI 문자(SMS) 발송. 알림톡과 달리 카카오 채널/템플릿 승인 없이
 * API 키 + 발신번호(SOLAPI_SENDER)만 있으면 즉시 사용 가능.
 */

const BASE = "https://api.solapi.com";

function authHeader(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString("hex");
  const signature = crypto.createHmac("sha256", apiSecret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export function smsConfigured() {
  return !!(process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET && process.env.SOLAPI_SENDER);
}

// subject 를 넘기면 장문(LMS)로 발송 (예약확인처럼 긴 안내문). 짧은 인증번호는 subject 없이 SMS.
export async function sendSMS(to: string, text: string, subject?: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const from = process.env.SOLAPI_SENDER;
  if (!apiKey || !apiSecret || !from) return { ok: false, error: "NOT_CONFIGURED" };

  const phone = to.replace(/[^0-9]/g, "");
  if (phone.length < 10) return { ok: false, error: "잘못된 번호" };

  const message: Record<string, unknown> = { to: phone, from: from.replace(/[^0-9]/g, ""), text };
  if (subject) { message.subject = subject; message.type = "LMS"; }

  try {
    const res = await fetch(`${BASE}/messages/v4/send`, {
      method: "POST",
      headers: {
        Authorization: authHeader(apiKey, apiSecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.errorMessage || data?.message || `HTTP ${res.status}` };
    }
    const sc = String(data?.statusCode ?? "");
    if (sc && !sc.startsWith("2")) {
      return { ok: false, error: data?.statusMessage || sc };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "발송 실패" };
  }
}
