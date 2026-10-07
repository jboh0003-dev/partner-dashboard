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

    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error(error);
      setUser(data.user ?? null);
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

    if (!doc.getElementById("workhub-large-css")) {
      const link = doc.createElement("link");
      link.id = "workhub-large-css";
      link.rel = "stylesheet";
      link.href = "/work-hub/large.css?v=4";
      doc.head.appendChild(link);
    }

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
    addScript("workhub-calendar-script", "/work-hub/calendar.js?v=7");
    addScript("workhub-create-script", "/work-hub/create.js?v=3");
    addScript("workhub-cloud-script", "/work-hub/cloud.js?v=social-5");
    addScript("workhub-arcade-nav-script", "/work-hub/arcade-nav.js?v=5");
    addScript("workhub-notes-script", "/work-hub/work-notes.js?v=3");
    addScript("workhub-ledger-script", "/work-hub/work-ledger.js?v=3");
    addScript("workhub-kart-crossing-init", "/work-hub/kart-crossing-init.js?v=1");
    addScript("workhub-kart-crossing-layout", "/work-hub/kart-crossing-layout.js?v=1");
    addScript("workhub-kart-crossing-script", "/work-hub/kart-crossing.js?v=3");
    addScript("workhub-kakao-theme", "/work-hub/kakao-theme.js?v=3");
    return true;
  }, [supabase, user?.id]);

  useEffect(() => {
    if (!user) return;

    document.title = "BokDesk";
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
        setAuthInfo("계정을 만들었습니다. BokDesk를 불러오는 중입니다.");
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

  function switchMode(mode: AuthMode) {
    if (submitting) return;
    setAuthMode(mode);
    setAuthError("");
    setAuthInfo("");
  }

  if (!ready) {
    return (
      <main className="auth-shell">
        <div className="auth-card auth-loading">BokDesk 불러오는 중…</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <form className="auth-card" onSubmit={submitAuth}>
          <div className="auth-kicker">BOKDESK · PERSONAL MINI HOME</div>
          <h1>BokDesk</h1>
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

          {authError ? <div className="auth-error" role="alert">{authError}</div> : null}
          {authInfo ? <div className="auth-info" role="status">{authInfo}</div> : null}

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting
              ? authMode === "login" ? "로그인 중…" : "계정 만드는 중…"
              : authMode === "login" ? "내 BokDesk 들어가기" : "BokDesk 계정 만들기"}
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
      src={`/work-hub/index.html?v=35&uid=${encodeURIComponent(user.id)}`}
      title="BokDesk"
      className="workhub-frame"
    />
  );
}
