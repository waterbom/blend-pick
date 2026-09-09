'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export default function NotificationActions({id,status}:{id:string;status:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const router=useRouter();
 async function action(action:string){
  if(!confirm(action==='sent'?'발송업체에서 정상 접수된 것을 확인했나요?':'발송업체에서 미접수를 확인했나요? 재시도 시 고객에게 안내가 발송됩니다.'))return;
  setBusy(true);setError('');try{const r=await fetch('/api/admin/shipment-notifications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,action,confirmed:true})});if(!r.ok)throw Error('상태가 변경됐거나 처리에 실패했습니다. 새로고침 후 확인해주세요.');router.refresh();}catch(e){setError(e instanceof Error?e.message:'처리 실패');}finally{setBusy(false);}
 }
 return <>{status==='review'&&<><button disabled={busy} onClick={()=>action('sent')}>접수 확인 완료</button><button disabled={busy} onClick={()=>action('retry')}>미접수 확인·재시도</button></>}{error&&<p role="alert">{error}</p>}</>;
}
