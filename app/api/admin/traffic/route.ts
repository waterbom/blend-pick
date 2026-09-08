import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/auth';
import { currentAdminSite } from '@/lib/admin-site';
import { getServerTraffic } from '@/lib/server-traffic';
export const dynamic='force-dynamic';
export async function GET(req:Request){
  const token=(await cookies()).get('admin_token')?.value;
  if(!token||!(await verifyAdminToken(token)))return Response.json({error:'Unauthorized'},{status:401,headers:{'Cache-Control':'no-store'}});
  const site=await currentAdminSite();const n=new URL(req.url).searchParams.get('days')||'7';
  if(!['1','7','30'].includes(n))return Response.json({error:'Invalid range'},{status:400});
  return Response.json(await getServerTraffic(site.key,Number(n)),{headers:{'Cache-Control':'no-store'}});
}
