import { NextResponse } from "next/server";

export async function GET() {
  const kakaoAuthUrl = new URL("https://kauth.kakao.com/oauth/authorize");
  kakaoAuthUrl.searchParams.set("client_id", process.env.KAKAO_CLIENT_ID!);
  kakaoAuthUrl.searchParams.set("redirect_uri", process.env.KAKAO_REDIRECT_URI!);
  kakaoAuthUrl.searchParams.set("response_type", "code");
  kakaoAuthUrl.searchParams.set("scope", "profile_nickname profile_image talk_message");

  return NextResponse.redirect(kakaoAuthUrl.toString());
}
