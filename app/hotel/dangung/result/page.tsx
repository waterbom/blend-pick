import { notFound } from 'next/navigation';
import { currentSite } from '@/lib/site-server';
import DangungResult from '@/components/dangung/Result';
import '@/components/dangung/dangung.css';
export const metadata={title:'단궁 예약 확인',robots:{index:false,follow:false}};
export default async function ResultPage(){if((await currentSite()).key!=='blendpick')notFound();return <div className="dangung"><DangungResult/></div>;}
