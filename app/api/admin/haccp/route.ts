import {ApiError,withApiErrors} from '@/lib/api-errors';
import {adminAccess,inputText} from '@/lib/customer-access';
// MFDS I0580: https://www.foodsafetykorea.go.kr/api/openApiInfo.do?svc_no=I0580
export const GET=withApiErrors('GET /api/admin/haccp',async(req:Request)=>{
 await adminAccess();const number=inputText(new URL(req.url).searchParams.get('number'),40);
 if(!/^[0-9A-Za-z-]+$/.test(number))throw new ApiError('INVALID_INPUT','HACCP 지정번호를 확인해주세요.');
 const key=process.env.HACCP_SERVICE_KEY;
 if(!key)throw new ApiError('UPSTREAM_UNAVAILABLE','식품안전나라 API 인증키와 I0580 활용 신청이 필요합니다.');
 let response:Response;
 // Never expose a URL containing the service key in logs or client responses.
 try{response=await fetch(`https://openapi.foodsafetykorea.go.kr/api/${encodeURIComponent(key)}/I0580/json/1/20/HACCP_APPN_NO=${encodeURIComponent(number)}`,{signal:AbortSignal.timeout(10000),cache:'no-store'});}
 catch{throw new ApiError('UPSTREAM_UNAVAILABLE');}
 if(!response.ok)throw new ApiError('UPSTREAM_UNAVAILABLE');
 const data=await response.json().catch(()=>null),result=data?.I0580;
 if(result?.RESULT?.CODE==='INFO-200')return Response.json({items:[]});
 if(result?.RESULT?.CODE!=='INFO-000'||!Array.isArray(result?.row))throw new ApiError('UPSTREAM_INVALID_RESPONSE');
 const keys=['BSSH_NM','HACCP_APPN_NO','PRDLST_NM','HACCP_APPN_DT','CRTFC_ENDDT','CLSBIZ_DVS_CD_NM','ASGN_CANCL_DT','CRTFC_RETN_DT'];
 return Response.json({items:result.row.map((r:Record<string,unknown>)=>Object.fromEntries(keys.map(k=>[k,typeof r[k]==='string'?r[k]:'']))),checkedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
});
