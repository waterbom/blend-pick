import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // /hotel/reserve → /hotel/utop 경로 개편 — 카톡 등에 공유된 옛 링크(?inf= 쿼리 포함) 유지
  async redirects() {
    return [
      { source: "/hotel/reserve", destination: "/hotel/utop", permanent: true },
      { source: "/hotel/reserve/checkout", destination: "/hotel/utop/checkout", permanent: true },
    ];
  },
};

export default nextConfig;
