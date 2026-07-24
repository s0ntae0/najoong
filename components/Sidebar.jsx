"use client";

import { useState } from "react";
import {
  Home,
  ShoppingBag,
  Clapperboard,
  Newspaper,
  Archive,
  Folder,
  FolderInput,
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

// "기타로 / 공부로 / 프로그래밍으로" — 받침에 따라 조사 선택 (한글 아니면 '(으)로')
function withRo(word) {
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return `${word}(으)로`;
  const jong = (code - 0xac00) % 28;
  return jong === 0 || jong === 8 ? `${word}로` : `${word}으로`;
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
            onSubmit={async (name) => {
              const ok = await onAddCategory(null, name);
              if (ok) setAddingMajor(false);
              return ok;
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
                    const ok = onRenameCategory(major.id, name);
                    if (ok !== false) setEditingId(null);
                    return ok;
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
                  onDelete={(opts) => onDeleteCategory(major.id, opts)}
                />
              )}

              {isOpen &&
                major.children.map((sub) =>
                  editingId === sub.id ? (
                    <InlineInput
                      key={sub.id}
                      defaultValue={sub.name}
                      onSubmit={(name) => {
                        const ok = onRenameCategory(sub.id, name);
                        if (ok !== false) setEditingId(null);
                        return ok;
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
                      onDelete={(opts) => onDeleteCategory(sub.id, opts)}
                    />
                  )
                )}

              {addingTo === major.id && (
                <InlineInput
                  placeholder="새 세부주제 이름"
                  onSubmit={async (name) => {
                    const ok = await onAddCategory(major.id, name);
                    if (ok) setAddingTo(null);
                    return ok;
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

// 카테고리 관리 메뉴: 이름 변경 + 삭제.
// 링크가 있으면 삭제 시 처리 방법을 고르게 한다 — 보존(이동)이 안전한 기본이라 먼저 놓는다.
// keepTarget: 링크 보존 시 이동할 곳 이름. null이면(기타 대분류) 보존 이동 불가.
function CategoryMenu({ onClose, onRename, onDelete, linkCount, childCount = 0, keepTarget }) {
  const [view, setView] = useState("root"); // root | delete

  return (
    <>
      <div className="fixed inset-0 z-20" onClick={onClose} />
      <div className="absolute right-2 top-8 z-30 w-56 rounded-xl border border-line bg-surface p-1 shadow-lg">
        {view === "root" ? (
          <>
            <button
              type="button"
              onClick={() => {
                onClose();
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
                // 링크도 하위도 없으면 고를 것이 없다 — 바로 삭제
                if (linkCount === 0 && childCount === 0) {
                  onClose();
                  onDelete({ deleteLinks: false });
                  return;
                }
                setView("delete");
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-red-500 hover:bg-red-50"
            >
              <Trash2 size={14} />
              삭제
            </button>
          </>
        ) : (
          <>
            <p className="px-2.5 pb-1.5 pt-2 text-xs leading-relaxed text-ink-weak">
              {childCount > 0 && (
                <>
                  세부주제 {childCount}개도 함께 삭제돼요.
                  <br />
                </>
              )}
              {linkCount > 0 ? `안에 있는 링크 ${linkCount}개는 어떻게 할까요?` : "정말 삭제할까요?"}
            </p>
            {linkCount > 0 && keepTarget && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete({ deleteLinks: false });
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-ink-sub hover:bg-gray-50"
              >
                <FolderInput size={14} className="shrink-0" />
                링크는 {withRo(keepTarget)} 옮기고 삭제
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onClose();
                onDelete({ deleteLinks: true });
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-red-500 hover:bg-red-50"
            >
              <Trash2 size={14} className="shrink-0" />
              {linkCount > 0 ? `링크 ${linkCount}개도 함께 삭제` : "삭제"}
            </button>
          </>
        )}
      </div>
    </>
  );
}

// 대분류(주제) 행: 세부주제 추가·펼치기 + 관리 메뉴
function MajorRow({ major, count, active, isOpen, onClick, onToggle, onAddSub, onRename, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const Icon = majorIcon(major);

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
        <CategoryMenu
          onClose={() => setMenuOpen(false)}
          onRename={onRename}
          onDelete={onDelete}
          linkCount={count}
          childCount={major.children.length}
          keepTarget={major.name === FALLBACK_TOPIC ? null : FALLBACK_TOPIC}
        />
      )}
    </div>
  );
}

function SubRow({ sub, majorName, count, active, onClick, onRename, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);

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
        <CategoryMenu
          onClose={() => setMenuOpen(false)}
          onRename={onRename}
          onDelete={onDelete}
          linkCount={count}
          keepTarget={majorName}
        />
      )}
    </div>
  );
}

function InlineInput({ defaultValue = "", placeholder, onSubmit, onCancel, indent = true }) {
  const [value, setValue] = useState(defaultValue);
  const [duplicate, setDuplicate] = useState(false); // 같은 이름이 이미 있어 저장 거부됨

  const submit = async () => {
    const name = value.trim();
    if (!name) {
      onCancel(); // 빈 이름은 저장하지 않는다
      return;
    }
    const ok = await onSubmit(name);
    if (ok === false) setDuplicate(true); // 입력을 유지하고 안내
  };

  return (
    <div className={`py-1 pr-3 ${indent ? "pl-11" : "pl-3"}`}>
      <input
        autoFocus
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDuplicate(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={submit}
        placeholder={placeholder}
        className={`w-full rounded-lg border bg-surface px-2.5 py-1.5 text-sm outline-none placeholder:text-ink-weak ${
          duplicate ? "border-red-300" : "border-primary"
        }`}
      />
      {duplicate && <p className="mt-1 px-0.5 text-xs text-red-500">이미 있는 이름이에요</p>}
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
