"use client";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type WorkHubWindow = Window & {
  __workhubConnectClient?: SupabaseClient;
  __workhubAuthorizedUserId?: string;
};

const WORK_HUB_OWNER_ID = "6b290f26-391a-432f-bec9-a72c3cc8335c";

export default function Home() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://mtpnkedvqenddwciazce.supabase.co";
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "sb_publishable_ShOK8LBfwuVBMMHx5LWyFw_HFuQbavp";

  const supabase = useMemo(
    () => (supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null),
    [supabaseUrl, supabaseAnonKey],
  );

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }

    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const nextUser = data.user?.id === WORK_HUB_OWNER_ID ? data.user : null;
      if (data.user && !nextUser) void supabase.auth.signOut({ scope: "local" });
      setUser(nextUser);
      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextUser = session?.user?.id === WORK_HUB_OWNER_ID ? session.user : null;
      if (session?.user && !nextUser) void supabase.auth.signOut({ scope: "local" });
      setUser(nextUser);
      setReady(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const patchAssets = useCallback(() => {
    if (!supabase || !user?.id) return false;
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body || !doc.head || !doc.defaultView) return false;

    const frameWindow = doc.defaultView as WorkHubWindow;
    frameWindow.__workhubConnectClient = supabase;
    frameWindow.__workhubAuthorizedUserId = user.id;

    if (!doc.getElementById("workhub-large-css")) {
      const link = doc.createElement("link");
      link.id = "workhub-large-css";
      link.rel = "stylesheet";
      link.href = "/work-hub/large.css?v=3";
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
    addScript("workhub-cloud-script", "/work-hub/cloud.js?v=standalone-1");
    addScript("workhub-arcade-nav-script", "/work-hub/arcade-nav.js?v=5");
    addScript("workhub-notes-script", "/work-hub/work-notes.js?v=2");
    addScript("workhub-ledger-script", "/work-hub/work-ledger.js?v=3");
    addScript("workhub-kart-crossing-init", "/work-hub/kart-crossing-init.js?v=1");
    addScript("workhub-kart-crossing-layout", "/work-hub/kart-crossing-layout.js?v=1");
    addScript("workhub-kart-crossing-script", "/work-hub/kart-crossing.js?v=2");
    addScript("workhub-kakao-theme", "/work-hub/kakao-theme.js?v=3");
    return true;
  }, [supabase, user?.id]);

  useEffect(() => {
    if (!user) return;
    document.title = "BokDesk";
    patchAssets();
    const timer = window.setInterval(() => {
      if (patchAssets()) window.clearInterval(timer);
    }, 300);
    const stop = window.setTimeout(() => window.clearInterval(timer), 8000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [patchAssets, user]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSigningIn(true);
    setAuthError("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setAuthError("로그인 정보를 확인해주세요.");
    } else if (data.user?.id !== WORK_HUB_OWNER_ID) {
      await supabase.auth.signOut({ scope: "local" });
      setAuthError("이 계정은 Work Hub에 접근할 수 없습니다.");
    }
    setSigningIn(false);
  }

  if (!ready) {
    return <main className="auth-shell"><div className="auth-card">Work Hub 불러오는 중…</div></main>;
  }

  if (!supabase) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <div className="auth-kicker">BOKDESK · PRIVATE</div>
          <h1>Work Hub 설정 확인 필요</h1>
          <p>독립 배포의 클라우드 연결 환경을 확인해주세요.</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-shell">
        <form className="auth-card" onSubmit={signIn}>
          <div className="auth-kicker">BOKDESK · PRIVATE WORK HUB</div>
          <h1>Work Hub</h1>
          <p>개인 업무 공간에 로그인합니다.</p>
          <label>
            이메일
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            비밀번호
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {authError ? <div className="auth-error">{authError}</div> : null}
          <button type="submit" disabled={signingIn}>{signingIn ? "로그인 중…" : "로그인"}</button>
        </form>
      </main>
    );
  }

  return (
    <iframe
      ref={frameRef}
      onLoad={patchAssets}
      src="/work-hub/index.html?v=32"
      title="BokDesk"
      className="workhub-frame"
    />
  );
}
