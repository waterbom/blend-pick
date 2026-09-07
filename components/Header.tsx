import { sanjiLinkBase } from "@/lib/sanji-link";
import { cookies } from "next/headers";
import { verifyToken, verifyAdminToken } from "@/lib/auth";
import pool from "@/lib/db";
import HeaderClient from "@/components/HeaderClient";
import { currentSite } from "@/lib/site-server";

export default async function Header() {
  let user = null;
  let isAdmin = false;
  let isInfluencer = false;
  const site = await currentSite(); // 블랜드픽 / 산지픽 — 로고·네비 분기

  try {
    const cookieStore = await cookies();

    // 어드민 토큰 우선 확인
    const adminToken = cookieStore.get("admin_token")?.value;
    if (adminToken) {
      const adminPayload = await verifyAdminToken(adminToken);
      if (adminPayload) {
        user = { nickname: adminPayload.name, name: adminPayload.name, profile_image: null };
        isAdmin = true;
      }
    }

    // 일반 유저 토큰
    if (!isAdmin) {
      const token = cookieStore.get("shop_token")?.value;
      if (token) {
        const payload = await verifyToken(token);
        if (payload) {
          const result = await pool.query(
            "SELECT nickname, name, profile_image, email, role FROM shop_users WHERE id = $1",
            [payload.id]
          );
          if (result.rows.length > 0) {
            user = result.rows[0];
            isInfluencer = result.rows[0].role === "influencer";
          }
        }
      }
    }
  } catch {
    // 유저 정보 못 가져오면 비로그인 상태로
  }

  return (
    <HeaderClient
      user={user}
      isAdmin={isAdmin}
      isInfluencer={isInfluencer}
      site={{ key: site.key, nameEn: site.nameEn, basePath: site.key === "sanjipick" ? await sanjiLinkBase() : site.basePath }}
    />
  );
}
