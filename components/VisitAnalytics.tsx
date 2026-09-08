'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { pageGroup } from '@/lib/visit-analytics/rules';
import { browserVisitor } from '@/lib/visit-analytics/client';

export default function VisitAnalytics() {
  const pathname = usePathname();
  const lastView = useRef<string | null>(null);
  useEffect(() => {
    // pathname 변경만 계측: 쿼리/해시/컴포넌트 재렌더/prefetch는 별도 조회로 세지 않는다.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const send = () => {
      if (document.visibilityState !== 'visible') return;
      const path = window.location.pathname;
      if (lastView.current === path) return;
      lastView.current = path;
      const page = pageGroup(path);
      if (!page) return;
      try {
        const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
        if (nav.globalPrivacyControl || nav.doNotTrack === '1' || localStorage.getItem('bp_analytics_optout') === '1') return;
        const visitorId = browserVisitor(localStorage, Date.now(), () => crypto.randomUUID());
        if (!visitorId) return;
        const body = JSON.stringify({ eventId: crypto.randomUUID(), visitorId, page });
        // 재전송에는 같은 eventId를 사용한다. 구매 화면에는 영향을 주지 않는다.
        const post = () => fetch('/api/analytics/pageview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, credentials: 'same-origin', keepalive: true });
        void post().then(r => { if (r.status >= 500) timer = setTimeout(() => { void post().catch(() => {}); }, 1500); }).catch(() => { timer = setTimeout(() => { void post().catch(() => {}); }, 1500); });
      } catch { /* analytics must not interrupt storefront */ }
    };
    send();
    document.addEventListener('visibilitychange', send);
    return () => { document.removeEventListener('visibilitychange', send); if (timer) clearTimeout(timer); };
  }, [pathname]);
  return null;
}
