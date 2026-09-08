import pool from "@/lib/db";
import shopPool from "@/lib/db-shop";
import type { SiteKey } from "@/lib/sites";
import { financialOrders, orderAmounts } from "@/lib/order-finance";
import { calcPayout, HOTEL_PAYOUT_CAMPAIGN_ID, HOTEL_LABEL, type BusinessType } from "@/lib/settlement";
export async function influencerFinance(site: SiteKey, db: import('pg').Pool | import('pg').PoolClient = shopPool) {
    const [orders, payouts] = await Promise.all([financialOrders(site,undefined,undefined,db), db.query('SELECT * FROM influencer_payouts WHERE site=$1', [site])]);
    type Bucket = {
        campaign_id: string;
        influencer_id: string;
        product_name: string;
        influencer_name: string;
        orders: Set<string>;
        qty: number;
        gross: number;
        commission: number;
        rates: Set<number>;
        review: Set<string>;
    };
    const buckets = new Map<string, Bucket>();
    const get = (id: string, inf: string, name: string, infName: string) => {
        const key = id + ':' + inf;
        let b = buckets.get(key);
        if (!b) {
            b = { campaign_id: id, influencer_id: inf, product_name: name, influencer_name: infName, orders: new Set(), qty: 0, gross: 0, commission: 0, rates: new Set(), review: new Set() };
            buckets.set(key, b);
        }
        return b;
    };
    for (const o of orders) {
        if (!o.influencer_id || !['shop', 'campaign', 'hotel'].includes(o.order_type))
            continue;
        if (site === 'sanjipick' && o.order_type === 'hotel')
            continue;
        const a = orderAmounts(o);
        for (const line of a.lines) {
            const id = o.order_type === 'hotel' ? HOTEL_PAYOUT_CAMPAIGN_ID : o.campaign_id || line.product_ref || line.product_id || ('legacy:' + o.id);
            const b = get(id, o.influencer_id, o.order_type === 'hotel' ? HOTEL_LABEL : line.product_name || '(과거 상품)', o.influencer_name || '(정보 확인 필요)');
            b.orders.add(o.id);
            b.qty += Number(line.quantity);
            b.gross += line.gross;
            b.commission += line.commission ?? 0;
            if (line.rate !== null)
                b.rates.add(line.rate);
            if (a.unresolved)
                b.review.add('환불 금액 확인 필요');
            if (line.commission === null)
                b.review.add('주문 당시 수수료율 확인 필요');
            if (id.startsWith('legacy:'))
                b.review.add('삭제된 상품의 정산 연결 확인 필요');
        }
    }
    // Paid history remains visible even if all sales were refunded or a legacy product reference was deleted.
    for (const p of payouts.rows)
        get(p.campaign_id, p.influencer_id, '(과거 정산 기록)', '(정보 확인 필요)');
    const ids = [...new Set([...buckets.values()].map(b => b.influencer_id))];
    const info = ids.length ? await pool.query('SELECT * FROM influencers WHERE id=ANY($1::uuid[])', [ids]) : { rows: [] };
    const imap = new Map(info.rows.map(i => [i.id, i]));
    const pmap = new Map(payouts.rows.map(p => [p.campaign_id + ':' + p.influencer_id, p]));
    return [...buckets.entries()].map(([key, b]) => {
        const i = imap.get(b.influencer_id), p = pmap.get(key) || null;
        const businessType = i?.business_type as BusinessType | null;
        const knownType = ['general', 'simplified', 'freelancer'].includes(businessType || '');
        const review = [...b.review];
        const commission = review.length ? null : b.commission;
        return { ...b, orders: b.orders.size, rates: undefined, review: undefined, review_reasons: review,
            start_date: null, end_date: null, influencer_name: i?.name || b.influencer_name,
            business_type: knownType ? businessType : null, bank: i?.bank_name ? `${i.bank_name} ${i.bank_account} (${i.bank_holder})` : null,
            docs_ok: !!(i?.bankbook_file && (businessType === 'freelancer' ? i?.id_card_file : i?.biz_cert_file)),
            rate: b.rates.size === 1 ? [...b.rates][0] : null, commission,
            breakdown: commission !== null && knownType ? calcPayout(commission, businessType!) : null,
            payout: p ? { ...p, commission: Number(p.commission), payout_amount: Number(p.payout_amount), supply_value: Number(p.supply_value), vat: Number(p.vat), withholding: Number(p.withholding) } : null };
    });
}
