export function kakaoChannelUrl(value:string):string|null {
 try { const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.hostname!=='pf.kakao.com'||u.username||u.password||u.port||!/^\/_[A-Za-z0-9]+(?:\/chat)?\/?$/.test(u.pathname))return null;u.protocol='https:';u.search='';u.hash='';return u.toString(); } catch{return null;}
}
export const KAKAO_SCENARIOS = [
 {key:'shipping',label:'배송 시작',audience:'구매 고객',event:'송장 저장과 배송중 전환 성공 후',benefit:'송장번호 확인·배송 문의 감소',prerequisite:'비즈니스 채널 · 발송 업체 · 승인 템플릿',message:'[브랜드명] 상품이 발송되었습니다.\n주문번호: #{주문번호}\n상품: #{상품명}\n택배사: #{택배사}\n운송장번호: #{운송장번호}\n배송 조회: #{주문조회URL}',button:'배송 조회'},
 {key:'paid',label:'주문·결제 완료',audience:'구매 고객',event:'결제 승인과 주문 저장 성공 후',benefit:'주문 접수 여부와 출고 일정 안내',prerequisite:'승인 템플릿 · 결제 이벤트 중복 방지',message:'[브랜드명] 주문이 접수되었습니다.\n주문번호: #{주문번호}\n결제금액: #{결제금액}원\n출고예정일: #{출고예정일}\n주문 확인: #{주문조회URL}',button:'주문 확인'},
 {key:'delay',label:'출고 일정 변경',audience:'구매 고객',event:'관리자가 변경 출고일을 확정한 후',benefit:'지연 문의 전에 변경 일정 안내',prerequisite:'승인 템플릿 · 확정 출고일',message:'[브랜드명] 주문 상품의 출고 일정이 변경되었습니다.\n주문번호: #{주문번호}\n변경 출고일: #{출고예정일}\n변경 사유: #{안내사유}\n주문 확인: #{주문조회URL}',button:'주문 확인'},
 {key:'refund',label:'취소·환불 완료',audience:'구매 고객',event:'결제사 환불 성공과 주문 반영 후',benefit:'접수와 완료를 구분해 문의 감소',prerequisite:'승인 템플릿 · 환불 확정 이벤트',message:'[브랜드명] 환불 처리가 완료되었습니다.\n주문번호: #{주문번호}\n환불금액: #{환불금액}원\n결제수단에 따라 입금까지 시간이 걸릴 수 있습니다.\n처리 내역: #{주문조회URL}',button:'처리 내역'},
 {key:'operator',label:'운영자 처리 알림',audience:'등록한 운영 담당자',event:'출고 지연·송장 오류 집계 또는 정해진 요약 시각',benefit:'관리자에 상시 접속하지 않고 예외 확인',prerequisite:'수신 담당자 · 발송 방식과 템플릿 가능 여부 확인',message:'[브랜드명] 처리할 업무가 있습니다.\n미출고: #{미출고건수}건\n송장 오류: #{송장오류건수}건\n교환·반품: #{신청건수}건\n관리자 로그인 후 확인: #{관리자URL}',button:'오늘 처리할 일'},
 {key:'restock',label:'재입고·공구 오픈',audience:'알림을 신청한 고객',event:'고객이 신청한 상품의 재입고 또는 판매 시작',benefit:'관심 고객의 재방문 유도',prerequisite:'수신 동의·해지 관리 · 광고 메시지 유형 검토',message:'[문안 검토용 · 광고 유형 확인 필요]\n[브랜드명] 관심 상품 소식을 확인하세요.\n상품: #{상품명}\n판매기간: #{판매기간}\n상품 보기: #{상품URL}\n수신거부: #{수신거부안내}',button:'상품 보기'},
] as const;
