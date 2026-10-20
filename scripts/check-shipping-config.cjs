// Read-only deployment report. No customer data, credentials, or product writes.
// Postal regions are optional: an empty region means automatic surcharges are off.
async function inspectShippingConfig(db) {
  const {rows} = await db.query(`SELECT COUNT(*)::int active_products,
    COUNT(*) FILTER(WHERE island_shipping_cost>0 AND COALESCE(trim(remote_zipcodes),'')<>'')::int regional_surcharge_enabled,
    COUNT(*) FILTER(WHERE island_shipping_cost>0 AND COALESCE(trim(remote_zipcodes),'')='')::int regional_surcharge_inactive,
    COUNT(*) FILTER(WHERE shipping_cost<0 OR per_unit_shipping_cost<0 OR installation_cost<0 OR island_shipping_cost<0 OR (shipping_type='conditional_free' AND COALESCE(free_shipping_threshold,0)<=0))::int invalid_fee_settings
    FROM products_shop WHERE status='active' AND archived_at IS NULL`);
  return rows[0];
}
function shippingConfigMessages(report) {
  const messages = [];
  if (report.regional_surcharge_inactive) messages.push(`Regional surcharge inactive: ${report.regional_surcharge_inactive} products have no optional postal regions. Checkout remains available without an automatic regional surcharge.`);
  if (report.invalid_fee_settings) messages.push(`Invalid shipping settings: ${report.invalid_fee_settings} products require correction before checkout. Existing orders are unchanged.`);
  return messages;
}
async function main() {
  require('@next/env').loadEnvConfig(process.cwd(), false);
  const {Pool} = require('pg');
  const db = new Pool({connectionString:process.env.SHOP_DATABASE_URL, ssl:{rejectUnauthorized:false}});
  try {
    const report = await inspectShippingConfig(db);
    console.log('Shipping configuration report:', JSON.stringify(report));
    for (const message of shippingConfigMessages(report)) console.log(message);
  } finally { await db.end(); }
}
if (require.main === module) main().catch(() => { console.error('Shipping configuration report could not be read.'); process.exitCode = 1; });
module.exports = { inspectShippingConfig, shippingConfigMessages };
