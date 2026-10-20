import { productStage, linkStage } from '@/lib/admin-workflow';

export interface ProductListItem {
  id: string; name: string; brand?: string | null; category?: string | null;
  sale_type?: string; sale_start_at?: string | null; sale_end_at?: string | null;
  price: number | string; stock: number; status: string; main_image?: string | null;
  product_code?: string | null; created_at: string;
  link_code?: string | null; link_start_at?: string | null; link_end_at?: string | null;
}
export type ProductListFilters = { f?: string; q?: string; category?: string; sale?: string; link?: string; from?: string; to?: string };

export function productListView(all: ProductListItem[], filters: ProductListFilters, now: number) {
  const aliases: Record<string, string> = { active: 'selling', soldout: 'closed' };
  const candidate = aliases[filters.f || ''] || filters.f || 'selling';
  const stage = ['all','ready','selling','closed','warn','linked'].includes(candidate) ? candidate : 'selling';
  const counts = { all: all.length, ready: 0, selling: 0, closed: 0, warn: 0 };
  for (const p of all) { counts[productStage(p,now)]++; if (p.status==='active' && Number(p.stock)===0) counts.warn++; }
  const products = all.filter(p => {
    if (['ready','selling','closed'].includes(stage) && productStage(p,now)!==stage) return false;
    if (stage==='warn' && !(p.status==='active' && Number(p.stock)===0)) return false;
    if (stage==='linked' && linkStage(p,now)==='없음') return false;
    if (filters.category && p.category!==filters.category) return false;
    if (filters.sale && p.sale_type!==filters.sale) return false;
    if (filters.link && linkStage(p,now)!==filters.link) return false;
    const q=(filters.q||'').trim().toLowerCase();
    return !q || [p.name,p.brand,p.product_code].some(value=>String(value||'').toLowerCase().includes(q));
  });
  return {stage, counts, products};
}
