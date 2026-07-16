"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Loader2, AlertCircle, PartyPopper } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { GUEST_LIMIT } from "@/lib/storage";

// 서랍 로그인 모달. 프로토타입(drawer-login-prototype-v3)의 2칸 서랍장 디자인:
// 아래 칸 서랍이 열려 로그인 폼이 나와 있고, 성공하면 서랍이 닫히며 폭죽,
// 실패하면 서랍이 걸려 덜컹거린다. 애니메이션 keyframes는 globals.css에.
// 색상은 홈 서랍(DrawerInput)과 동일한 클레이 팔레트로 통일.

function translateAuthError(message = "") {
  if (message.includes("Invalid login credentials"))
    return "이메일 또는 비밀번호가 맞지 않아요. 서랍이 잠겨 있어요.";
  if (message.includes("already registered")) return "이미 가입된 이메일이에요.";
  if (message.includes("Email not confirmed"))
    return "메일 인증이 아직 안 됐어요. 메일함에서 인증을 완료해주세요.";
  if (message.includes("at least 6")) return "비밀번호는 6자 이상이어야 해요.";
  if (message.includes("valid email")) return "올바른 이메일 형식이 아니에요.";
  if (message.includes("Email rate limit")) return "요청이 많아요. 잠시 후 다시 시도해주세요.";
  return "요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.";
}

