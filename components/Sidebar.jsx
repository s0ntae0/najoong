"use client";

import { useState } from "react";
import {
  Home,
  ShoppingBag,
  Clapperboard,
  Newspaper,
  Archive,
  Folder,
  ChevronDown,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  LogIn,
  LogOut,
  User,
} from "lucide-react";
import { GUEST_LIMIT, GUEST_LIMIT_ENABLED } from "@/lib/storage";
import { FALLBACK_TOPIC } from "@/lib/categories";

// 구버전 고정 대분류(slug) 아이콘 호환용 — 새 주제 카테고리는 Folder
const MAJOR_ICONS = {
  shopping: ShoppingBag,
  video: Clapperboard,
  news: Newspaper,
  etc: Archive,
};

function majorIcon(major) {
  if (major.slug && MAJOR_ICONS[major.slug]) return MAJOR_ICONS[major.slug];
  if (major.name === FALLBACK_TOPIC) return Archive;
  return Folder;
}

// 데스크톱 사이드바. 내용(SidebarContent)은 모바일 드로어에서도 재사용.
export default function Sidebar(props) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-line bg-surface md:flex">
      <SidebarContent {...props} />
    </aside>
  );
}

export function SidebarContent({
  tree,
  counts,
  selected,
  onSelect,
  user,
  onLogin,
  onLogout,
  onAddCategory,
  onRenameCategory,
  onDeleteCategory,
}) {
  const [expanded, setExpanded] = useState({});
  const [addingMajor, setAddingMajor] = useState(false); // 대분류(주제) 추가 중
  const [addingTo, setAddingTo] = useState(null); // 세부주제 추가 중인 대분류 id
  const [editingId, setEditingId] = useState(null); // 이름 변경 중인 카테고리 id

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const startAdding = (majorId) => {
    setExpanded((prev) => ({ ...prev, [majorId]: true }));
    setAddingTo(majorId);
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-6">
        <span className="text-xl font-extrabold tracking-tight">
          나중<span className="text-primary">.</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <NavRow
          icon={Home}
          label="홈"
          active={selected === "home"}
          onClick={() => onSelect("home")}
        />

        <div className="flex items-center justify-between px-3 pb-2 pt-6">
          <p className="text-xs font-medium text-ink-weak">카테고리</p>
          <IconButton label="주제 카테고리 추가" onClick={() => setAddingMajor(true)}>
            <Plus size={14} />
          </IconButton>
        </div>

        {addingMajor && (
          <InlineInput
            indent={false}
            placeholder="새 주제 이름"
            onSubmit={(name) => {
              onAddCategory(null, name);
              setAddingMajor(false);
            }}
            onCancel={() => setAddingMajor(false)}
          />
        )}

        {tree.map((major) => {
          const isOpen = !!expanded[major.id];
          return (
            <div key={major.id}>
              {editingId === major.id ? (
                <InlineInput
                  indent={false}
                  defaultValue={major.name}
                  onSubmit={(name) => {
                    onRenameCategory(major.id, name);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <MajorRow
                  major={major}
                  count={counts[major.id] || 0}
                  active={selected === major.id}
                  isOpen={isOpen}
                  onClick={() => onSelect(major.id)}
                  onToggle={() => toggle(major.id)}
                  onAddSub={() => startAdding(major.id)}
                  onRename={() => setEditingId(major.id)}
                  onDelete={() => onDeleteCategory(major.id)}
                />
              )}

              {isOpen &&
                major.children.map((sub) =>
                  editingId === sub.id ? (
                    <InlineInput
                      key={sub.id}
                      defaultValue={sub.name}
                      onSubmit={(name) => {
                        onRenameCategory(sub.id, name);
                        setEditingId(null);
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <SubRow
                      key={sub.id}
                      sub={sub}
                      majorName={major.name}
                      count={counts[sub.id] || 0}
                      active={selected === sub.id}
                      onClick={() => onSelect(sub.id)}
                      onRename={() => setEditingId(sub.id)}
                      onDelete={() => onDeleteCategory(sub.id)}
                    />
                  )
                )}

              {addingTo === major.id && (
                <InlineInput
                  placeholder="새 세부주제 이름"
                  onSubmit={(name) => {
                    onAddCategory(major.id, name);
                    setAddingTo(null);
                  }}
                  onCancel={() => setAddingTo(null)}
                />
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-line p-3">
        {user ? (
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-weak">
              <User size={15} className="text-primary" />
            </div>
            <span className="min-w-0 flex-1 truncate text-sm text-ink-sub">{user.email}</span>
            <button
              type="button"
              aria-label="로그아웃"
              onClick={onLogout}
              className="rounded-lg p-1.5 text-ink-weak transition-colors hover:bg-gray-50 hover:text-ink"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onLogin}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-strong"
            >
              <LogIn size={16} />
              로그인
            </button>
            {GUEST_LIMIT_ENABLED && (
              <p className="mt-2 text-center text-xs text-ink-weak">
                비회원은 {GUEST_LIMIT}개까지 저장돼요
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NavRow({ icon: Icon, label, count, active, onClick, trailing }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className={`group/row flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] transition-colors ${
        active ? "bg-primary-weak font-semibold text-primary" : "text-ink-sub hover:bg-gray-50"
      }`}
    >
      {Icon && <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />}
      <span className="truncate">{label}</span>
      <span
        className="ml-auto flex shrink-0 items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        {count > 0 && (
          <span
            className={`text-xs tabular-nums group-hover/row:hidden ${
              active ? "text-primary" : "text-ink-weak"
            }`}
          >
            {count}
          </span>
        )}
        {trailing}
      </span>
    </div>
  );
}

// 대분류(주제) 행: 세부주제 추가·펼치기 + 이름 변경·삭제 메뉴
function MajorRow({ major, count, active, isOpen, onClick, onToggle, onAddSub, onRename, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const Icon = majorIcon(major);

  const closeMenu = () => {
    setMenuOpen(false);
    setConfirming(false);
  };

  return (
    <div className="relative">
      <NavRow
        icon={Icon}
        label={major.name}
        count={count}
        active={active}
        onClick={onClick}
        trailing={
          <span className="hidden items-center gap-0.5 group-hover/row:flex">
            <IconButton label={`${major.name}에 세부주제 추가`} onClick={onAddSub}>
              <Plus size={14} />
            </IconButton>
            {major.children.length > 0 && (
              <IconButton
                label={`${major.name} 세부주제 ${isOpen ? "접기" : "펼치기"}`}
                onClick={onToggle}
              >
                <ChevronDown
                  size={14}
                  className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </IconButton>
            )}
            <IconButton label={`${major.name} 관리`} onClick={() => setMenuOpen(true)}>
              <MoreHorizontal size={14} />
            </IconButton>
          </span>
        }
      />

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={closeMenu} />
          <div className="absolute right-2 top-8 z-30 w-52 rounded-xl border border-line bg-surface p-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                closeMenu();
                onRename();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink-sub hover:bg-gray-50"
            >
              <Pencil size={14} />
              이름 변경
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                closeMenu();
                onDelete();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-red-500 hover:bg-red-50"
            >
              <Trash2 size={14} className="shrink-0" />
              {confirming ? `한 번 더 누르면 삭제 (링크는 ${FALLBACK_TOPIC}로)` : "삭제"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SubRow({ sub, majorName, count, active, onClick, onRename, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const closeMenu = () => {
    setMenuOpen(false);
    setConfirming(false);
  };

  return (
    <div className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClick();
        }}
        className={`group/row flex w-full cursor-pointer items-center rounded-lg py-1.5 pl-11 pr-3 text-sm transition-colors ${
          active ? "bg-primary-weak font-semibold text-primary" : "text-ink-sub hover:bg-gray-50"
        }`}
      >
        <span className="truncate">{sub.name}</span>
        <span
          className="ml-auto flex shrink-0 items-center"
          onClick={(e) => e.stopPropagation()}
        >
          {count > 0 && (
            <span
              className={`text-xs tabular-nums group-hover/row:hidden ${
                active ? "text-primary" : "text-ink-weak"
              }`}
            >
              {count}
            </span>
          )}
          <span className="hidden group-hover/row:flex">
            <IconButton label={`${sub.name} 관리`} onClick={() => setMenuOpen(true)}>
              <MoreHorizontal size={14} />
            </IconButton>
          </span>
        </span>
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={closeMenu} />
          <div className="absolute right-2 top-8 z-30 w-44 rounded-xl border border-line bg-surface p-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                closeMenu();
                onRename();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink-sub hover:bg-gray-50"
            >
              <Pencil size={14} />
              이름 변경
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                closeMenu();
                onDelete();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-red-500 hover:bg-red-50"
            >
              <Trash2 size={14} className="shrink-0" />
              {confirming ? `한 번 더 누르면 삭제 (링크는 ${majorName}으로)` : "삭제"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function InlineInput({ defaultValue = "", placeholder, onSubmit, onCancel, indent = true }) {
  const [value, setValue] = useState(defaultValue);

  const submit = () => {
    const name = value.trim();
    if (name) onSubmit(name);
    else onCancel();
  };

  return (
    <div className={`py-1 pr-3 ${indent ? "pl-11" : "pl-3"}`}>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={submit}
        placeholder={placeholder}
        className="w-full rounded-lg border border-primary bg-surface px-2.5 py-1.5 text-sm outline-none placeholder:text-ink-weak"
      />
    </div>
  );
}

function IconButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded p-0.5 text-ink-weak transition-colors hover:bg-gray-100 hover:text-ink"
    >
      {children}
    </button>
  );
}
