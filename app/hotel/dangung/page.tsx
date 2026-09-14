import { notFound } from 'next/navigation';
import { currentSite } from '@/lib/site-server';
import { dangungContent } from '@/components/dangung/content';
import DangungBooking from '@/components/dangung/Booking';
import DangungInteractions from '@/components/dangung/Interactions';
import '@/components/dangung/dangung.css';
export const metadata={
 title:'단궁 × 블랜드픽 | 한옥 정원 독채 숙박·촬영대관',
 description:'사계절 한옥 정원, 새롭게 단장한 객실, 우천 시 바비큐와 바로 옆 한식·카페까지. 단궁에서 친구·가족과 함께할 하루를 만나보세요.',
 alternates:{canonical:'https://shop.blendpunch.com/hotel/dangung'},
 openGraph:{title:'단궁 × 블랜드픽',description:'한옥의 멋, 정원의 여유. 함께여서 더 좋은 하루.',url:'https://shop.blendpunch.com/hotel/dangung',images:[{url:'https://shop.blendpunch.com/hotel/dangung/photo-01.jpg'}]},
};
export default async function DangungPage(){
 if((await currentSite()).key!=='blendpick')notFound();
 return <div className="dangung" data-dangung-version="2026-09-booking-1"><div dangerouslySetInnerHTML={{__html:dangungContent}}/><DangungBooking clientKey={process.env.TOSS_CLIENT_KEY||''}/><DangungInteractions/></div>;
}
