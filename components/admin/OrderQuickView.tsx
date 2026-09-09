'use client';
import {useRef} from 'react';
import Link from 'next/link';
import type {Order} from '@/components/admin/OrdersClient';
import {carrierName,trackingUrl} from '@/lib/carriers';
export default function OrderQuickView({order,label}:{order:Order;label?:string}) {
 const ref=useRef<HTMLDialogElement>(null);
 return <><button type="button" className="text-sm text-[#147443] underline underline-offset-4" onClick={()=>ref.current?.showModal()}>{label||order.order_number}</button>
 <dialog ref={ref} className="commerce-order-dialog" aria-label={`주문 ${order.order_number} 요약`}>
 <div className="commerce-dialog-top"><div><small>주문 요약</small><h2>{order.order_number}</h2></div><button type="button" onClick={()=>ref.current?.close()} aria-label="주문 요약 닫기">닫기 ×</button></div>
 <p className="commerce-chip">목록을 불러온 시점의 정보</p>
 <section><h3>주문 상품</h3>{order.items.map((i,n)=><p key={i.id||n}>{i.product_name} {i.option_label&&`/ ${i.option_label}`} · {i.quantity}개</p>)}<strong>{Number(order.total_amount).toLocaleString()}원</strong><p>배송비 {Number(order.shipping_fee).toLocaleString()}원 포함</p></section>
 <section><h3>받는 분</h3><p>{order.recipient_name||order.buyer_name} · {order.recipient_phone||order.buyer_phone}</p><p>{order.addr_zipcode} {order.addr_address} {order.addr_detail}</p>{order.addr_memo&&<p>배송 요청: {order.addr_memo}</p>}</section>
 <section><h3>배송 정보</h3>{order.tracking_number?<><p>{carrierName(order.tracking_company)}</p><p className="font-mono">{order.tracking_number}</p><a href={trackingUrl(order.tracking_company,order.tracking_number)} target="_blank" rel="noreferrer">택배사 조회 ↗</a></>:<p>등록된 송장 없음</p>}</section>
 <div className="commerce-flow-links"><Link href={`/admin/orders/${order.id}`}>전체 상세·처리</Link><Link href="/admin/shipments">출고·배송 관리</Link></div>
 <p className="text-xs text-gray-500">변경 처리는 전체 상세 화면에서 최신 상태를 확인한 후 진행합니다.</p>
 </dialog></>;
}
