"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { SidebarContent } from "@/components/Sidebar";

// 모바일 상단 바 + 드로어. 하단 탭바(대분류 이동)와 달리
// 드로어에서는 하위 카테고리 탐색·편집까지 가능하다.
export default function MobileHeader(props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-4 md:hidden">
        <span className="text-lg font-extrabold tracking-tight">
          나중<span className="text-primary">.</span>
        </span>
        <button
          type="button"
          aria-label="메뉴 열기"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-ink-sub hover:bg-gray-50"
        >
          <Menu size={20} />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface shadow-xl">
            <button
              type="button"
              aria-label="메뉴 닫기"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-ink-weak hover:bg-gray-50"
            >
              <X size={18} />
            </button>
            <SidebarContent
              {...props}
              onSelect={(id) => {
                props.onSelect(id);
                setOpen(false);
              }}
              onLogin={() => {
                setOpen(false);
                props.onLogin();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
