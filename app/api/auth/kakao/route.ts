import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const redirect = req.nextUrl.searchParams.get("redirect") || "";

  const kakaoAuthUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  kakaoAuthUrl.searchParams.set("client_id", process.env.KAKAO_CLIENT_ID!);
  kakaoAuthUrl.searchParams.set("redirect_uri", process.env.KAKAO_REDIRECT_URI!);
  kakaoAuthUrl.searchParams.set("response_type", "code");
  kakaoAuthUrl.searchParams.set("scope", "profile_nickname profile_image talk_message");
  // 로그인 후 돌아갈 경로(내부 경로만 허용)를 state로 전달
  if (redirect.startsWith("/")) kakaoAuthUrl.searchParams.set("state", redirect);

  return NextResponse.redirect(kakaoAuthUrl.toString());
}
