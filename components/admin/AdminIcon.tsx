import type { CSSProperties } from 'react';
export type AdminIconName = 'home' | 'box' | 'truck' | 'chart' | 'users' | 'calendar' | 'settings' | 'search' | 'bell' | 'arrow' | 'plus' | 'menu' | 'close' | 'logout' | 'wallet' | 'check';
const paths: Record<AdminIconName, string> = {
 home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
 box:'m3 7 9-4 9 4-9 4Zm0 0v10l9 4 9-4V7M12 11v10M7.5 5 16 9',
 truck:'M3 5h11v12H3ZM14 9h4l3 4v4h-7M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4M17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
 chart:'M4 4v16h17M8 14l4-5 4 3 5-7',
 users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M17 4a4 4 0 0 1 0 7M22 21v-2a4 4 0 0 0-3-3.87',
 calendar:'M4 5h16v16H4ZM8 3v4M16 3v4M4 11h16M8 15h2M14 15h2',
 settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z',
 search:'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15M16 16l5 5',
 bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
 arrow:'M5 12h14M13 6l6 6-6 6', plus:'M12 5v14M5 12h14',
 menu:'M4 6h16M4 12h16M4 18h16', close:'m6 6 12 12M6 18 18 6',
 logout:'M10 3H4v18h6M10 12h11M17 8l4 4-4 4',
 wallet:'M3 6h17v15H3ZM3 6V3h14v3M16 11h5v5h-5Z', check:'m5 12 4 4L19 6',
};
export default function AdminIcon({name,style}:{name:AdminIconName;style?:CSSProperties}) {
 return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" style={style}><path d={paths[name]}/></svg>;
}
