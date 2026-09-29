import type { PoolClient } from 'pg';
import { enqueue } from '@/lib/shipment-outbox.cjs';
import { shipmentSMSText } from '@/lib/ship-notify';
import type { SiteKey } from '@/lib/sites';

// Caller owns the transaction and the order lock. Both registration paths use this write.
export async function registerShipment(client: PoolClient, order: { id: string; orderNumber: string; site: SiteKey; carrier: string; tracking: string }) {
    const updated = await client.query(`UPDATE orders SET status='shipped',shipped_at=COALESCE(shipped_at,NOW()),
      tracking_company=$2,tracking_number=$3,updated_at=NOW()
      WHERE order_number=$1 AND site=$4 AND id=$5 AND status='preparing'
      RETURNING COALESCE(recipient_name,buyer_name) AS name`,
    [order.orderNumber, order.carrier, order.tracking, order.site, order.id]);
    if (updated.rowCount !== 1) return false;
    await enqueue(client, order.orderNumber, order.site, order.tracking, shipmentSMSText({ buyerName: updated.rows[0].name || '', orderNumber: order.orderNumber, carrier: order.carrier, trackingNumber: order.tracking, site: order.site }));
    return true;
}
