import type { SiteKey } from '@/lib/sites';
export type AdminLink = { label: string; href: string; blendOnly?: boolean };
export type AdminGroup = { label: string; items: AdminLink[] };
export const ADMIN_GROUPS: AdminGroup[] = [
 {label:'운영 홈',items:[{label:'운영 요약',href:'/admin'},{label:'오늘 처리할 일',href:'/admin/operations'}]},
 {label:'상품 관리',items:[{label:'상품 조회·수정',href:'/admin/products'},{label:'상품 등록',href:'/admin/products/new'},{label:'엑셀 등록',href:'/admin/products/import'},{label:'카테고리',href:'/admin/categories'}]},
 {label:'주문·배송',items:[{label:'전체 주문',href:'/admin/orders'},{label:'출고·배송 흐름',href:'/admin/shipments'}]},
 {label:'매출·정산',items:[{label:'결제 정산',href:'/admin/settlements'},{label:'인플루언서 정산',href:'/admin/influencer-settlements'},{label:'수익 분석',href:'/admin/profit'},{label:'전시·비전시 실적',href:'/admin/link-sales'},{label:'방문 통계',href:'/admin/visits'}]},
 {label:'고객 관리',items:[{label:'회원 관리',href:'/admin/members'},{label:'리뷰 관리',href:'/admin/reviews'},{label:'카카오 상담·알림',href:'/admin/notifications'}]},
 {label:'공구 운영',items:[{label:'인플루언서',href:'/admin/influencers'},{label:'숙박 예약',href:'/admin/reservations',blendOnly:true}]},
 {label:'설정·시스템',items:[{label:'결제 확인·복구',href:'/admin/payment-recovery'},{label:'서버 트래픽',href:'/admin/traffic'},{label:'자동 점검',href:'/admin/monitoring'}]},
];
const SANJI_LABELS: Record<string,string> = {
 '/admin/shipments':'농가 출고·배송', '/admin/reviews':'구매 후기',
 '/admin/influencers':'공구 파트너', '/admin/influencer-settlements':'공구 파트너 정산',
 '/admin/notifications':'카카오 상담·알림',
};
export function adminGroups(site: SiteKey) {
 return ADMIN_GROUPS.map(g=>({
  ...g,label:site==='sanjipick'&&g.label==='공구 운영'?'산지 공구':g.label,
  items:g.items.filter(i=>site==='blendpick'||!i.blendOnly).map(i=>({...i,label:site==='sanjipick'?SANJI_LABELS[i.href]??i.label:i.label})),
 }));
}
export function adminLocation(path: string, site: SiteKey) {
 const groups=adminGroups(site);
 const matches=groups.flatMap(g=>g.items.map(i=>({...i,group:g.label}))).filter(i=>path===i.href || i.href!=='/admin'&&path.startsWith(i.href+'/')).sort((a,b)=>b.href.length-a.href.length);
 return matches[0] ?? {label:'관리자',href:'/admin',group:'운영 홈'};
}
