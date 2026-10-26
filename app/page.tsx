"use client";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type WorkHubWindow = Window & {
  __workhubConnectClient?: SupabaseClient;
  __workhubAuthorizedUserId?: string;
};

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://mtpnkedvqenddwciazce.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_ShOK8LBfwuVBMMHx5LWyFw_HFuQbavp";

type AuthMode = "login" | "signup";

export default function Home() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authInfo, setAuthInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recoveryActive, setRecoveryActive] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const supabase = useMemo(
    () =>
      createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }),
    [],
  );

  useEffect(() => {
    let active = true;

    const urlLooksLikeRecovery =
      typeof window !== "undefined" &&
      (window.location.hash.includes("type=recovery") ||
        window.location.search.includes("type=recovery"));

    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error(error);
      setUser(data.user ?? null);
      if (urlLooksLikeRecovery) setRecoveryActive(true);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const patchAssets = useCallback(() => {
    if (!user?.id) return false;

    const doc = frameRef.current?.contentDocument;
    if (!doc?.body || !doc.head || !doc.defaultView) return false;

    const frameWindow = doc.defaultView as WorkHubWindow;
    frameWindow.__workhubConnectClient = supabase;
    frameWindow.__workhubAuthorizedUserId = user.id;


    const addScript = (id: string, src: string) => {
      if (doc.getElementById(id)) return;
      const script = doc.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      doc.body.appendChild(script);
    };

    addScript("workhub-atlas-retired-guard", "/work-hub/work-atlas.js?v=99");
    addScript("workhub-favorites-script", "/work-hub/favorites.js?v=4");
    addScript("workhub-workflow-script", "/work-hub/workflow.js?v=3");
    addScript("workhub-calendar-script", "/work-hub/calendar.js?v=8");
    addScript("workhub-create-script", "/work-hub/create.js?v=3");
    addScript("workhub-cloud-script", "/work-hub/cloud.js?v=social-11");
    addScript("workhub-arcade-nav-script", "/work-hub/arcade-nav.js?v=7");
    addScript("workhub-notes-script", "/work-hub/work-notes.js?v=4");
    addScript("workhub-ledger-script", "/work-hub/work-ledger.js?v=10");
    addScript("workhub-kart-crossing-init", "/work-hub/kart-crossing-init.js?v=1");
    addScript("workhub-kart-crossing-layout", "/work-hub/kart-crossing-layout.js?v=1");
    addScript("workhub-kart-crossing-script", "/work-hub/kart-crossing.js?v=4");
    addScript("workhub-okestro-theme", "/work-hub/okestro-theme.js?v=10");
    return true;
  }, [supabase, user?.id]);

  useEffect(() => {
    if (!user) return;

    document.title = "Google";
    patchAssets();

    const timer = window.setInterval(() => {
      if (patchAssets()) window.clearInterval(timer);
    }, 250);
    const stop = window.setTimeout(() => window.clearInterval(timer), 8000);

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [patchAssets, user]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const trimmedEmail = email.trim();
    const trimmedName = displayName.trim();

    setSubmitting(true);
    setAuthError("");
    setAuthInfo("");

    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;
        return;
      }

      if (!trimmedName) {
        setAuthError("사용할 이름을 입력해주세요.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { workhub_display_name: trimmedName.slice(0, 30) },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;

      if (data.session) {
        setAuthInfo("계정을 만들었습니다. Google를 불러오는 중입니다.");
      } else {
        setAuthInfo("가입 확인 메일을 보냈습니다. 메일 인증 후 로그인해주세요.");
        setAuthMode("login");
      }
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "";
      if (/invalid login credentials/i.test(message)) {
        setAuthError("이메일 또는 비밀번호를 확인해주세요.");
      } else if (/already registered|already been registered|user already exists/i.test(message)) {
        setAuthError("이미 가입된 이메일입니다. 로그인해주세요.");
      } else if (/password/i.test(message) && /characters|weak|short/i.test(message)) {
        setAuthError("비밀번호 조건을 확인해주세요.");
      } else {
        setAuthError(authMode === "login" ? "로그인에 실패했습니다." : "회원가입에 실패했습니다.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function requestPasswordReset() {
    if (submitting) return;
    const trimmedEmail = email.trim();
    setAuthError("");
    setAuthInfo("");

    if (!trimmedEmail) {
      setAuthError("비밀번호를 재설정할 이메일을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setAuthInfo("비밀번호 재설정 메일을 보냈습니다. 메일의 링크를 눌러 새 비밀번호를 설정해주세요.");
    } catch (error) {
      console.error(error);
      setAuthError("비밀번호 재설정 메일 전송에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setAuthError("");
    setAuthInfo("");

    if (newPassword.length < 6) {
      setAuthError("새 비밀번호는 6자 이상으로 입력해주세요.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setAuthError("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setAuthInfo("비밀번호를 변경했습니다. 잠시 후 Google로 들어갑니다.");
      setNewPassword("");
      setNewPasswordConfirm("");
      window.history.replaceState({}, "", window.location.pathname);
      window.setTimeout(() => setRecoveryActive(false), 500);
    } catch (error) {
      console.error(error);
      setAuthError("비밀번호 변경에 실패했습니다. 재설정 메일을 다시 받아주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(mode: AuthMode) {
    if (submitting) return;
    setAuthMode(mode);
    setAuthError("");
    setAuthInfo("");
  }

  if (!ready) {
    return (
      <main className="auth-shell">
        <div className="auth-card auth-loading">Google 불러오는 중…</div>
      </main>
    );
  }

  if (recoveryActive && user) {
    return (
      <main className="auth-shell">
        <form className="auth-card" onSubmit={submitNewPassword}>
          <div className="auth-kicker">GOOGLE · PASSWORD RESET</div>
          <h1>새 비밀번호 설정</h1>
          <p>새로 사용할 비밀번호를 입력해주세요.</p>

          <label>
            새 비밀번호
            <input
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </label>

          <label>
            새 비밀번호 확인
            <input
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              required
            />
          </label>

          {authError ? <div className="auth-error" role="alert">{authError}</div> : null}
          {authInfo ? <div className="auth-info" role="status">{authInfo}</div> : null}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "변경 중…" : "새 비밀번호 저장"}
          </button>
        </form>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <form className="auth-card" onSubmit={submitAuth}>
          <div className="auth-kicker">GOOGLE · PERSONAL MINI HOME</div>
          <h1>Google</h1>
          <p>내 일·메모·게임은 따로 저장하고, 허용한 친구끼리 서로 구경할 수 있습니다.</p>

          <div className="auth-tabs" role="tablist" aria-label="계정 메뉴">
            <button
              type="button"
              className={authMode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
              role="tab"
              aria-selected={authMode === "login"}
            >
              로그인
            </button>
            <button
              type="button"
              className={authMode === "signup" ? "active" : ""}
              onClick={() => switchMode("signup")}
              role="tab"
              aria-selected={authMode === "signup"}
            >
              새 계정
            </button>
          </div>

          {authMode === "signup" ? (
            <label>
              이름
              <input
                type="text"
                autoComplete="nickname"
                maxLength={30}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="친구에게 보일 이름"
                required
              />
            </label>
          ) : null}

          <label>
            이메일
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
          </label>

          <label>
            비밀번호
            <input
              type="password"
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {authMode === "login" ? (
            <button
              type="button"
              className="auth-link"
              onClick={requestPasswordReset}
              disabled={submitting}
            >
              비밀번호 재설정
            </button>
          ) : null}

          {authError ? <div className="auth-error" role="alert">{authError}</div> : null}
          {authInfo ? <div className="auth-info" role="status">{authInfo}</div> : null}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting
              ? authMode === "login" ? "로그인 중…" : "계정 만드는 중…"
              : authMode === "login" ? "내 Google 들어가기" : "Google 계정 만들기"}
          </button>

          <div className="auth-note">
            친구가 되더라도 상대방은 허용된 <b>일 · 메모 · 게임 진행도</b>만 읽을 수 있고,
            수정이나 플레이는 할 수 없습니다.
          </div>
        </form>
      </main>
    );
  }

  return (
    <iframe
      key={user.id}
      ref={frameRef}
      onLoad={patchAssets}
      src={`/work-hub/index.html?v=53&uid=${encodeURIComponent(user.id)}`}
      title="Google"
      className="workhub-frame"
    />
  );
}
