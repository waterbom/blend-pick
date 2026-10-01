import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

// Only controlled descriptions belong here. Never return/log SQL, request bodies,
// cookies, payment keys, provider payloads or arbitrary Error.message values.
const catalog = {
  INVALID_JSON: [400, '요청 내용을 읽을 수 없습니다.', '화면을 새로고침한 뒤 입력 내용을 다시 확인해주세요.'],
  INVALID_BODY: [400, '요청 데이터 형식이 올바르지 않습니다.', '입력 항목을 확인해주세요.'],
  REQUEST_TOO_LARGE: [413, '한 번에 보낸 데이터가 너무 큽니다.', '항목 수를 줄여서 다시 요청해주세요.'],
  INVALID_INPUT: [400, '입력값의 형식이나 범위가 올바르지 않습니다.', '입력한 값과 선택 항목을 확인해주세요.'],
  AUTH_REQUIRED: [401, '로그인 또는 본인 인증이 만료되었습니다.', '다시 인증한 뒤 이용해주세요.'],
  FORBIDDEN: [403, '이 작업을 처리할 권한이 없습니다.', '로그인한 계정과 접근 권한을 확인해주세요.'],
  NOT_FOUND: [404, '요청한 항목을 찾을 수 없습니다.', '목록을 새로고침해 항목을 확인해주세요.'],
  STATE_CONFLICT: [409, '다른 처리로 상태가 바뀌었거나 이미 처리 중입니다.', '현재 처리 결과를 먼저 확인해주세요.'],
  DUPLICATE_DATA: [409, '이미 등록되었거나 동시에 처리된 항목입니다.', '목록에서 기존 처리 결과를 먼저 확인해주세요.'],
  RELATED_DATA: [409, '연결된 데이터 때문에 작업을 완료할 수 없습니다.', '연결 항목과 현재 상태를 확인해주세요.'],
  REFUND_IN_PROGRESS: [409, '환불 처리 중인 주문의 배송 상태는 변경할 수 없습니다.', '환불 결과를 먼저 확인해주세요.'],
  RATE_LIMITED: [429, '짧은 시간에 요청이 많이 들어왔습니다.', '잠시 기다린 뒤 다시 확인해주세요.'],
  DB_UNAVAILABLE: [503, '데이터 저장소에 연결하지 못했습니다.', '처리 결과를 먼저 확인하고 잠시 후 다시 이용해주세요.'],
  DB_BUSY: [503, '동시 처리로 데이터 저장이 지연되었습니다.', '처리 결과를 먼저 확인하고 같은 요청으로 다시 확인해주세요.'],
  DB_SCHEMA_MISMATCH: [503, '서버 데이터 구조와 프로그램 버전이 맞지 않습니다.', '관리자에게 문의번호를 전달해주세요.'],
  UPSTREAM_TIMEOUT: [504, '외부 서비스의 응답 시간을 초과했습니다.', '이미 처리됐을 수 있으니 기존 결과를 먼저 확인해주세요.'],
  UPSTREAM_UNAVAILABLE: [503, '외부 서비스에 연결하지 못했습니다.', '처리 결과를 먼저 확인하고 잠시 후 다시 이용해주세요.'],
  UPSTREAM_INVALID_RESPONSE: [502, '외부 서비스의 응답 형식을 확인하지 못했습니다.', '기존 처리 결과를 먼저 확인해주세요.'],
  PAYMENT_REVIEW_REQUIRED: [503, '결제 승인 또는 주문 저장 결과 확인이 필요합니다.', '다시 결제하지 말고 주문 내역을 확인하거나 관리자에게 문의해주세요.'],
  REFUND_REVIEW_REQUIRED: [503, '환불 또는 취소 저장 결과 확인이 필요합니다.', '결제사 환불 내역을 확인하고 같은 주문에서 결과를 확인해주세요.'],
  PARTIAL_FAILURE: [200, '일부 항목을 처리하지 못했습니다.', '성공한 항목과 실패한 항목을 확인해주세요.'],
  INTERNAL_ERROR: [500, '서버에서 요청을 처리하는 중 오류가 발생했습니다.', '처리 결과를 먼저 확인하고 문의번호를 관리자에게 전달해주세요.'],
} as const;
export type ApiErrorCode = keyof typeof catalog;
type ErrorContext = { requestId: string; operation: string; method: string; reported: WeakSet<object> };
const context = new AsyncLocalStorage<ErrorContext>();

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, message?: string, public status: number = catalog[code][0], options?: { cause?: unknown }) {
    super(message || catalog[code][1], options);
    this.name = 'ApiError';
  }
}
export function statusErrorCode(status: number): ApiErrorCode {
  return ({400:'INVALID_INPUT',401:'AUTH_REQUIRED',403:'FORBIDDEN',404:'NOT_FOUND',409:'STATE_CONFLICT',413:'REQUEST_TOO_LARGE',429:'RATE_LIMITED',502:'UPSTREAM_INVALID_RESPONSE',503:'UPSTREAM_UNAVAILABLE',504:'UPSTREAM_TIMEOUT'} as Record<number, ApiErrorCode>)[status] || 'INTERNAL_ERROR';
}
function sourceCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return;
  const e = error as {code?: unknown; cause?: unknown};
  // An allowlist avoids logging identifiers masquerading as error codes.
  const allowed = /^(?:22P02|22003|23502|23503|23505|23514|40001|40P01|55P03|57014|53300|57P0[123]|42P01|42703|42883|42804|P2001|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT|UND_ERR_HEADERS_TIMEOUT)$/;
  if (typeof e.code === 'string' && allowed.test(e.code)) return e.code;
  if (e.cause && e.cause !== e && typeof e.cause === 'object') {
    const nested = (e.cause as {code?: unknown}).code;
    if (typeof nested === 'string' && allowed.test(nested)) return nested;
  }
}
export function describeApiError(error: unknown) {
  if (error instanceof ApiError) return {code:error.code, status:error.status, message:error.message, action:catalog[error.code][2]};
  const source = sourceCode(error);
  let code: ApiErrorCode = 'INTERNAL_ERROR';
  if (source === '23505') code = 'DUPLICATE_DATA';
  else if (source === '23503') code = 'RELATED_DATA';
  else if (['22P02','22003','23502','23514'].includes(source || '')) code = 'INVALID_INPUT';
  else if (source === 'P2001') code = 'REFUND_IN_PROGRESS';
  else if (['40001','40P01','55P03','57014'].includes(source || '')) code = 'DB_BUSY';
  else if (['42P01','42703','42883','42804'].includes(source || '')) code = 'DB_SCHEMA_MISMATCH';
  else if (['53300','57P01','57P02','57P03'].includes(source || '')) code = 'DB_UNAVAILABLE';
  else if (['ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT'].includes(source || '') || (error instanceof Error && ['TimeoutError','AbortError'].includes(error.name))) code = 'UPSTREAM_TIMEOUT';
  else if (source) code = 'UPSTREAM_UNAVAILABLE';
  return {code, status:catalog[code][0] as number, message:catalog[code][1] as string, action:catalog[code][2] as string};
}

