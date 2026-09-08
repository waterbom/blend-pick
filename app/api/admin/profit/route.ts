import { currentAdminSite } from "@/lib/admin-site";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken } from "@/lib/auth";
import pool from "@/lib/db";
import shopPool from "@/lib/db-shop";
import { financialOrders, orderAmounts, validDateRange } from "@/lib/order-finance";
export async function GET(req: Request) {
    const token = (await cookies()).get('admin_token')?.value;
    if (!token || !await verifyAdminToken(token))
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const site = (await currentAdminSite()).key;
    const p = new URL(req.url).searchParams, from = p.get('from'), to = p.get('to'), channel = p.get('channel');
    if (!validDateRange(from, to))
        return NextResponse.json({ error: '조회 기간을 확인해주세요.' }, { status: 400 });
    const [orders, costs] = await Promise.all([financialOrders(site, from, to), shopPool.query(`SELECT campaign_id,
 COALESCE(SUM(amount) FILTER(WHERE category='shipping'),0) AS shipping_cost,
 COALESCE(SUM(amount) FILTER(WHERE category<>'shipping'),0) AS other_costs FROM campaign_costs WHERE site=$1 GROUP BY campaign_id`, [site])]);
    type Row = {
        campaign_id: string | null;
        label: string;
        channel: string;
        influencer_id: string | null;
        influencer_name: string | null;
        business_type: string | null;
        period: string | null;
        orders: number;
        qty: number;
        gross: number;
        sales_vat: number;
        supply_cost: number;
        missing_supply: number;
        shipping_cost: number;
        pg_fee: number;
        fee_estimated: boolean;
        other_costs: number;
        commission: number;
        rate: null;
        net_profit: number | null;
        review_reasons: string[];
        refunds: number;
    };
    const groups = new Map<string, Row>();
    for (const o of orders) {
        const kind = ['hotel', 'extra'].includes(o.order_type) ? 'hotel' : o.campaign_id ? 'campaign' : 'shop';
        if (channel && channel !== kind || site === 'sanjipick' && kind === 'hotel')
            continue;
        const key = kind === 'hotel' ? 'hotel:' + o.influencer_id : (o.campaign_id || 'shop');
        let row = groups.get(key);
        if (!row) {
            row = { campaign_id: o.campaign_id, label: kind === 'hotel' ? `호텔 공구 · ${o.influencer_name || '직접 유입'}` : o.campaign_id ? o.items[0]?.product_name || '(과거 공구)' : '자사몰 일반판매', channel: kind, influencer_id: kind === 'hotel' ? o.influencer_id : null, influencer_name: kind === 'hotel' ? o.influencer_name : null, business_type: null, period: null, orders: 0, qty: 0, gross: 0, sales_vat: 0, supply_cost: 0, missing_supply: 0, shipping_cost: 0, pg_fee: 0, fee_estimated: false, other_costs: 0, commission: 0, rate: null, net_profit: null, review_reasons: [], refunds: 0 };
            groups.set(key, row);
        }
        const a = orderAmounts(o);
        row.orders++;
        row.gross += a.goods;
        row.refunds += a.refund;
        row.qty += o.items.reduce((s, i) => s + Number(i.quantity), 0);
        row.pg_fee += a.pgFee;
        row.fee_estimated ||= a.feeEstimated;
        if (a.unresolved)
            row.review_reasons.push('환불 금액 미확인');
        if (kind === 'hotel') {
            row.fee_estimated = true;
            const supply = Math.round(a.goods * .88), commission = o.influencer_id ? Math.round(a.goods * Number(o.commission_rate ?? 5) / 100) : 0, pgFee = Math.round(a.net * .017);
            row.supply_cost += supply;
            row.commission += commission;
            row.pg_fee += pgFee - a.pgFee;
            row.sales_vat += Math.max(0, Math.round(a.goods * .12 / 11) - Math.round(commission / 11) - Math.round(pgFee / 11));
        }
        else {
            if (!a.lines.length || a.lines.some(i => i.supply_price == null)) {
                row.missing_supply++;
                row.review_reasons.push('공급가 미입력');
            }
            for (const i of a.lines) {
                // A refund alone does not prove that supplier costs were recovered. Keep the booked cost.
                row.supply_cost += Number(i.supply_price || 0) * Number(i.quantity);
                row.commission += i.commission ?? 0;
                row.sales_vat += i.vat ?? 0;
                if (i.commission === null)
                    row.review_reasons.push('주문 당시 수수료율 미확인');
                if (i.vat === null && i.gross > 0)
                    row.review_reasons.push('주문 당시 과세 구분 미확인');
            }
            if (a.refund > 0)
                row.review_reasons.push('환불 후 회수 원가 확인 필요');
        }
    }
    const campaignIds = [...groups.values()].map(r => r.campaign_id).filter(Boolean);
    const metadata = campaignIds.length ? await pool.query(`SELECT c.id,p.name AS product_name,c.influencer_id,i.name AS influencer_name,i.business_type,
 to_char(c.start_date,'YYYY-MM-DD') AS start_date,to_char(c.end_date,'YYYY-MM-DD') AS end_date
 FROM campaigns c LEFT JOIN products p ON p.id=c.product_id LEFT JOIN influencers i ON i.id=c.influencer_id WHERE c.id=ANY($1::uuid[])`, [campaignIds]) : { rows: [] };
    for (const row of groups.values()) {
        const m = metadata.rows.find(m => m.id === row.campaign_id);
        if (m) {
            row.label = m.product_name || row.label;
            row.influencer_id = m.influencer_id;
            row.influencer_name = m.influencer_name;
            row.business_type = m.business_type;
            row.period = m.start_date && m.end_date ? `${m.start_date} ~ ${m.end_date}` : null;
        }
        const cost = costs.rows.find(c => c.campaign_id === row.campaign_id);
        if (row.channel !== 'hotel') {
            row.shipping_cost = Number(cost?.shipping_cost || 0);
            row.other_costs = Number(cost?.other_costs || 0);
        }
        row.review_reasons = [...new Set(row.review_reasons)];
        row.net_profit = row.review_reasons.length ? null : row.gross - row.sales_vat - row.supply_cost - row.shipping_cost - row.pg_fee - row.other_costs - row.commission;
    }
    return NextResponse.json([...groups.values()].sort((a, b) => b.gross - a.gross));
}
