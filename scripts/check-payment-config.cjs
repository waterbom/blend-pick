// Inspect key mode only. Never log payment credentials or contact the payment gateway.
function paymentModes(env) {
  const mode = value => !value ? 'missing' : value.startsWith('live_') ? 'live' : value.startsWith('test_') ? 'test' : 'unknown';
  return { client: mode(env.TOSS_CLIENT_KEY), server: mode(env.TOSS_SECRET_KEY) };
}
if (require.main === module) {
  require('@next/env').loadEnvConfig(process.cwd(), false);
  const modes = paymentModes(process.env);
  console.log(`Payment configuration: client=${modes.client}, server=${modes.server} (credentials hidden).`);
  if (modes.client !== 'live' || modes.server !== 'live') {
    console.error('Live payment launch requires both TOSS_CLIENT_KEY and TOSS_SECRET_KEY to be live keys on the server.');
    process.exitCode = 1;
  }
}
module.exports = { paymentModes };
