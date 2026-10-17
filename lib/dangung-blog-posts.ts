// Search checked on 2026-10-17. The first three distinct blog articles in the
// relevant web search results (excluding directories and duplicate URLs).
// Query: "단궁" "양주" "한옥" 블로그 후기 -활 -국궁 -동예
// These are cafe/garden visits, NOT verified overnight-stay reviews. Do not
// describe this static selection as a live Naver ranking or reuse authors' photos.
export const dangungBlogSearch = {
  checkedAt: '2026-10-17',
  query: '단궁 한옥',
  href: 'https://search.naver.com/search.naver?where=blog&query=%EB%8B%A8%EA%B6%81%20%ED%95%9C%EC%98%A5',
};

export const dangungBlogPosts = [
  {
    title: '서울근교 아이와 갈만한 곳 ㅣ양주 한옥카페 단궁',
    author: '꽃다운 에밀리',
    publishedAt: '2022-08-16',
    href: 'https://dndbajrwk1.tistory.com/190',
    description: '아이들과 잔디 정원에서 시간을 보낸 가족의 카페 방문 기록.',
    topic: '가족 나들이',
  },
  {
    title: '단궁. 양주 기산저수지의 잔디밭이 넓은 호수뷰 한옥카페',
    author: '고바마',
    publishedAt: '2021-06-21',
    href: 'https://kobama.tistory.com/306',
    description: '한옥 사랑채와 정원, 기산저수지 주변을 사진으로 둘러본 기록.',
    topic: '한옥과 풍경',
  },
  {
    title: "양주, 느낌있는 한옥 카페 '단궁'",
    author: '셀디 · 데이트위드미',
    publishedAt: '2017-01-02',
    href: 'https://datekorea.tistory.com/168',
    description: '겨울 드라이브 중 찾은 단궁의 한옥 외관과 카페 방문 기록.',
    topic: '드라이브',
  },
] as const;
