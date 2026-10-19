export const photoPath = (id: number) => `/hotel/dangung/photo-${String(id).padStart(2, '0')}.jpg`;

// Supplied photographs only: these are the actual Dangung spaces, not stock imagery.
export const dangungPhotos = [
  { id: 1, label: '한옥과 정원', alt: '잔디 정원에서 바라본 단궁 한옥 전경', width: 1536, height: 1024 },
  { id: 2, label: '봄', alt: '봄날의 단궁 한옥과 정원', width: 1224, height: 1240 },
  { id: 3, label: '여름', alt: '장미가 핀 여름날의 단궁 처마', width: 1224, height: 1278 },
  { id: 4, label: '가을', alt: '붉게 물든 가을 단풍과 단궁 정원', width: 1224, height: 1218 },
  { id: 5, label: '겨울', alt: '눈이 쌓인 단궁 한옥의 겨울 풍경', width: 1224, height: 1292 },
  { id: 6, label: '잔디 정원', alt: '한옥으로 둘러싸인 단궁의 넓은 잔디 정원', width: 1224, height: 914 },
  { id: 7, label: '침실', alt: '침대와 화장대가 놓인 단궁 침실', width: 1536, height: 1024 },
  { id: 8, label: '거실', alt: '소파와 테이블이 놓인 단궁 거실', width: 1536, height: 1024 },
  { id: 9, label: '주방', alt: '싱크대와 조리 공간이 있는 단궁 주방', width: 1536, height: 1024 },
  { id: 10, label: '실내 공간', alt: '넓은 바닥이 보이는 단궁 실내 공간', width: 1536, height: 1024 },
  { id: 11, label: '욕실', alt: '세면대와 거울이 있는 단궁 욕실', width: 1536, height: 1024 },
  { id: 12, label: '다이닝', alt: '단궁 식사 공간과 테이블', width: 1536, height: 1024 },
  { id: 13, label: '복도', alt: '객실을 이어주는 단궁 실내 복도', width: 1536, height: 1024 },
  { id: 14, label: '실내 분위기', alt: '조명이 켜진 단궁 식사 공간', width: 1536, height: 1024 },
  { id: 15, label: '단궁곰탕', alt: '단궁곰탕 간판이 보이는 한옥 외관', width: 1536, height: 1024 },
  { id: 16, label: '바비큐', alt: '정원 옆 나무 테이블과 그릴이 있는 바비큐장', width: 1536, height: 1024 },
  { id: 17, label: '처마 아래', alt: '한옥 처마 아래 의자가 놓인 데크', width: 1536, height: 1024 },
  { id: 18, label: '한옥 전경', alt: '정원에서 바라본 단궁 한옥 외관', width: 1536, height: 1024 },
  { id: 19, label: '정원의 길', alt: '초록 식재와 계단이 있는 단궁 정원', width: 1536, height: 1024 },
  { id: 20, label: '함께한 순간', alt: '단궁 잔디 정원에서 보내는 시간', width: 1224, height: 1474 },
  { id: 21, label: '추억을 남기는 길', alt: '한옥을 향해 이어지는 단궁 계단', width: 1224, height: 1486 },
  { id: 22, label: '우리의 하루', alt: '푸른 하늘 아래 단궁 한옥과 잔디 정원', width: 2048, height: 1595 },
] as const;

export function getPhoto(id: number) {
  return dangungPhotos.find(photo => photo.id === id) ?? dangungPhotos[0];
}
