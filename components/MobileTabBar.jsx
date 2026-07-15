"use client";

import { Home, ShoppingBag, Clapperboard, Newspaper, Archive, Folder } from "lucide-react";
import { FALLBACK_TOPIC } from "@/lib/categories";

// 구버전 고정 대분류(slug) 아이콘 호환용 — 새 주제 카테고리는 Folder
const MAJOR_ICONS = {
  shopping: ShoppingBag,
  video: Clapperboard,
  news: Newspaper,
  etc: Archive,
};

export default function MobileTabBar({ tree, selected, onSelect }) {
  const tabs = [
    { id: "home", name: "홈", icon: Home },
    ...tree.map((major) => ({
      id: major.id,
      name: major.name,
      icon:
        (major.slug && MAJOR_ICONS[major.slug]) ||
        (major.name === FALLBACK_TOPIC ? Archive : Folder),
    })),
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="grid grid-cols-5">
        {tabs.slice(0, 5).map(({ id, name, icon: Icon }) => {
          const active = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${
                active ? "font-semibold text-primary" : "text-ink-weak"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              {name}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
