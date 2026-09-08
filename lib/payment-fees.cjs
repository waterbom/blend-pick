// Shared by Next routes and the Node shipment worker. These are estimates, never PG actuals.
function normalizePaymentMethod(value) {
 return ['transfer','계좌이체'].includes(String(value || '').trim()) ? 'transfer' : 'card';
}
function estimatePaymentFee(amount, method) {
 return Math.round(Math.max(0, Number(amount)) * (normalizePaymentMethod(method)==='transfer' ? 0.0165 : 0.0363));
}
module.exports={normalizePaymentMethod,estimatePaymentFee};
