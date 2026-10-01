import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";
import shopPool from "@/lib/db-shop";

async function handlePOST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("shop_token")?.value;

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "인증 정보가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  const db=await shopPool.connect();
  try {
    await db.query("BEGIN");
    // Keep financial event keys to prevent the worker from sending the same order notice again.
    await db.query("DELETE FROM customer_notifications WHERE user_id=$1 AND order_id IS NULL",[String(payload.id)]);
    await db.query("UPDATE customer_notifications SET user_id=NULL,phone=NULL,status=CASE WHEN status IN ('pending','blocked') THEN 'cancelled' ELSE status END WHERE user_id=$1",[String(payload.id)]);
    // Retain complaint records for the existing three-year policy without a usable account identity.
    await db.query("UPDATE customer_questions SET user_id=NULL,guest_hash='withdrawn:'||id::text,is_public=false WHERE user_id=$1",[String(payload.id)]);
    for(const table of ["customer_interests","customer_addresses","customer_reorder_requests"]) await db.query(`DELETE FROM ${table} WHERE user_id=$1`,[String(payload.id)]);
    await db.query("COMMIT");
  } catch(error) {await db.query("ROLLBACK");throw error;} finally {db.release();}
  await pool.query("DELETE FROM shop_users WHERE id = $1", [payload.id]);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("shop_token", "", { maxAge: 0, path: "/" });

  return res;
}

export const POST = withApiErrors('POST /api/auth/withdraw', handlePOST);
