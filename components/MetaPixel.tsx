"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { META_PIXEL_ID, fbqTrack, flushMetaEvents, isPixelRoute } from "@/lib/analytics";

// Initial and client-side PageViews share one path; script readiness flushes early events.
export default function MetaPixel() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (pathname && isPixelRoute(pathname)) fbqTrack("PageView");
  }, [pathname]);

  if (!/^\d+$/.test(META_PIXEL_ID) || !pathname || !isPixelRoute(pathname)) return null;
  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive" onReady={flushMetaEvents}>
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('set', 'autoConfig', false, '${META_PIXEL_ID}');
fbq('init', '${META_PIXEL_ID}');`}
      </Script>
      <noscript>
        <img height="1" width="1" style={{ display: "none" }} alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`} />
      </noscript>
    </>
  );
}
