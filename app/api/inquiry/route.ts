import { ApiError, withApiErrors, readJsonObject } from '@/lib/api-errors';
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { supplierProposalMessage, validateSupplierProposal } from '@/lib/supplier-proposal';

async function handlePOST(req: NextRequest) {
  const body = await readJsonObject(req);
  let inquiry = {
    name: body.name,
    contact: body.contact,
    category: body.category,
    message: body.message,
  };
  if (body.kind === 'supplier-proposal') {
    const result = validateSupplierProposal(body);
    if (!result.ok) throw new ApiError('INVALID_INPUT', result.error);
    inquiry = {
      name: result.value.name,
      contact: result.value.contact,
      category: '서비스문의',
      message: supplierProposalMessage(result.value),
    };
  }

  // 로그인 유저면 user_id 추출
  let userId = null;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("shop_token")?.value;
    if (token) {
      const payload = await verifyToken(token);
      userId = payload?.id || null;
    }
  } catch {}

  const osUrl = process.env.OS_API_URL || "http://localhost:8000";

  const signal = AbortSignal.timeout(10_000);
  let res: Response;
  try {
    res = await fetch(`${osUrl}/inquiries/api/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...inquiry,
        ...(userId ? { user_id: userId } : {}),
      }),
      signal,
    });
  } catch (error) {
    if (signal.aborted || (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))) {
      throw new ApiError('UPSTREAM_TIMEOUT', undefined, undefined, { cause: error });
    }
    throw new ApiError('UPSTREAM_UNAVAILABLE', undefined, undefined, { cause: error });
  }

  if (!res.ok) {
    throw new ApiError('UPSTREAM_UNAVAILABLE');
  }

  return NextResponse.json({ ok: true });
}

async function handleGET(req: NextRequest) {
  // 로그인 유저의 문의 내역 조회
  let userId = null;
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("shop_token")?.value;
    if (token) {
      const payload = await verifyToken(token);
      userId = payload?.id || null;
    }
  } catch {}

  if (!userId) {
    return NextResponse.json({ inquiries: [] });
  }

  const osUrl = process.env.OS_API_URL || "http://localhost:8000";
  const res = await fetch(`${osUrl}/inquiries/api/user/${userId}`);

  if (!res.ok) {
    return NextResponse.json({ inquiries: [] });
  }

  const data = await res.json();
  return NextResponse.json(data);
}

export const POST = withApiErrors('POST /api/inquiry', handlePOST);
export const GET = withApiErrors('GET /api/inquiry', handleGET);
