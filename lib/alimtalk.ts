import crypto from "crypto";

/**
 * SOLAPI(쿨SMS) 카카오 알림톡 발송.
 * 신규 npm 의존성 없이 REST + HMAC 인증으로 호출한다.
 *
 * 필요한 환경변수 (.env.local / EC2):
 *   SOLAPI_API_KEY       발급받은 API Key
 *   SOLAPI_API_SECRET    API Secret
 *   SOLAPI_PFID          카카오 발신프로필 키(채널 등록 후 발급)
 *   SOLAPI_TEMPLATE_ID   승인된 알림톡 템플릿 ID
 *   SOLAPI_SENDER        발신번호(SMS 대체발송용, 하이픈 없이)
 */

const BASE = "https://api.solapi.com";

function authHeader(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString("hex");
  const signature = crypto.createHmac("sha256", apiSecret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export function alimtalkConfigured() {
  return !!(
    process.env.SOLAPI_API_KEY &&
    process.env.SOLAPI_API_SECRET &&
    process.env.SOLAPI_PFID &&
    process.env.SOLAPI_TEMPLATE_ID &&
    process.env.SOLAPI_SENDER
  );
}

/**
 * 알림톡 1건 발송. 성공 여부를 반환한다(발송 단위로 예약건 발송처리 마킹용).
 * variables 키는 승인된 템플릿의 변수 형식과 동일해야 함 (예: "#{예약번호}").
 */
export async function sendAlimtalk(
  to: string,
  variables: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const pfId = process.env.SOLAPI_PFID;
  const templateId = process.env.SOLAPI_TEMPLATE_ID;
  const from = process.env.SOLAPI_SENDER;
  if (!apiKey || !apiSecret || !pfId || !templateId || !from) {
    return { ok: false, error: "NOT_CONFIGURED" };
  }

  const phone = to.replace(/[^0-9]/g, "");
  if (phone.length < 10) return { ok: false, error: "잘못된 번호" };

  try {
    const res = await fetch(`${BASE}/messages/v4/send`, {
      method: "POST",
      headers: {
        Authorization: authHeader(apiKey, apiSecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          to: phone,
          from,
          kakaoOptions: { pfId, templateId, variables },
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.errorMessage || data?.message || `HTTP ${res.status}` };
    }
    // 개별발송 성공 응답의 statusCode는 "2000"(정상 접수)
    const sc = String(data?.statusCode ?? "");
    if (sc && !sc.startsWith("2")) {
      return { ok: false, error: data?.statusMessage || sc };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "발송 실패" };
  }
}
