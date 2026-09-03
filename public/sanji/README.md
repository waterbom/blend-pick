# 산지픽 랜딩 에셋

이 폴더에 아래 이름으로 올리면 랜딩에 자동 반영된다 (없으면 그라데이션/텍스트로 대체 표시).

| 파일 | 용도 | 권장 규격 |
|---|---|---|
| hero-farmer.png | 히어로 풀블리드 배경 (가로) | 784×552 이상, 1MB 이하 |
| card-basket.png | 폰 목업 카드 썸네일 (세로) | 392×583 |
| badge-gap.png | 상단 인증 배지 — GAP | 140×140 |
| badge-6th.png | 상단 인증 배지 — 6차산업 | 140×140 |
| badge-cycle.png | 상단 인증 배지 — 자연순환농법 | 140×140 |
| why-farmer.png | ② 카드 01 농가 직거래 | 정방형 권장 (120×120 크롭 표시) |
| why-storage.png | ② 카드 02 수확 당일 발송 | 정방형 권장 |
| why-produce.png | ② 카드 03 직접 먹어보고 검증 (시식 사진 없으면 임시로 작물 클로즈업) | 정방형 권장 |
| farm-harvester.mp4 / .png | ③ OUR FARM 01 수확 (큰 컷 220px) — mp4 영상 + png 포스터 | 720px, 무음 |
| farm-machine.mp4 / .png | ③ 02 선별 (반쪽 컷 200px) | 720px, 무음 |
| farm-peach.mp4 / .png | ③ 03 과수원 (반쪽 컷) | 720px, 무음 |
| farm-hands.mp4 / .png | ③ 04 손 검수 (큰 컷) | 720px, 무음 |
| farm-dig.mp4 | (예비) 밭 파는 컷 — 아직 화면에 안 씀 | |
| pack-potato.png | ④ PACKING 메인 사진 (260px) | 가로 |
| pack-aircap.png | ④ 우하단 인셋 에어캡 사진 (150×150) | 정방형 |

> 2026-09-03 — 루트(/)가 랜딩에서 **판매 페이지**로 바뀌었다. 위 에셋은 이제 `/about`(브랜드 소개)에서 쓰이고,
> 판매 페이지의 슬라이드·상세 이미지는 **상품 관리**(대표 이미지 + 추가 이미지 + 상세 HTML)에서 올린 것이 그대로 뜬다.
> 산지픽 상품이 하나도 없을 때만 card-basket / card-crate / why-produce 가 예시 슬라이드로 쓰인다.

> GIF 원본은 8~16MB라 그대로 올리면 모바일에서 너무 느리다. `ffmpeg -i in.gif -vf scale=720:-2 -pix_fmt yuv420p -c:v libx264 -crf 29 -an out.mp4` 로 변환해서 올린다.
