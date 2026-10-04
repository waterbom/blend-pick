import Header from '@/components/Header';
import CustomerSupport from '@/components/CustomerSupport';
import {currentSite} from '@/lib/site-server';
export const metadata={title:'문의·상담',robots:{index:false,follow:false}};
export default async function SupportPage({searchParams}:{searchParams:Promise<{order?:string;product?:string}>}){
 const params=await searchParams,site=await currentSite();const prefix=site.key==='sanjipick'?'SANJIPICK':'BLENDPICK';
 return <main><Header/><div className="care-page"><CustomerSupport orderId={typeof params.order==='string'?params.order:undefined} productId={typeof params.product==='string'?params.product:undefined} channelEnabled={!!process.env[`${prefix}_CHANNEL_PLUGIN_KEY`]&&!!process.env[`${prefix}_CHANNEL_MEMBER_HASH_SECRET`]}/></div></main>;
}
