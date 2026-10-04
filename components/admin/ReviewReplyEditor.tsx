'use client';
import {useState} from 'react';
import {readApiJson,apiErrorMessage} from '@/lib/api-error-message';
export default function ReviewReplyEditor({id,initial=''}:{id:string;initial?:string}){
 const [open,setOpen]=useState(false),[reply,setReply]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function save(){setBusy(true);setError('');try{await readApiJson(await fetch('/api/admin/review-replies',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,reply})}),'요청을 처리하지 못했습니다.');setNotice('답변을 저장했습니다.');setOpen(false);}catch(e){setError(apiErrorMessage(e));}finally{setBusy(false);}}
 return <div className="customer-care"><button type="button" onClick={()=>setOpen(!open)}>판매자 답변</button>{open&&<div className="care-form"><label>답변<textarea maxLength={2000} value={reply} onChange={e=>setReply(e.target.value)}/></label><button type="button" disabled={busy||!reply.trim()} onClick={save}>답변 저장</button></div>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}</div>;
}