function GoogleLogo() {
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

const CONFETTI_COLORS = ["#be7250", "#e3b48c", "#a85e3e", "#e9c46a", "#8a6543"];

export default function DrawerLogin({ open, onClose, atLimit }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); // 네트워크 응답 대기 (중복 제출 방지)
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // 서랍 상태: reopen(열리는 중) | open | fail(덜컹) | success(닫힘)
  const [phase, setPhase] = useState("open");
  const [faceClosed, setFaceClosed] = useState(false); // 아래 칸 닫힌 면
  const [doneShow, setDoneShow] = useState(false);
  const sceneRef = useRef(null);
  const animatingRef = useRef(false);
  const timersRef = useRef([]);

  const t = useCallback((ms, fn) => {
    timersRef.current.push(setTimeout(fn, ms));
  }, []);

  // 열릴 때마다 초기화 + 서랍이 열리는 입장 모션 (프로토타입 slideOpen 재활용)
  useEffect(() => {
    if (!open) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      animatingRef.current = false;
      return;
    }
    setMode("signin");
    setEmail("");
    setPassword("");
    setBusy(false);
    setError("");
    setNotice("");
    setFaceClosed(false);
    setDoneShow(false);
    setPhase("reopen");
    const timer = setTimeout(() => setPhase("open"), 600);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  const fireConfetti = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const scene = sceneRef.current;
    if (!scene) return;
    for (let i = 0; i < 28; i++) {
      const p = document.createElement("div");
      p.style.cssText =
        "position:absolute;width:9px;height:9px;border-radius:2px;top:150px;left:50%;opacity:0;z-index:6;pointer-events:none;" +
        `background:${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};`;
      scene.appendChild(p);

      const angle = Math.random() * Math.PI - Math.PI;
      const dist = 100 + Math.random() * 140;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 30;
      const rot = Math.random() * 540 - 270;

      p.animate(
        [
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 1, offset: 0.7 },
          { transform: `translate(${dx}px, ${dy + 80}px) rotate(${rot}deg)`, opacity: 0 },
        ],
        { duration: 900 + Math.random() * 400, easing: "cubic-bezier(.2,.6,.3,1)" }
      ).onfinish = () => p.remove();
    }
  }, []);

  const runFail = useCallback(
    (message) => {
      animatingRef.current = true;
      setPhase("fail");
      t(560, () => setError(message));
      t(1000, () => {
        animatingRef.current = false;
      });
    },
    [t]
  );

  const runSuccess = useCallback(() => {
    animatingRef.current = true;
    setPhase("success");
    // 서랍이 들어가는 동안 닫힌 면이 같이 차올라 동시에 끝남 (프로토타입 타이밍 유지)
    t(280, () => setFaceClosed(true));
    t(620, fireConfetti);
    t(850, () => setDoneShow(true));
    // 성공 메시지를 잠시 보여준 뒤 모달 닫기 → 로그인 상태의 홈으로
    t(2400, () => {
      animatingRef.current = false;
      onClose();
    });
  }, [t, fireConfetti, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supabase || busy || animatingRef.current) return;
    setBusy(true);
    setError("");
    setNotice("");
    setPhase("open"); // 직전 fail 클래스 제거 → 연속 실패에도 애니메이션 재실행
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) runFail(translateAuthError(err.message));
        else runSuccess();
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) runFail(translateAuthError(err.message));
        else if (!data.session)
          setNotice("확인 메일을 보냈어요. 메일함에서 인증을 완료해주세요.");
        else runSuccess();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    if (!supabase || busy || animatingRef.current) return;
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (err) {
      setBusy(false);
      runFail(translateAuthError(err.message));
    }
    // 성공 시 구글로 리다이렉트되므로 busy를 유지
  };

  const requestClose = () => {
    if (!busy && !animatingRef.current) onClose();
  };

  if (!open) return null;

  const configured = !!supabase;
  const drawerAnim =
    phase === "fail"
      ? "drawer-login-fail"
      : phase === "success"
        ? "drawer-login-success"
        : phase === "reopen"
          ? "drawer-login-reopen"
          : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={requestClose} />

      <div ref={sceneRef} className="relative w-full max-w-[560px]">
        <button
          type="button"
          aria-label="닫기"
          onClick={requestClose}
          className="absolute -top-10 right-0 rounded-lg p-1.5 text-white/70 transition-colors hover:text-white"
        >
          <X size={20} />
        </button>

        {/* ── 2칸 서랍장 ── */}
        <div
          className={`relative z-[3] grid gap-3 rounded-[22px] border-[2.5px] border-primary bg-[#F3E7DD] p-3.5 ${
            phase === "success" ? "drawer-login-bump" : ""
          }`}
        >
          {/* 위 칸: 항상 닫혀 있음 */}
          <div className="relative h-[76px] overflow-hidden rounded-xl">
            <div className="absolute inset-0 grid place-items-center rounded-xl border-[1.5px] border-line bg-[#FBF6F1]">
              <div className="h-3 w-[92px] rounded-full bg-primary" />
            </div>
          </div>
          {/* 아래 칸: 열려 있는 입구 → 성공 시 닫힌 면이 차오른다 */}
          <div className="relative h-[76px] overflow-hidden rounded-xl">
            <div className="absolute inset-0 rounded-xl bg-[#5C3A28] shadow-[inset_0_10px_14px_rgba(0,0,0,0.45)]" />
            <div
              className={`drawer-login-face absolute inset-0 grid place-items-center rounded-xl border-[1.5px] border-line bg-[#FBF6F1] ${
                faceClosed ? "closed" : ""
              }`}
            >
              <div className="h-3 w-[92px] rounded-full bg-primary" />
            </div>
          </div>
        </div>

        {/* ── 서랍 트랙 (입구 위는 클리핑) ── */}
        <div className="relative z-[2] mx-10 -mt-1 overflow-hidden pb-[60px]">
          {/* ── 열려 있는 서랍 본체 ── */}
          <div
            className={`relative rounded-b-[20px] bg-gradient-to-b from-primary to-primary-strong px-6 pb-[18px] pt-[22px] shadow-[inset_0_6px_8px_-4px_rgba(0,0,0,0.3),0_22px_40px_-18px_rgba(92,58,40,0.5)] ${drawerAnim}`}
          >
            <form onSubmit={handleSubmit}>
              <div className="rounded-[14px] bg-primary-weak px-7 pb-6 pt-[26px] shadow-[inset_0_2px_5px_rgba(0,0,0,0.08)]">
                <h1 className="text-lg font-semibold tracking-tight">
                  {atLimit
                    ? `${GUEST_LIMIT}개를 모두 저장했어요`
                    : mode === "signin"
                      ? "로그인"
                      : "회원가입"}
                </h1>
                <p className="mb-4 mt-1.5 text-[13px] leading-relaxed text-ink-sub">
                  로그인하면 개수 제한 없이 저장하고, 어디서든 다시 볼 수 있어요.
                </p>

                {!configured ? (
                  <p className="rounded-xl bg-white p-4 text-[13px] leading-relaxed text-ink-sub">
                    Supabase 연결 정보가 아직 설정되지 않았어요.
                    <br />
                    .env.local의 NEXT_PUBLIC_SUPABASE_ANON_KEY를 채운 뒤 서버를 재시작해주세요.
                  </p>
                ) : (
                  <>
                    {/* 에러: 프로토타입처럼 자리를 차지한 채 나타난다 (레이아웃 안 밀림) */}
                    <div
                      className={`mb-2.5 flex items-center gap-2 rounded-[10px] border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-500 transition-all duration-250 ${
                        error ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
                      }`}
                      aria-live="polite"
                    >
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{error || " "}</span>
                    </div>

                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={busy}
                      placeholder="이메일"
                      autoComplete="email"
                      className="mb-2.5 w-full rounded-xl border-[1.5px] border-white bg-white px-4 py-[13px] text-[15px] shadow-[0_2px_6px_rgba(92,58,40,0.08)] outline-none transition-colors placeholder:text-ink-weak focus:border-primary disabled:opacity-60"
                    />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={busy}
                      placeholder="비밀번호 (6자 이상)"
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      className="w-full rounded-xl border-[1.5px] border-white bg-white px-4 py-[13px] text-[15px] shadow-[0_2px_6px_rgba(92,58,40,0.08)] outline-none transition-colors placeholder:text-ink-weak focus:border-primary disabled:opacity-60"
                    />

                    {notice && (
                      <p className="mt-2.5 text-[13px] font-medium text-primary">{notice}</p>
                    )}

                    <div className="my-3.5 flex items-center gap-3">
                      <div className="h-px flex-1 bg-[#E7D8CB]" />
                      <span className="text-xs text-ink-weak">또는</span>
                      <div className="h-px flex-1 bg-[#E7D8CB]" />
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogle}
                      disabled={busy}
                      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#E7D8CB] bg-white py-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-gray-50 disabled:opacity-60"
                    >
                      <GoogleLogo />
                      Google로 계속하기
                    </button>

                    <p className="mt-3.5 text-center text-[13px] text-ink-weak">
                      {mode === "signin" ? "아직 계정이 없나요?" : "이미 계정이 있나요?"}{" "}
                      <button
                        type="button"
                        disabled={busy}
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

              {/* 손잡이 모양 제출 버튼 — 누르면 서랍을 닫아본다 */}
              {configured && (
                <button
                  type="submit"
                  disabled={busy}
                  className="mx-auto mt-3.5 flex min-w-[132px] items-center justify-center gap-2 rounded-full bg-primary-weak px-11 py-3 text-[15px] font-semibold text-ink shadow-[0_3px_8px_rgba(0,0,0,0.18)] transition hover:shadow-[0_5px_12px_rgba(0,0,0,0.22)] active:scale-[.97] disabled:opacity-70"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : mode === "signin" ? (
                    "로그인"
                  ) : (
                    "가입하기"
                  )}
                </button>
              )}
            </form>
            <div className="mx-auto mt-4 h-3 w-[92px] rounded-full bg-white/55 shadow-[inset_0_-2px_3px_rgba(0,0,0,0.2)]" />
          </div>
        </div>

        {/* ── 성공 메시지 (서랍이 닫힌 뒤 아래에서 페이드인) ── */}
        <div
          className={`pointer-events-none absolute left-0 right-0 top-full mt-[26px] text-center transition-opacity delay-[250ms] duration-500 ${
            doneShow ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="mb-1.5 flex items-center justify-center gap-2 text-lg font-semibold text-primary">
            <PartyPopper size={20} />
            서랍에 잘 넣어뒀어요
          </div>
          <div className="text-[13px] text-white/90">이제 어디서든 꺼내볼 수 있어요.</div>
        </div>
      </div>
    </div>
  );
}
