// 주제(대분류) 판정 — 서버 전용. LLM이 제목·설명을 이해해 사용자의 서랍에 맞춰 분류한다.
// 기존 카테고리 목록을 프롬프트에 넣어 재사용을 우선하고, 없을 때만 신규 제안을 받는다.
import { FALLBACK_TOPIC } from "./categories";

// 최저 티어 모델. provider/모델 교체 시 여기만 수정.
// (gemini-2.5-flash-lite는 신규 사용자에게 단종 — 2026-07 기준 3.1 lite 사용)
const GEMINI_MODEL = "gemini-3.1-flash-lite";

// 같은 도메인+제목은 결과를 재사용해 중복 호출 방지 (서버 프로세스 생존 동안 유지)
const CACHE_MAX = 500;
const cache = new Map(); // "domain|title" → { topic, sub }

function cacheGet(key) {
  return cache.get(key) ?? null;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value); // 가장 오래된 것부터
  cache.set(key, value);
}

// 카테고리 이름 정리: 공백 정돈 + 과도하게 긴 이름 방지
function cleanName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ").slice(0, 12);
  return name || null;
}

/**
 * 주제 판정.
 * @param {object} meta { title, description, domain, format, existingCategories }
 *   - format: 도메인 룰·og:type으로 판정한 형식 라벨 (영상/상품/아티클/기타) — 분류 힌트로만 사용
 *   - existingCategories: [{ name, subs: [이름] }] — 사용자의 현재 서랍
 * @returns {Promise<{ topic: string, sub: string|null, isNew: boolean, method: 'llm'|'fallback' }>}
 *   LLM 실패·키 미설정 시 topic은 FALLBACK_TOPIC('기타'), method는 'fallback'.
 */
export async function classifyTopic({
  title,
  description,
  domain,
  format,
  existingCategories = [],
}) {
  const fallback = { topic: FALLBACK_TOPIC, sub: null, isNew: false, method: "fallback" };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback;
  if (!title && !description) return fallback; // 판단 근거가 없으면 호출 낭비

  const majorNames = existingCategories.map((c) => c.name);

  const cacheKey = `${domain}|${title}`;
  const cached = cacheGet(cacheKey);
  if (cached) return withIsNew(cached, majorNames);

  const categoryLines = existingCategories
    .map((c) => `- ${c.name}: ${c.subs?.length ? c.subs.join(", ") : "(세부주제 없음)"}`)
    .join("\n");

  const prompt = [
    "웹페이지를 사용자의 주제 카테고리로 분류하는 시스템이다. 아래 정보를 보고 JSON으로만 답하라.",
    "",
    "아래는 사용자가 이미 가진 카테고리 목록이다.",
    "이 링크에 맞는 카테고리가 목록에 있으면 그 이름을 '그대로' 반환하고,",
    "마땅한 게 없을 때만 새 카테고리 이름을 제안하라.",
    "",
    "기존 카테고리 (대분류: 세부주제들):",
    categoryLines || "- (아직 없음 — 이 링크에 맞는 대분류를 새로 만들어라)",
    "",
    "페이지 정보:",
    `- 도메인: ${domain}`,
    `- 제목: ${title || "(없음)"}`,
    `- 설명: ${(description || "(없음)").slice(0, 200)}`,
    `- 형식 힌트: ${format || "기타"} (영상/상품/아티클/기타 — 참고만 하고 주제로 답하지 마라)`,
    "",
    "규칙:",
    "1. topic: 대분류 주제. 콘텐츠의 형식이 아니라 '무엇에 관한 것인가'로 판단한다.",
    "   (예: 유튜브 강의 → 공부, 요리 영상 → 요리, 운동화 상품 → 쇼핑)",
    "2. sub: topic 아래 세부주제. 기존 세부주제 중 어울리는 것이 있으면 그 이름을 그대로 사용하라.",
    "3. 어울리는 기존 세부주제가 없고 콘텐츠의 세부주제가 분명하면 새로 제안하라.",
    "   (예: 정치 기사 → 뉴스/정치, 축구 영상 → 스포츠/축구, 파이썬 강의 → 공부/프로그래밍)",
    "   단, 기존 세부주제와 뜻이 겹치는 다른 이름을 만들지 마라 (경제가 있는데 금융 금지).",
    "   세부주제를 특정하기 힘든 포괄적 콘텐츠만 null.",
    "4. 새 이름은 2~4글자 한국어 명사로 짧게 (예: 공부, 요리, 여행, 경제, 철학).",
    '5. 출력 형식: {"topic":"...","sub":"..." 또는 null}',
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
    if (!response.ok) return fallback;

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return fallback;

    const parsed = JSON.parse(text);
    const topic = cleanName(parsed.topic);
    if (!topic) return fallback;
    const sub = cleanName(parsed.sub);

    const result = { topic, sub: sub === topic ? null : sub };
    cacheSet(cacheKey, result);
    return withIsNew(result, majorNames);
  } catch {
    return fallback; // 타임아웃·파싱 실패 등 — 저장 흐름은 계속된다
  }
}

// 기존 대분류와 정확히 같은 이름이면 재사용(isNew=false) — 중복 생성 방지의 1차 방어선.
// 최종 중복 방지는 클라이언트의 이름 기반 find-or-create가 담당한다.
function withIsNew(result, majorNames) {
  return { ...result, isNew: !majorNames.includes(result.topic), method: "llm" };
}