export function reportApiError(error: unknown, operation?: string) {
  const info = describeApiError(error);
  const ctx = context.getStore();
  const requestId = ctx?.requestId || randomUUID();
  if (ctx && error && typeof error === 'object') {
    if (ctx.reported.has(error)) return {...info, requestId};
    ctx.reported.add(error);
  }
  const origin = error instanceof Error && error.cause ? error.cause : error;
  const digest = error && typeof error === 'object' && 'digest' in error ? error.digest : undefined;
  const frames = origin instanceof Error ? (origin.stack || '').split('\n').slice(1)
    .map(line => line.match(/(?:\/?[\w.@-]+[\/])+[\w.@-]+:\d+:\d+/)?.[0]).filter(Boolean).slice(0,4) : [];
  const event = {event:'api_error', requestId, operation:operation || ctx?.operation || 'background', method:ctx?.method,
    code:info.code, cause:catalog[info.code][1], rootCause:catalog[describeApiError(origin).code][1],
    sourceCode:sourceCode(origin), errorType:origin instanceof Error && ['Error','TypeError','RangeError','SyntaxError','TimeoutError','AbortError','ApiError'].includes(origin.name) ? origin.name : undefined, frames};
  if (typeof digest === 'string' && /^[a-z0-9-]{1,80}$/i.test(digest)) Object.assign(event, {renderDigest:digest});
  // Expected validation/state conflicts are warnings; service failures are errors.
  (info.status >= 500 ? console.error : console.warn)(JSON.stringify(event));
  return {...info, requestId};
}

