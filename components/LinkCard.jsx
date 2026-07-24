"use client";

import { useState } from "react";
import {
  Globe,
  MoreHorizontal,
  Trash2,
  CornerDownRight,
  FolderInput,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { timeAgo } from "@/lib/format";
import DomainThumb from "@/components/DomainThumb";

export default function LinkCard({ link, tree, onRemove, onMove }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState("root"); // root: [이동, 삭제] | move: 카테고리 목록
  const showImage = link.imageUrl && !imageFailed;

  const openMenu = () => {
    setMenuView("root");
    setMenuOpen(true);
  };

  return (
    <li className="group relative">
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer"
        className="flex gap-4 rounded-2xl border border-transparent bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:border-line hover:shadow-sm"
      >
        <div className="min-w-0 flex-1">
          {/* 파싱 실패 링크는 제목 자리에 도메인을 보여준다 (URL 자체는 살아 있다) */}
          <p className="line-clamp-2 pr-7 text-[15px] font-semibold leading-snug">
            {link.parseFailed ? link.domain : link.title || link.domain}
          </p>
          {link.parseFailed ? (
            <p className="mt-1 text-xs leading-snug text-ink-weak">정보를 불러오지 못했어요</p>
          ) : (
            link.description && (
              <p className="mt-1 line-clamp-2 text-sm leading-snug text-ink-weak">
                {link.description}
              </p>
            )
          )}
          <p className="mt-2.5 flex items-center gap-1.5 text-xs text-ink-weak">
            <Globe size={12} />
            <span className="truncate">{link.domain}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{timeAgo(link.savedAt)}</span>
          </p>
        </div>

        {showImage ? (
          <img
            src={link.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="h-20 w-28 shrink-0 rounded-xl bg-gray-100 object-cover"
          />
        ) : (
          // 파싱 실패·이미지 로드 실패 공용 대체 표시 (깨진 이미지 아이콘 노출 방지)
          <DomainThumb domain={link.domain} className="h-20 w-28 rounded-xl" />
        )}
      </a>

      <button
        type="button"
        aria-label="링크 관리"
        onClick={openMenu}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-ink-weak transition-colors hover:bg-gray-100 hover:text-ink md:opacity-0 md:group-hover:opacity-100"
      >
        <MoreHorizontal size={16} />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-3 top-10 z-30 max-h-80 w-52 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
            {menuView === "root" ? (
              <>
                <button
                  type="button"
                  onClick={() => setMenuView("move")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink-sub hover:bg-gray-50"
                >
                  <FolderInput size={14} />
                  이동
                  <ChevronRight size={14} className="ml-auto text-ink-weak" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onRemove(link.id); // 실행취소 토스트가 확인 절차를 대신한다
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                  삭제
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setMenuView("root")}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-ink-weak hover:bg-gray-50"
                >
                  <ChevronLeft size={14} />
                  카테고리 이동
                </button>
                {tree.map((major) => (
                  <div key={major.id}>
                    <MoveItem
                      label={major.name}
                      current={link.categoryId === major.id}
                      onClick={() => {
                        setMenuOpen(false);
                        onMove(link.id, major.id);
                      }}
                    />
                    {major.children.map((sub) => (
                      <MoveItem
                        key={sub.id}
                        label={sub.name}
                        indent
                        current={link.categoryId === sub.id}
                        onClick={() => {
                          setMenuOpen(false);
                          onMove(link.id, sub.id);
                        }}
                      />
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </li>
  );
}

function MoveItem({ label, indent, current, onClick }) {
  return (
    <button
      type="button"
      disabled={current}
      onClick={onClick}
      className={`flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm ${
        current ? "font-semibold text-primary" : "text-ink-sub hover:bg-gray-50"
      } ${indent ? "pl-7" : ""}`}
    >
      {indent && <CornerDownRight size={12} className="shrink-0 text-ink-weak" />}
      <span className="truncate">{label}</span>
    </button>
  );
}
