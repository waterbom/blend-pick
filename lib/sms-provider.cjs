const crypto = require("node:crypto");
const BASE = "https://api.solapi.com";

function authHeader(apiKey, apiSecret) {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(32).toString("hex");
  const signature = crypto.createHmac("sha256", apiSecret).update(date + salt).digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

function smsConfigured() {
  return !!(process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET && process.env.SOLAPI_SENDER);
}

async function sendSMS(to, text, subject) {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const from = process.env.SOLAPI_SENDER;
  if (!apiKey || !apiSecret || !from) return { ok: false, outcome: "configuration", error: "NOT_CONFIGURED" };

  const phone = to.replace(/[^0-9]/g, "");
  if (phone.length < 10) return { ok: false, outcome: "invalid", error: "잘못된 번호" };

  const message = { to: phone, from: from.replace(/[^0-9]/g, ""), text };
  if (subject) { message.subject = subject; message.type = "LMS"; }

  try {
    const res = await fetch(`${BASE}/messages/v4/send`, {
      method: "POST",
      headers: {
        Authorization: authHeader(apiKey, apiSecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = data?.errorCode ? `[${data.errorCode}] ` : "";
      return { ok: false, outcome: res.status === 429 ? "rejected" : "unknown", error: `${code}${data?.errorMessage || data?.message || `HTTP ${res.status}`}` };
    }
    const sc = String(data?.statusCode ?? "");
    if (sc && !sc.startsWith("2")) {
      return { ok: false, outcome: "unknown", error: `[${sc}] ${data?.statusMessage || ""}`.trim() };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, outcome: "unknown", error: e instanceof Error ? e.message : "발송 실패" };
  }
}

module.exports={sendSMS,smsConfigured};
