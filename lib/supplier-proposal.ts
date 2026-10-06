export const SUPPLIER_CATEGORIES = [
  '생활·리빙',
  '뷰티·패션',
  '식품',
  '숙박·여행',
  '교육·클래스',
  '문화·서비스',
  '기타',
] as const;

export const SUPPLIER_FIELD_LIMITS = {
  name: { min: 2, max: 50 },
  contact: { min: 5, max: 100 },
  company: { min: 1, max: 100 },
  productName: { min: 2, max: 150 },
  message: { min: 20, max: 3000 },
} as const;

export type SupplierProposal = {
  kind: 'supplier-proposal';
  name: string;
  contact: string;
  company: string;
  proposalCategory: (typeof SUPPLIER_CATEGORIES)[number];
  productName: string;
  message: string;
  consent: true;
};

const fieldLabels = {
  name: '담당자명',
  contact: '연락처 또는 이메일',
  company: '회사·브랜드명',
  productName: '상품·서비스명',
  message: '제안 내용',
} as const;

/** Shared by the proposal form and API; never includes submitted values in errors. */
export function validateSupplierProposal(body: Record<string, unknown>):
  | { ok: true; value: SupplierProposal }
  | { ok: false; error: string } {
  if (body.kind !== 'supplier-proposal') {
    return { ok: false, error: '공급사 제안 요청 형식을 확인해주세요.' };
  }

  const values = {} as Record<keyof typeof SUPPLIER_FIELD_LIMITS, string>;
  for (const field of Object.keys(SUPPLIER_FIELD_LIMITS) as (keyof typeof SUPPLIER_FIELD_LIMITS)[]) {
    const input = body[field];
    const value = typeof input === 'string' ? input.trim().replace(/\r\n?/g, '\n') : '';
    const { min, max } = SUPPLIER_FIELD_LIMITS[field];
    if (value.length < min || value.length > max) {
      return { ok: false, error: `${fieldLabels[field]}은(는) ${min}~${max}자로 입력해주세요.` };
    }
    if (field !== 'message' && /[\u0000-\u001f\u007f]/.test(value)) {
      return { ok: false, error: `${fieldLabels[field]}은(는) 한 줄로 입력해주세요.` };
    }
    values[field] = value;
  }

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contact);
  const isPhone = /^[\d\s()+-]+$/.test(values.contact)
    && /^\d{9,15}$/.test(values.contact.replace(/[\s()+-]/g, ''));
  if (!isEmail && !isPhone) {
    return { ok: false, error: '회신받을 수 있는 전화번호 또는 이메일을 입력해주세요.' };
  }
  if (!SUPPLIER_CATEGORIES.includes(body.proposalCategory as SupplierProposal['proposalCategory'])) {
    return { ok: false, error: '제안 분야를 선택해주세요.' };
  }
  if (body.consent !== true) {
    return { ok: false, error: '제안 접수를 위한 개인정보 수집·이용에 동의해주세요.' };
  }

  return {
    ok: true,
    value: { kind: 'supplier-proposal', ...values, proposalCategory: body.proposalCategory as SupplierProposal['proposalCategory'], consent: true },
  };
}

export function supplierProposalMessage(proposal: SupplierProposal): string {
  return [
    '[공급사 공구 제안]',
    `회사·브랜드명: ${proposal.company}`,
    `제안 분야: ${proposal.proposalCategory}`,
    `상품·서비스명: ${proposal.productName}`,
    '개인정보 수집·이용 동의: 동의',
    '',
    '[제안 내용]',
    proposal.message,
  ].join('\n');
}
