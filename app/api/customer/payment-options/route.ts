import {currentSite} from '@/lib/site-server';
export async function GET(){
 const site=(await currentSite()).key,prefix=site==='sanjipick'?'SANJIPICK':'BLENDPICK';
 const allowed=['TOSSPAY','NAVERPAY','KAKAOPAY'];
 const enabled=(process.env[`${prefix}_TOSS_EASY_PAY`]||'').split(',').map(v=>v.trim()).filter(v=>allowed.includes(v));
 return Response.json({methods:[...new Set(enabled)]},{headers:{'Cache-Control':'no-store'}});
}
