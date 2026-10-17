import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import { currentSite } from '@/lib/site-server';
import { DangungHero, DangungNavigation, DangungStory, DangungGuide } from '@/components/dangung/Landing';
import { DangungAvailabilityProvider } from '@/components/dangung/Availability';
import DangungBooking from '@/components/dangung/Booking';
import DangungInteractions from '@/components/dangung/Interactions';
import '@/components/dangung/dangung.css';
import '@/components/dangung/stay.css';
export const metadata={
 title:'단궁 × 블랜드픽 | 한옥 정원 독채 숙박·촬영대관',
 description:'사계절 한옥 정원, 새롭게 단장한 객실, 우천 시 바비큐와 바로 옆 한식·카페까지. 단궁에서 친구·가족과 함께할 하루를 만나보세요.',
 alternates:{canonical:'https://shop.blendpunch.com/hotel/dangung'},
 openGraph:{title:'단궁 × 블랜드픽',description:'한옥의 멋, 정원의 여유. 함께여서 더 좋은 하루.',url:'https://shop.blendpunch.com/hotel/dangung',images:[{url:'https://shop.blendpunch.com/hotel/dangung/photo-01.jpg'}]},
};
export default async function DangungPage(){
 if((await currentSite()).key!=='blendpick')notFound();
 return <><Header/><div className="dangung dg-stay-page" data-dangung-version="2026-10-gahoe-1"><DangungAvailabilityProvider>
  <DangungHero/>
  <DangungNavigation/>
  <main className="dgs-layout">
    <div className="dgs-main-story"><DangungStory/></div>
    <aside className="dgs-reservation-rail" aria-label="단궁 객실 예약"><DangungBooking clientKey={process.env.TOSS_CLIENT_KEY||''}/></aside>
    <div className="dgs-main-guide"><DangungGuide/></div>
  </main>
  <div className="dgs-closing"><span className="dgs-kicker">DANGUNG × BLEND PICK</span><p>함께할 날을 골라보세요.</p><a href="#booking" className="dgs-text-link">단궁에서 머물기 →</a></div>
  <DangungInteractions/>
 </DangungAvailabilityProvider></div></>;
}
