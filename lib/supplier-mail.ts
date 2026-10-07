import nodemailer from 'nodemailer';
import { SUPPLIER_CONTACT_EMAIL, supplierProposalMessage, type SupplierProposal } from '@/lib/supplier-proposal';

/** Notify the fixed supplier inbox only after the existing inquiry service accepts it. */
export async function sendSupplierProposalEmail(proposal: SupplierProposal): Promise<boolean> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('SUPPLIER_EMAIL_MISSING_CONFIGURATION');
    return false;
  }
  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    connectionTimeout: 3000, greetingTimeout: 3000, socketTimeout: 5000,
  });
  try {
    const replyTo = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(proposal.contact) ? proposal.contact : undefined;
    const result = await transport.sendMail({
      from: { name: '블랜드픽 공급사 제안', address: process.env.GMAIL_USER },
      to: SUPPLIER_CONTACT_EMAIL,
      ...(replyTo ? { replyTo: { name: proposal.name, address: replyTo } } : {}),
      subject: `[블랜드픽 공급사 제안] ${proposal.company} · ${proposal.productName}`,
      text: [`담당자명: ${proposal.name}`, `회신 연락처: ${proposal.contact}`, '', supplierProposalMessage(proposal)].join('\n'),
      disableFileAccess: true, disableUrlAccess: true,
    });
    if (!result.accepted?.some(address => typeof address === 'string' && address.toLowerCase() === SUPPLIER_CONTACT_EMAIL)) throw new Error('Recipient not accepted');
    return true;
  } catch {
    // Keep the already accepted inquiry; do not retry or log personal data/provider errors.
    console.error('SUPPLIER_EMAIL_DELIVERY_FAILED');
    return false;
  } finally { transport.close(); }
}
