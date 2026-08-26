import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /hotel/reserve → /hotel/utop 경로 개편 — 카톡 등에 공유된 옛 링크(?inf= 쿼리 포함) 유지
  async redirects() {
    return [
      { source: "/hotel/reserve", destination: "/hotel/utop", permanent: true },
      { source: "/hotel/reserve/checkout", destination: "/hotel/utop/checkout", permanent: true },
    ];
  },
};

export default nextConfig;
