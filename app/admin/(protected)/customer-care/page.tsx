import CustomerCareClient from '@/components/admin/CustomerCareClient';
export default async function CustomerCarePage({searchParams}:{searchParams:Promise<{order?:string;number?:string}>}){
 const p=await searchParams;return <CustomerCareClient orderId={typeof p.order==='string'?p.order:''} orderNumber={typeof p.number==='string'?p.number:''}/>;
}
