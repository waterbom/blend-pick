"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { SiteKey } from "@/lib/sites";

export default function StorefrontFrame({ site, children }: { site: SiteKey; children: ReactNode }) {
  const path = (usePathname() || "/").replace(/^\/sanji(?=\/|$)/, "");
  const workspace = /^\/(admin|influencer|partners)(?:\/|$)/.test(path);
  if (site !== "sanjipick" || workspace) return <>{children}</>;
  return <div className="sanji-mobile-shell">{children}</div>;
}
