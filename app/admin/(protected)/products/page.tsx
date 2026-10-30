import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAdminToken } from '@/lib/auth';
import shopPool from '@/lib/db-shop';
import { currentAdminSite, adminProductScopeSql } from '@/lib/admin-site';
import type { SiteKey } from '@/lib/sites';
import { emptySalesCounts, getProductSales, type ProductSales } from '@/lib/product-sales';
import { validDateRange } from '@/lib/order-finance';
import ProductsListView from '@/components/admin/ProductsListView';
import { getProductFinancials, type ProductMoney, emptyProductMoney } from '@/lib/product-financials';
import type { ProductListFilters, ProductListItem } from '@/lib/admin-product-list';

// 접속 도메인 범위의 상품만 — 산지픽 어드민은 산지픽 카테고리, Shop 어드민은 그 외
async function getProducts(site: SiteKey) {
  const c = adminProductScopeSql(site, "category", 1);
  const result = await shopPool.query(`
    SELECT id, name, brand, category, sale_type, sale_start_at, sale_end_at, price, stock, status, main_image, product_code, created_at, link_price, link_code, link_start_at, link_end_at
    FROM products_shop
    WHERE ${c.sql} AND archived_at IS NULL
    ORDER BY created_at DESC
  `, [c.param]);
  // 조회 시각도 함께 — 판매 단계·링크 상태 판정 기준 (렌더 중 Date.now() 호출을 피해 데이터 로딩 단계에서 한 번만)
  return { rows: result.rows, now: Date.now() };
}

export default async function AdminProductsPage({searchParams}: {searchParams: Promise<ProductListFilters>}) {
  const token=(await cookies()).get('admin_token')?.value;
  if (!token || !await verifyAdminToken(token)) redirect('/login');
  const site=await currentAdminSite();
  const {rows,now}=await getProducts(site.key);
  const all=rows as ProductListItem[];
  const raw=await searchParams;
  const filters=Object.fromEntries(Object.entries(raw).filter(([,value])=>typeof value==='string')) as ProductListFilters;
  const from=filters.from||'',to=filters.to||'';
  let sales: Record<string,ProductSales>|null=null, financials: Record<string,ProductMoney>|null=null, salesError='';
  if ((raw.from!==undefined&&typeof raw.from!=='string') || (raw.to!==undefined&&typeof raw.to!=='string') || !validDateRange(from||null,to||null)) {
    salesError='판매 집계 기간을 확인해주세요. 시작일은 종료일보다 늦을 수 없습니다.';
  } else {
    try {
      const [result, money]=await Promise.all([getProductSales(site.key,from,to),getProductFinancials(site.key,from,to)]);
      sales=Object.fromEntries(all.map(p=>[p.id,result.get(p.id)??{...emptySalesCounts(),options:[]}]));
      financials=Object.fromEntries(all.map(p=>[p.id,money.get(p.id)??emptyProductMoney()]));
    } catch(error) { console.error('[admin/products] sales lookup failed',error); salesError='판매량을 불러오지 못했습니다. 잠시 후 다시 조회해주세요.'; }
  }
  return <ProductsListView all={all} now={now} filters={filters} sales={sales} financials={financials} salesError={salesError} site={site.key}/>;
}
