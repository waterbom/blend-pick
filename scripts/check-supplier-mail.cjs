// Read-only SMTP login/connection check. Does not send any email or print credentials.
require('@next/env').loadEnvConfig(process.cwd(), false);
const nodemailer = require('nodemailer');
(async () => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('SUPPLIER_EMAIL_CHECK=MISSING_CONFIGURATION');
    return;
  }
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    connectionTimeout: 3000, greetingTimeout: 3000, socketTimeout: 5000,
  });
  try { await transport.verify(); console.log('SUPPLIER_EMAIL_CHECK=SMTP_READY'); }
  catch { console.log('SUPPLIER_EMAIL_CHECK=SMTP_UNAVAILABLE'); }
  finally { transport.close(); }
})().catch(() => { console.log('SUPPLIER_EMAIL_CHECK=CHECK_FAILED'); });
