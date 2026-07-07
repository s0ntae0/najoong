"use client";

import { useState } from "react";
import { Link2, Loader2, ArrowRight, Globe, ImageOff } from "lucide-react";
import { findCategory, majorOf } from "@/lib/categories";
import { GUEST_LIMIT } from "@/lib/storage";

const METHOD_LABELS = {
  domain: "도메인 규칙",
  og_type: "og:type 메타",
  llm: "AI 분류",
  fallback: "미분류",
};

export default function HomeView({ onSave, onNavigate, categories, user, guestCount, onRequestLogin }) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim() || status === "loading") return;
    setStatus("loading");
    setError("");
    try {
      const link = await onSave(url.trim());
      if (!link) {
        // 게스트 한도 초과 — 로그인 모달이 열렸으니 조용히 대기 상태로
        setStatus("idle");
        return;
      }
      setSaved(link);
      setStatus("done");
      setUrl("");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  const savedCategory = saved ? findCategory(categories, saved.categoryId) : null;
  const savedMajor = saved ? findCategory(categories, majorOf(categories, saved.categoryId)) : null;
  const savedLabel = savedCategory?.parentId
    ? `${savedMajor?.name} · ${savedCategory.name}`
    : savedMajor?.name;

  return (
    <div className="flex min-h-[calc(100dvh-8.5rem)] items-center justify-center px-5 md:min-h-dvh">
      <div className="w-full max-w-xl -translate-y-8">
        <h1 className="text-center text-2xl font-bold leading-snug md:text-[28px]">
          나중에 볼 링크, 일단 여기 두세요
        </h1>
        <p className="mt-3 text-center text-[15px] text-ink-weak">
          주소를 붙여넣으면 알아서 분류해서 정리해 드려요
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 flex items-center gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm transition-colors focus-within:border-primary"
        >
          <Link2 size={20} className="ml-3 shrink-0 text-ink-weak" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https:// 링크 붙여넣기"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-ink-weak"
          />
          <button
            type="submit"
            disabled={!url.trim() || status === "loading"}
            className="flex shrink-0 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-40"
          >
            {status === "loading" ? <Loader2 size={18} className="animate-spin" /> : "저장"}
          </button>
        </form>

        {!user && (
          <p className="mt-4 text-center text-xs text-ink-weak">
            비회원 저장 {Math.min(guestCount, GUEST_LIMIT)}/{GUEST_LIMIT}개 ·{" "}
            <button
              type="button"
              onClick={onRequestLogin}
              className="font-medium text-primary hover:text-primary-strong"
            >
              로그인하고 무제한 저장
            </button>
          </p>
        )}

        {status === "error" && (
          <p className="mt-4 text-center text-sm text-red-500">{error}</p>
        )}

        {status === "done" && saved && (
          <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm text-ink-sub">
                <span className="font-semibold text-primary">{savedLabel}</span>
                에 저장했어요
                <span className="ml-1.5 text-xs text-ink-weak">
                  {METHOD_LABELS[saved.classifyMethod]}
                </span>
              </p>
              <button
                type="button"
                onClick={() => onNavigate(saved.categoryId)}
                className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:text-primary-strong"
              >
                보러 가기
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              {saved.imageUrl ? (
                <img
                  src={saved.imageUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-12 w-16 shrink-0 rounded-lg bg-gray-100 object-cover"
                />
              ) : (
                <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-50">
                  {saved.parseFailed ? (
                    <ImageOff size={16} className="text-gray-300" />
                  ) : (
                    <Globe size={16} className="text-gray-300" />
                  )}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{saved.title}</p>
                <p className="mt-0.5 truncate text-xs text-ink-weak">
                  {saved.parseFailed ? "미리보기 정보를 불러오지 못했어요" : saved.domain}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
