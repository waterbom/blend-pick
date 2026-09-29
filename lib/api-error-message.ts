// Browser-safe formatter: keep server guidance and the support reference together.
export function apiErrorMessage(data: unknown, fallback = '처리 결과를 확인하지 못했습니다.') {
  if (!data || typeof data !== 'object') return fallback;
  const body = data as Record<string, unknown>;
  const message = typeof body.error === 'string' && body.error ? body.error : fallback;
  const code = typeof body.code === 'string' && /^[A-Z_]+$/.test(body.code) ? body.code : '';
  const requestId = typeof body.requestId === 'string' && /^[a-f0-9-]{36}$/i.test(body.requestId) ? body.requestId : '';
  if (!code || message.includes('문의번호')) return message;
  const action = typeof body.action === 'string' && !message.includes(body.action) ? ` ${body.action}` : '';
  return `${message}${action} (오류 ${code}${requestId ? ` · 문의번호 ${requestId}` : ''})`;
}

export async function readApiJson(response: Response): Promise<any> {
  try { return await response.json(); }
  catch {
    throw new Error(`서버 응답을 읽지 못했습니다. 처리 결과를 먼저 확인한 뒤 다시 이용해주세요. (오류 RESPONSE_INVALID · HTTP ${response.status})`);
  }
}
