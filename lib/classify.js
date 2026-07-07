import { matchDomainRule } from "./domainRules";
import { MAJOR_SLUGS } from "./categories";

// og:type 값 → 대분류. "video.other", "product.item" 같은 변형까지 포함 매칭.
const OG_TYPE_MAP = [
  ["product", "shopping"],
  ["video", "video"],
  ["article", "news"],
];

// 최저 티어 모델. provider/모델 교체 시 여기만 수정.
const GEMINI_MODEL = "gemini-2.5-flash-lite";

// 분류 파이프라인: 싸고 빠른 것부터, 위에서 확정되면 중단.
// 1. 도메인 룰 (비용 0) → 2. og:type 메타 (비용 0) → 3. LLM 폴백 → 4. 기타
// categories: [{ slug, name, subs: [하위 이름] }] — LLM 프롬프트에 기존 카테고리로 제공
export async function classifyLink(meta, categories = []) {
  const rule = matchDomainRule(meta.domain);
  if (rule) return { category: rule.category, method: "domain" };

  if (meta.ogType) {
    const type = meta.ogType.toLowerCase();
    for (const [keyword, category] of OG_TYPE_MAP) {
      if (type.includes(keyword)) return { category, method: "og_type" };
    }
  }

  const llm = await classifyWithLLM(meta, categories);
  if (llm) return { category: llm.major, sub: llm.sub, newSub: llm.newSub, method: "llm" };

  return { category: "etc", method: "fallback" };
}

// LLM 폴백. provider 교체가 쉽도록 이 함수 하나로 격리한다.
// 기존 카테고리 중에서 선택하게 하고, 정 없을 때만 신규 하위를 제안받는다 (난장판 방지).
// 반환: { major, sub, newSub } 또는 판단 불가 시 null — 실패해도 저장 흐름은 계속된다.
export async function classifyWithLLM(meta, existingCategories = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!meta.title && !meta.description) return null; // 판단 근거가 없으면 호출 낭비

  const categoryLines = existingCategories
    .map((c) => `- ${c.slug}(${c.name}): ${c.subs?.length ? c.subs.join(", ") : "하위 없음"}`)
    .join("\n");

  const prompt = [
    "웹페이지를 카테고리로 분류하는 시스템이다. 아래 정보를 보고 JSON으로만 답하라.",
    "",
    "대분류는 반드시 shopping/video/news/etc 중 하나다.",
    "각 대분류의 기존 하위 카테고리:",
    categoryLines || "- (기본 4개 대분류만 있음)",
    "",
    "페이지 정보:",
    `- 도메인: ${meta.domain}`,
    `- 제목: ${meta.title || "(없음)"}`,
    `- 설명: ${(meta.description || "(없음)").slice(0, 200)}`,
    `- og:type: ${meta.ogType || "(없음)"}`,
    "",
    "규칙:",
    "1. major: 대분류 slug (shopping/video/news/etc 중 하나).",
    "2. sub: 기존 하위 카테고리 중 어울리는 것이 있으면 그 이름을 그대로, 없으면 null.",
    "3. newSub: sub가 null이고 새 하위 카테고리가 꼭 필요할 때만 짧은 한국어 이름(2~8자), 아니면 null.",
    "   가급적 기존 카테고리를 사용하고 신규 제안은 아껴라.",
    '4. 출력 형식: {"major":"...","sub":"..." 또는 null,"newSub":"..." 또는 null}',
  ].join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!response.ok) return null;

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    if (!MAJOR_SLUGS.includes(parsed.major)) return null;

    const subs = existingCategories.find((c) => c.slug === parsed.major)?.subs ?? [];
    const sub = typeof parsed.sub === "string" && subs.includes(parsed.sub) ? parsed.sub : null;
    const newSub =
      !sub && typeof parsed.newSub === "string" && parsed.newSub.trim()
        ? parsed.newSub.trim().slice(0, 20)
        : null;
    return { major: parsed.major, sub, newSub };
  } catch {
    return null; // 타임아웃·파싱 실패 등은 조용히 다음 단계(fallback)로
  }
}
