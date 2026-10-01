import {createHmac} from 'node:crypto';
import {ApiError,withApiErrors} from '@/lib/api-errors';
import {customerAccess,ownedOrder} from '@/lib/customer-access';
export const GET=withApiErrors('GET /api/customer/channel',async(req:Request)=>{
 const a=await customerAccess(false);const prefix=a.site==='sanjipick'?'SANJIPICK':'BLENDPICK';
 const pluginKey=process.env[`${prefix}_CHANNEL_PLUGIN_KEY`],secret=process.env[`${prefix}_CHANNEL_MEMBER_HASH_SECRET`];
 if(!pluginKey||!secret||!/^[a-f0-9]{64}$/i.test(secret))throw new ApiError('UPSTREAM_UNAVAILABLE','상담 채널 설정을 확인해주세요.');
 const id=new URL(req.url).searchParams.get('order');const order=id?await ownedOrder(id,a):null;
 const memberId=`${a.site}:${a.id||'guest:'+a.guestHash}`;
 return Response.json({pluginKey,memberId,memberHash:createHmac('sha256',Buffer.from(secret,'hex')).update(memberId).digest('hex'),
  hideChannelButtonOnBoot:true,profile:{storefront:a.site,orderNumber:order?.order_number||'',orderStatus:order?.status||''}},
  {headers:{'Cache-Control':'no-store'}});
});
