export type SanjiIconName = "home" | "grid" | "leaf" | "fish" | "clock" | "spark" | "pin" | "user" | "cart" | "truck" | "chevron";

export default function SanjiIcon({ name, size = 24 }: { name: SanjiIconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === "home" && <><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z" /></>}
    {name === "grid" && <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>}
    {name === "leaf" && <><path d="M20 3C10 2 3 6 4 13c1 7 13 10 16-10Z" /><path d="M3 22 16 8M7 17l-1-6M11 13l6 1" /></>}
    {name === "fish" && <><path d="M3 12s4-7 10-7c4 0 7 4 8 7-1 3-4 7-8 7-6 0-10-7-10-7Zm0 0-1-6m1 6-1 6M13 5l-3-3m3 17-3 3" /><circle cx="16" cy="10" r=".7" /></>}
    {name === "clock" && <><circle cx="12" cy="13" r="8" /><path d="M12 8v5l3 2M9 2h6" /></>}
    {name === "spark" && <><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z" /></>}
    {name === "pin" && <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>}
    {name === "user" && <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>}
    {name === "cart" && <><path d="M2 3h3l2 12h12l2-9H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>}
    {name === "truck" && <><path d="M2 5h12v12H2zM14 9h4l4 4v4h-8" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>}
    {name === "chevron" && <path d="m9 5 7 7-7 7" />}
  </svg>;
}
