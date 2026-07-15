import { matchDomainRule } from "./domainRules";

// og:type 값 → 형식 키. "product.item", "video.other", "video.movie" 같은 변형까지 포함 매칭.
const OG_TYPE_MAP = [
  ["product", "shopping"],
  ["video", "video"],
  ["article", "news"],
];

// 형식 키 → 중분류(형식) 라벨. 주제 분류로 개편되면서 대분류가 아니라 형식 힌트·세부 표기로 쓴다.
const FORMAT_LABELS = {
  shopping: "상품",
  video: "영상",
  news: "아티클",
  etc: "기타",
};

// 룰 기반 형식 판정 (동기, 비용 0): 1. 도메인 룰 → 2. og:type 메타 → 3. 폴백(기타).
// 위에서 확정되면 중단. method는 'domain' | 'og_type' | 'fallback' — 디버깅·개선용.
export function classify({ domain, ogType }) {
  const rule = matchDomainRule(domain);
  if (rule) return { category: rule.category, method: "domain" };

  if (ogType) {
    const type = ogType.toLowerCase();
    for (const [keyword, category] of OG_TYPE_MAP) {
      if (type.includes(keyword)) return { category, method: "og_type" };
    }
  }

  return { category: "etc", method: "fallback" };
}

// 형식(중분류) 판정: classify 결과를 한국어 형식 라벨로.
// 주제 판정(classifyTopic)의 힌트이자 링크의 형식 메타데이터로 쓴다.
export function detectFormat({ domain, ogType }) {
  const { category, method } = classify({ domain, ogType });
  return { format: FORMAT_LABELS[category] ?? "기타", method };
}
