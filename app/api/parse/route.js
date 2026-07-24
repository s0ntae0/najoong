import { NextResponse } from "next/server";
import { detectFormat } from "@/lib/classify";
import { classifyTopic } from "@/lib/classifyTopic";

// Vercel 함수 실행 제한 상향: 페이지 fetch(최대 8초) + LLM 판정(최대 6초)이
// 겹치면 Hobby 기본 제한(10초)을 넘을 수 있다.
export const maxDuration = 30;

// 브라우저처럼 보이는 UA — 일부 커머스/뉴스 사이트가 기본 UA를 차단함
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  // LLM 프롬프트용 사용자 카테고리 목록: [{ name, subs: [이름] }]
  const categories = Array.isArray(body.categories) ? body.categories : [];

  // ── 판정 1. URL 형식이 아님 → 저장 거부 ──
  // 프로토콜 없이 도메인만 입력(naver.com)은 흔한 입력이라 https://를 붙여 시도한다.
  let target;
  try {
    target = new URL(rawUrl.match(/^https?:\/\//i) ? rawUrl : `https://${rawUrl}`);
  } catch {
    return NextResponse.json({ error: "올바르지 않은 주소 형식이에요" }, { status: 400 });
  }
  if (!/^https?:$/.test(target.protocol)) {
    return NextResponse.json({ error: "http/https 링크만 저장할 수 있어요" }, { status: 400 });
  }
  // "asdf" 같은 입력도 https://asdf로는 URL 파싱이 되므로, 도메인 형태(점 포함)인지로 거른다
  if (!target.hostname.includes(".")) {
    return NextResponse.json({ error: "올바르지 않은 주소 형식이에요" }, { status: 400 });
  }

  // ── 판정 2~3. 페이지 fetch ──
  // 파싱 실패는 에러가 아니라 상태 — DNS 실패(도메인 자체가 없음)만 저장을 거부하고,
  // 봇 차단·404·타임아웃·연결 거부 등 그 외 모든 실패는 저장하되 parseFailed로 표시한다.
  let meta = { title: "", description: "", image: "", type: "" };
  let finalUrl = target.href;
  let fetchFailed = false;
  let httpOk = true;

  try {
    const response = await fetch(target.href, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    finalUrl = response.url || target.href;
    httpOk = response.ok;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType === "" || contentType.includes("html")) {
      const html = decodeBody(await response.arrayBuffer(), contentType);
      meta = extractMeta(html, finalUrl);
    }
  } catch (err) {
    // 판정 2. DNS 조회 실패(ENOTFOUND)만 저장 거부 — 다른 어떤 실패도 이 분기로 보내지 않는다
    if (err?.cause?.code === "ENOTFOUND") {
      return NextResponse.json({ error: "연결할 수 없는 주소예요" }, { status: 400 });
    }
    fetchFailed = true; // 타임아웃·연결 거부 등 — 저장은 계속
  }

  const domain = new URL(finalUrl).hostname.replace(/^www\./, "");
  // 판정 3. fetch 예외 / HTTP 에러(403·404·429 등) / 제목조차 못 뽑음 → 저장하되 실패 표시
  const parseFailed = fetchFailed || !httpOk || !meta.title;

  // 1) 중분류(형식) 판정 — 도메인 룰 + og:type, 비용 0. 주제 판정의 힌트로도 쓴다.
  const { format } = detectFormat({ domain, ogType: meta.type });

  // 2) 대분류(주제) 판정 — LLM이 제목·설명 + 기존 카테고리 목록을 보고 판정
  const result = await classifyTopic({
    title: meta.title,
    description: meta.description,
    domain,
    format,
    existingCategories: categories,
  });

  const isNewSub = result.sub
    ? !categories.some((c) => c.name === result.topic && (c.subs ?? []).includes(result.sub))
    : false;

  return NextResponse.json({
    url: finalUrl,
    domain,
    ...meta,
    parseFailed,
    format, // 형식 (영상/상품/아티클/기타)
    topic: result.topic, // 대분류(주제)
    subTopic: result.sub, // 세부주제 (없으면 null)
    isNewTopic: result.isNew,
    isNewSub,
    classifyMethod: result.method, // 'llm' | 'fallback'
  });
}

// EUC-KR 등 비 UTF-8 한국 사이트 대응: 헤더/메타에서 charset을 찾아 재디코딩
function decodeBody(buffer, contentType) {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  const headerCharset = contentType?.match(/charset=([\w-]+)/i)?.[1];
  const metaCharset =
    utf8.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ||
    utf8.match(/<meta[^>]+content=["'][^"']*charset=([\w-]+)/i)?.[1];
  const charset = (headerCharset || metaCharset || "utf-8").toLowerCase();
  if (charset === "utf-8" || charset === "utf8") return utf8;
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return utf8;
  }
}

function extractMeta(html, baseUrl) {
  // 유튜브는 og 태그가 600KB 지점에 나오기도 함 — 넉넉히 자르되 상한은 둔다
  const head = html.slice(0, 1_500_000);
  const title =
    getMetaContent(head, "og:title") ||
    decodeEntities(head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || "");
  const description =
    getMetaContent(head, "og:description") || getMetaContent(head, "description");
  const type = getMetaContent(head, "og:type");
  let image = getMetaContent(head, "og:image");
  if (image) {
    try {
      image = new URL(image, baseUrl).href; // 상대 경로 og:image 대응
    } catch {
      image = "";
    }
  }
  return { title, description, image, type };
}

// property/name과 content의 순서가 뒤바뀐 메타 태그까지 매칭
function getMetaContent(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1].trim());
  }
  return "";
}

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&"); // 이중 인코딩 방지를 위해 마지막에
}
