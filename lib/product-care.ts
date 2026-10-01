export const PRODUCT_CARE_FIELDS={producer:'생산자·제조원',storage:'보관 방법',shelf_life:'소비기한·품질 유지 안내',allergens:'알레르기·주의 성분',quality_policy:'품질 문제 접수 기준',return_fee:'교환·반품 비용',certification_number:'인증번호',certification_scope:'인증 대상·범위'} as const;
export type ProductCare=Record<keyof typeof PRODUCT_CARE_FIELDS,string>;
