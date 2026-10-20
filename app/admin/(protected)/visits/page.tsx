import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {verifyAdminToken} from '@/lib/auth';
export const dynamic='force-dynamic';
export default async function VisitsPage({searchParams}:{searchParams:Promise<{days?:string}>}){
 const token=(await cookies()).get('admin_token')?.value;
 if(!token||!(await verifyAdminToken(token)))redirect('/login?redirect=%2Fadmin%2Fvisits');
 const params=await searchParams;
 const days=['1','7','30'].includes(params.days||'')?params.days:'7';
 redirect('/admin?days='+days+'#visits');
}
