// 전역 도메인 → 대분류 매핑 시드.
// TODO: Supabase domain_rules 테이블로 이전 (읽기 전체 허용 / 쓰기 service_role 전용).
export const DOMAIN_RULES = [
  // 쇼핑
  { domain: "musinsa.com", category: "shopping" },
  { domain: "coupang.com", category: "shopping" },
  { domain: "29cm.co.kr", category: "shopping" },
  { domain: "zigzag.kr", category: "shopping" },
  { domain: "kream.co.kr", category: "shopping" },
  { domain: "a-bly.com", category: "shopping" },
  { domain: "ohou.se", category: "shopping" },
  { domain: "smartstore.naver.com", category: "shopping" },
  { domain: "brand.naver.com", category: "shopping" },
  { domain: "shopping.naver.com", category: "shopping" },
  { domain: "gmarket.co.kr", category: "shopping" },
  { domain: "11st.co.kr", category: "shopping" },
  { domain: "oliveyoung.co.kr", category: "shopping" },
  { domain: "wconcept.co.kr", category: "shopping" },
  { domain: "ably.co.kr", category: "shopping" },
  { domain: "aliexpress.com", category: "shopping" },

  // 영상
  { domain: "youtube.com", category: "video" },
  { domain: "youtu.be", category: "video" },
  { domain: "vimeo.com", category: "video" },
  { domain: "tv.naver.com", category: "video" },
  { domain: "chzzk.naver.com", category: "video" },
  { domain: "twitch.tv", category: "video" },
  { domain: "netflix.com", category: "video" },
  { domain: "tving.com", category: "video" },
  { domain: "wavve.com", category: "video" },

  // 뉴스
  { domain: "news.naver.com", category: "news" },
  { domain: "n.news.naver.com", category: "news" }, // news.naver.com 서브도메인 매칭으로도 걸리지만 명시
  { domain: "ytn.co.kr", category: "news" },
  { domain: "news.daum.net", category: "news" },
  { domain: "v.daum.net", category: "news" },
  { domain: "yna.co.kr", category: "news" },
  { domain: "chosun.com", category: "news" },
  { domain: "joongang.co.kr", category: "news" },
  { domain: "donga.com", category: "news" },
  { domain: "hani.co.kr", category: "news" },
  { domain: "khan.co.kr", category: "news" },
  { domain: "hankyung.com", category: "news" },
  { domain: "mk.co.kr", category: "news" },
  { domain: "sedaily.com", category: "news" },
  { domain: "etnews.com", category: "news" },
  { domain: "zdnet.co.kr", category: "news" },
];

// 서브도메인까지 매칭 (n.news.naver.com → news.naver.com 룰에 매칭).
// 여러 룰이 겹치면 더 구체적인(긴) 도메인 우선.
export function matchDomainRule(domain) {
  let best = null;
  for (const rule of DOMAIN_RULES) {
    if (domain === rule.domain || domain.endsWith("." + rule.domain)) {
      if (!best || rule.domain.length > best.domain.length) best = rule;
    }
  }
  return best;
}
