import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from "next/server";
import { getSoldOutDates } from "@/lib/hotel-inventory";

// 객실 타입별 마감(재고 소진) 날짜 목록
async function handleGET(req: Request) {
  const room = new URL(req.url).searchParams.get("room") || "";
  if (!room) return NextResponse.json({ soldOut: [] });
  const soldOut = await getSoldOutDates(room);
  return NextResponse.json({ soldOut });
}

export const GET = withApiErrors('GET /api/hotel/availability', handleGET);
