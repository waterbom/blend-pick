import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import pool from "@/lib/db";
import HeaderClient from "@/components/HeaderClient";

export default async function Header() {
  let user = null;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("shop_token")?.value;

    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
          const result = await pool.query(
          "SELECT nickname, name, profile_image, email FROM shop_users WHERE id = $1",
          [payload.id]
        );
        if (result.rows.length > 0) {
          user = result.rows[0];
        }
      }
    }
  } catch {
    // 유저 정보 못 가져오면 비로그인 상태로
  }

  const isAdmin = user?.email === "admin@blendpick.com";
  return <HeaderClient user={user} isAdmin={isAdmin} />;
}
