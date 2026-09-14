import { notFound } from 'next/navigation';
import { currentAdminSite } from '@/lib/admin-site';
import DangungAdmin from '@/components/dangung/Admin';
export default async function Page(){if((await currentAdminSite()).key!=='blendpick')notFound();return <DangungAdmin/>;}
