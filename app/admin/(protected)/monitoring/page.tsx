import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {verifyAdminToken} from '@/lib/auth';
export const dynamic='force-dynamic';
export default async function Page(){
 const token=(await cookies()).get('admin_token')?.value;
 if(!token||!(await verifyAdminToken(token)))redirect('/login?redirect=%2Fadmin%2Fmonitoring');
 redirect('/admin/traffic#checks');
}
