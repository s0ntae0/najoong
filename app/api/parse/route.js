import { NextResponse } from "next/server";
import { detectFormat } from "@/lib/classify";
import { classifyTopic } from "@/lib/classifyTopic";

// 브라우저처럼 보이는 UA — 일부 커머스/뉴스 사이트가 기본 UA를 차단함
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  // LLM 프롬프트용 사용자 카테고리 목록: [{ name, subs: [이름] }]
  const categories = Array.isArray(body.categories) ? body.categories : [];

  let target;
  try {
    target = new URL(rawUrl.match(/^https?:\/\//i) ? rawUrl : `https://${rawUrl}`);
  } catch {
    return NextResponse.json({ error: "올바른 URL이 아니에요." }, { status: 400 });
  }
  if (!/^https?:$/.test(target.protocol)) {
    return NextResponse.json({ error: "http/https 링크만 저장할 수 있어요." }, { status: 400 });
  }

  // 파싱 실패는 에러가 아니라 상태 — 링크는 항상 저장 가능해야 한다
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
  } catch {
    fetchFailed = true;
  }

  const domain = new URL(finalUrl).hostname.replace(/^www\./, "");
  const parseFailed = fetchFailed || (!httpOk && !meta.title);

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
