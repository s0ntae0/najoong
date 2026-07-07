"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GUEST_LIMIT } from "@/lib/storage";

function translateAuthError(message = "") {
  if (message.includes("Invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않아요.";
  if (message.includes("already registered")) return "이미 가입된 이메일이에요.";
  if (message.includes("at least 6")) return "비밀번호는 6자 이상이어야 해요.";
  if (message.includes("valid email")) return "올바른 이메일 형식이 아니에요.";
  if (message.includes("Email rate limit")) return "요청이 많아요. 잠시 후 다시 시도해주세요.";
  return "요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.";
}

function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export default function AuthModal({ open, onClose, atLimit }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!open) return null;

  const configured = !!supabase;

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!configured || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) setError(translateAuthError(err.message));
        else onClose();
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) setError(translateAuthError(err.message));
        else if (!data.session) setNotice("확인 메일을 보냈어요. 메일함에서 인증을 완료해주세요.");
        else onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    if (!configured) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-ink-weak hover:bg-gray-50 hover:text-ink"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-bold">
          {atLimit ? `${GUEST_LIMIT}개를 모두 저장했어요` : "로그인"}
        </h2>
        <p className="mt-1.5 text-sm text-ink-weak">
          로그인하면 개수 제한 없이 저장하고, 어디서든 다시 볼 수 있어요.
        </p>

        {!configured ? (
          <p className="mt-6 rounded-xl bg-gray-50 p-4 text-sm leading-relaxed text-ink-sub">
            Supabase 연결 정보가 아직 설정되지 않았어요.
            <br />
            .env.local의 NEXT_PUBLIC_SUPABASE_ANON_KEY를 채운 뒤 서버를 재시작해주세요.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={handleGoogle}
              className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-surface py-2.5 text-sm font-medium text-ink transition-colors hover:bg-gray-50"
            >
              <GoogleLogo />
              Google로 계속하기
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="text-xs text-ink-weak">또는 이메일로</span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-2.5">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="이메일"
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-ink-weak focus:border-primary"
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 (6자 이상)"
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-ink-weak focus:border-primary"
              />
              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : mode === "signin" ? (
                  "로그인"
                ) : (
                  "가입하기"
                )}
              </button>
            </form>

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
            {notice && <p className="mt-3 text-sm text-primary">{notice}</p>}

            <p className="mt-5 text-center text-sm text-ink-weak">
              {mode === "signin" ? "아직 계정이 없나요?" : "이미 계정이 있나요?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError("");
                  setNotice("");
                }}
                className="font-semibold text-primary hover:text-primary-strong"
              >
                {mode === "signin" ? "가입하기" : "로그인"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
