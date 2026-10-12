import SanjiIcon, { type SanjiIconName } from "@/components/sanji/SanjiIcon";

export default function SanjiBottomNav({ base, active }: { base: string; active: "home" | "catalog" }) {
  const items: { key: string; label: string; href: string; icon: SanjiIconName }[] = [
    { key: "home", label: "홈", href: base || "/", icon: "home" },
    { key: "catalog", label: "카테고리", href: `${base}/products`, icon: "grid" },
    { key: "orders", label: "주문·배송", href: "/orders/lookup", icon: "truck" },
    { key: "mypage", label: "내 정보", href: `${base}/mypage`, icon: "user" },
    { key: "cart", label: "장바구니", href: "/cart", icon: "cart" },
  ];
  return <nav className="sj-bottom-nav" aria-label="하단 메뉴">
    <style>{`.sj-bottom-nav{position:fixed;left:50%;transform:translateX(-50%);bottom:0;z-index:40;width:100%;max-width:480px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border-top:1px solid #ededed;background:#fff;padding:7px 4px calc(7px + env(safe-area-inset-bottom))}.sj-bottom-nav a{display:flex;min-height:46px;align-items:center;justify-content:center;flex-direction:column;gap:4px;text-decoration:none;color:#787878;font-size:11px;line-height:1.3}.sj-bottom-nav a[aria-current]{color:#C9430E;font-weight:700}.sj-bottom-nav a:focus-visible{outline:2px solid #C9430E;outline-offset:-2px}`}</style>
    {items.map(item => <a key={item.key} href={item.href} aria-current={active === item.key ? "page" : undefined}><SanjiIcon name={item.icon} size={23} />{item.label}</a>)}
  </nav>;
}
