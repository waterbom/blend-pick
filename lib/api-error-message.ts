// Browser-safe formatter: keep server guidance and the support reference together.
export function apiErrorMessage(data: unknown, fallback = '처리 결과를 확인하지 못했습니다.') {
  if (data instanceof Error) {
    if (data.name === 'TypeError' || data.name === 'AbortError' || data.name === 'TimeoutError') {
      return '서버 응답을 확인하지 못했습니다. 네트워크 연결과 기존 처리 결과를 먼저 확인해주세요. (오류 NETWORK_ERROR)';
    }
    return data.message || fallback;
  }
  if (!data || typeof data !== 'object') return fallback;
  const body = data as Record<string, unknown>;
  const message = typeof body.error === 'string' && body.error ? body.error : fallback;
  const code = typeof body.code === 'string' && /^[A-Z_]+$/.test(body.code) ? body.code : '';
  const requestId = typeof body.requestId === 'string' && /^[a-f0-9-]{36}$/i.test(body.requestId) ? body.requestId : '';
  if (!code || message.includes('문의번호')) return message;
  const action = typeof body.action === 'string' && !message.includes(body.action) ? ` ${body.action}` : '';
  return `${message}${action} (오류 ${code}${requestId ? ` · 문의번호 ${requestId}` : ''})`;
}

export async function readApiJson(response: Response, fallback?: string): Promise<any> {
  let data: any;
  try {
    data = response.status === 204 ? {} : await response.json();
    if (!data || typeof data !== 'object') throw new Error('Invalid JSON shape');
  }
  catch {
    const action = response.status === 413
      ? '파일 크기를 줄이고 기존 처리 결과를 먼저 확인해주세요.'
      : response.status === 401
        ? '새 탭에서 다시 로그인하고 기존 처리 결과를 먼저 확인해주세요.'
        : '처리 결과를 먼저 확인한 뒤 다시 이용해주세요.';
    throw new Error(apiErrorMessage({ error: `서버 응답을 읽지 못했습니다. (HTTP ${response.status})`,
      code: 'RESPONSE_INVALID', action, requestId: response.headers?.get('X-Request-ID') }));
  }
  // Opt in for callers that do not need to inspect partial-success/status details.
  if (fallback && (!response.ok || data.ok === false || data.error)) throw new Error(apiErrorMessage(data, fallback));
  return data;
}
