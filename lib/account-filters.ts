export type AccountQuery={page?:string;hotel_page?:string;status?:string;from?:string;to?:string};
export const ACCOUNT_STATUSES:Record<string,string>={paid:"결제완료",confirmed:"주문확인",preparing:"배송준비",shipped:"배송중",delivered:"배송완료",cancel_requested:"취소요청",cancelled:"취소완료",exchange_requested:"교환신청",exchange_completed:"교환완료",return_requested:"반품신청",return_completed:"반품완료"};
export function accountFilters(q:AccountQuery={}){
 const page=typeof q.page==="string"?Number(q.page):1;
 const date=(s?:string)=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s?s:undefined;
 const from=date(q.from),to=date(q.to);
 return {page:Number.isSafeInteger(page)&&page>0?Math.min(page,100000):1,status:typeof q.status==="string"&&Object.hasOwn(ACCOUNT_STATUSES,q.status)?q.status:undefined,from:from&&to&&from>to?undefined:from,to:from&&to&&from>to?undefined:to};
}

export function accountHref(query:AccountQuery,changes:Partial<AccountQuery>={},anchor="orders"){
 const merged={...query,...changes},q=accountFilters(merged),p=new URLSearchParams();
 if(q.page>1)p.set("page",String(q.page));
 if(q.status)p.set("status",q.status);
 if(q.from)p.set("from",q.from);
 if(q.to)p.set("to",q.to);
 const hotel=accountFilters({page:merged.hotel_page}).page;
 if(hotel>1)p.set("hotel_page",String(hotel));
 return "?"+p.toString()+"#"+anchor;
}