function failureBody(body: Record<string, unknown>, info: ReturnType<typeof describeApiError>, requestId: string) {
  const message = info.message;
  const action = info.status >= 500 && context.getStore()?.operation.includes('/api/payment/') ? catalog.PAYMENT_REVIEW_REQUIRED[2] : info.action;
  return {...body, ok:false, error: info.status >= 500 ? `${message} ${action} (오류 ${info.code} · 문의번호 ${requestId})` : message,
    code:info.code, requestId, action, retryable:false};
}
export function apiErrorResponse(error: unknown, body: Record<string, unknown> = {}, init?: ResponseInit) {
  const info = reportApiError(error);
  const status = info.code === 'INTERNAL_ERROR' && (init?.status || 0) >= 500 ? init!.status! : info.status;
  return NextResponse.json(failureBody(body, info, info.requestId), { ...init, status, headers:{...Object.fromEntries(new Headers(init?.headers)), 'Cache-Control':'no-store','X-Request-ID':info.requestId} });
}
export function apiErrorDetails(error: unknown) {
  const info = reportApiError(error);
  return {...failureBody({}, info, info.requestId), httpStatus:info.status};
}

// Preserve route argument types, redirects, cookie headers, downloads and successful
// response shapes. There are deliberately NO automatic retries of writes or payments.
export function withApiErrors<A extends unknown[]>(operation: string, handler: (...args: A) => Promise<Response>) {
  return (...args: A): Promise<Response> => context.run({requestId:randomUUID(), operation, method:operation.split(' ')[0], reported:new WeakSet()}, async () => {
    try {
      const response = await handler(...args);
      if (!response.headers.get('content-type')?.includes('application/json')) return response;
      // Only clone normal JSON errors; successful lists/downloads remain untouched.
      if (response.status < 400 && !['PATCH /api/admin/orders','POST /api/admin/shipments/import'].includes(operation)) return response;
      const body = await response.clone().json().catch(() => null);
      if (!body || typeof body !== 'object' || Array.isArray(body) || (response.status < 400 && body.ok !== false)) return response;
      if (typeof body.requestId === 'string' && /^[a-f0-9-]{36}$/i.test(body.requestId)) {
        response.headers.set('X-Request-ID', body.requestId); response.headers.set('Cache-Control','no-store');
        return response;
      }
      const code = response.status < 400 ? 'PARTIAL_FAILURE' : statusErrorCode(response.status);
      let message = typeof body.error === 'string' ? body.error : catalog[code][1];
      if (/^(Unauthorized|Forbidden|Not found|Order not found|Invalid.*|Internal server error|invalid.*|product_id required)$/i.test(message)) message = catalog[code][1];
      if (response.status >= 500) message = catalog[code][1];
      const info = reportApiError(new ApiError(code, message, response.status));
      const headers = new Headers(response.headers);
      headers.set('Cache-Control','no-store'); headers.set('X-Request-ID', info.requestId);
      headers.delete('Content-Length'); headers.delete('ETag');
      return NextResponse.json(failureBody(body, info, info.requestId), {status:response.status, headers});
    } catch (error) {
      // Next.js uses these exceptions for control flow, not application failures.
      const digest = error && typeof error === 'object' && 'digest' in error ? error.digest : undefined;
      if (typeof digest === 'string' && /^(NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|DYNAMIC_SERVER_USAGE)/.test(digest)) throw error;
      return apiErrorResponse(error);
    }
  });
}

export async function rollbackSafely(client: {query: (sql: string) => Promise<unknown>}) {
  try { await client.query('ROLLBACK'); return true; }
  catch (error) { reportApiError(error, 'transaction.rollback'); return false; }
}

export async function readJsonObject(request: Request, maxBytes = 2 * 1024 * 1024): Promise<Record<string, any>> {
  if (Number(request.headers?.get('content-length')) > maxBytes) throw new ApiError('REQUEST_TOO_LARGE');
  let body: unknown;
  if (request.body) {
    const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const {done, value} = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { void reader.cancel().catch(() => {}); throw new ApiError('REQUEST_TOO_LARGE'); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
      try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new ApiError('INVALID_JSON'); }
    } finally { reader.releaseLock(); }
  } else {
    try { body = await request.json(); } catch { throw new ApiError('INVALID_JSON'); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError('INVALID_BODY');
  return body as Record<string, any>;
}
