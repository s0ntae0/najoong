"use client";

import { Link, Loader2 } from "lucide-react";

// 홈 화면 URL 입력용 서랍 컴포넌트.
// 서랍 SVG 일러스트 + 안쪽 입력창 + 앞판 손잡이형 저장 버튼 한 세트.
// 상태는 갖지 않고, 저장 로직은 부모(HomeView)의 핸들러를 그대로 사용한다.
export default function DrawerInput({ value, onChange, onSubmit, loading }) {
  return (
    <form
      onSubmit={onSubmit}
      className="relative mx-auto mt-3.5 aspect-[8/5] w-[672px] max-w-full"
    >
      <svg
        viewBox="0 0 640 400"
        width="100%"
        height="100%"
        className="block overflow-visible"
      >
        <defs>
          <filter id="najoong-shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>
        {/* 반쯤 열린 서랍 아래 부드러운 그림자 */}
        <ellipse
          cx="320"
          cy="294"
          rx="230"
          ry="14"
          fill="#E4D9CD"
          opacity="0.6"
          filter="url(#najoong-shadow)"
        />

        {/* 서랍장 몸통 */}
        <rect x="40" y="56" width="560" height="156" rx="16" fill="#F3E7DD" stroke="#BE7250" strokeWidth="3" />

        {/* 서랍 슬롯 개구부 (서랍 뒤 안쪽) */}
        <rect x="60" y="130" width="520" height="66" rx="8" fill="#D9C3B4" />
        <path d="M68 130 h504 a8 8 0 0 1 8 8 v6 h-520 v-6 a8 8 0 0 1 8 -8 Z" fill="#C7AD99" opacity="0.7" />

        {/* 반쯤 열린 서랍: 위쪽은 프레임에 걸려 있고 아래쪽이 빠져나온 상태 */}
        <rect x="75" y="82" width="490" height="200" rx="12" fill="#BE7250" />
        {/* 프레임 아래로 미끄러지는 부분의 그림자 */}
        <rect x="75" y="130" width="490" height="15" fill="#5C3A28" opacity="0.13" />
        {/* 밝은 서랍 안쪽 바닥 */}
        <rect x="91" y="174" width="458" height="82" rx="8" fill="#F5EBE4" />
        <path d="M99 174 h442 a8 8 0 0 1 8 8 v4 h-458 v-4 a8 8 0 0 1 8 -8 Z" fill="#E7D8CB" opacity="0.8" />

        {/* 서랍장 앞판 오버레이: 서랍 위쪽을 프레임 뒤로 넣어 보이게 */}
        <rect x="60" y="58" width="520" height="72" fill="#F3E7DD" />
        <rect x="60" y="72" width="520" height="50" rx="8" fill="#FBF6F1" stroke="#E7D6C9" strokeWidth="2" />
        <rect x="292" y="93" width="56" height="7" rx="3.5" fill="#BE7250" />
      </svg>

      {/* 서랍 안쪽 바닥에 놓인 URL 입력창 */}
      <div className="absolute left-1/2 top-[47.5%] w-[60%] -translate-x-1/2">
        <div className="relative w-full">
          <Link
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-weak"
          />
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://…"
            aria-label="저장할 링크 주소"
            className="h-[48px] w-full rounded-lg border border-line bg-surface pl-[38px] pr-3.5 text-[14px] text-ink shadow-sm outline-none transition-colors placeholder:text-ink-weak focus:border-primary focus:ring-[3px] focus:ring-primary-weak"
          />
        </div>
      </div>

      {/* 앞판 손잡이 = 저장 버튼 */}
      <button
        type="submit"
        aria-label="링크 저장"
        className="absolute left-1/2 top-[64%] flex h-[28px] w-[150px] -translate-x-1/2 items-center justify-center gap-1 rounded-full bg-primary-weak text-xs font-semibold text-primary-strong shadow-sm transition-all hover:translate-y-[3px] hover:bg-primary-strong hover:text-white active:translate-y-[5px]"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : "저장"}
      </button>
    </form>
  );
}
