"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";

type Workspace = { id: string; count: number };
type Backup = { ownerId?: string; state?: any; work?: any; [key: string]: any };
type LocalBridge = {
  accountId: string;
  exportData(): Backup;
  importData(data: Backup): { tasks: number; preservedCopy: string };
  summary(): { accountId: string; tasks: number; notes: number };
};
type LocalWindow = Window & { WorkHubLocalRecovery?: LocalBridge };
const LEGACY_OWNER = "6b290f26-391a-432f-bec9-a72c3cc8335c";
const SELECTION_KEY = "workhub_offline_selected_uid";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validId(id: unknown): id is string { return typeof id === "string" && (UUID.test(id) || id === "guest" || id === "local"); }
function readJson(store: Storage, key: string): any { try { return JSON.parse(store.getItem(key) || "null"); } catch { return null; } }

// Local selection only; cached identities never authorize remote data access.
function discoverWorkspaces(store: Storage): { options: Workspace[]; selected: string | null } {
  const found = new Map<string, number>();
  let cachedUser = "";
  function consider(id: string, value: any) {
    if (!validId(id)) return;
    const work = value?.work || value;
    if (!work || !Array.isArray(work.workItems)) return;
    const meaningful = work.workItems.length || work.history?.length || work.plans?.length || Object.keys(work.settings || {}).length;
    if (meaningful) found.set(id, Math.max(found.get(id) || 0, work.workItems.length));
  }
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i) || "";
    if (/^sb-.*-auth-token$/.test(key)) {
      const session = readJson(store, key);
      const id = session?.user?.id || session?.currentSession?.user?.id;
      if (validId(id)) cachedUser = id;
    }
    if (key.startsWith("dayflow_v4_state_")) consider(key.slice("dayflow_v4_state_".length), readJson(store, key));
    if (key.startsWith("workhub_offline_current_")) consider(key.slice("workhub_offline_current_".length), readJson(store, key));
    const snapshot = key.match(/^workhub_snapshot_([0-9a-f-]{36})_/i);
    if (snapshot) consider(snapshot[1], readJson(store, key));
  }
  for (const key of ["dayflow_v4_state", "dayflow_v3_state", "dayflow_v2_state", "dayflow_v1_state", "dayflow_state", "workhub_state", "workhub_v1_state"]) {
    consider(LEGACY_OWNER, readJson(store, key));
  }
  const options = Array.from(found, ([id, count]) => ({ id, count }));
  const previous = store.getItem(SELECTION_KEY);
  if (previous && found.has(previous)) return { options, selected: previous };
  if (cachedUser && found.has(cachedUser)) return { options, selected: cachedUser };
  if (options.length === 1) return { options, selected: options[0].id };
  // Never open an empty guest namespace when account work is already present.
  const personal = options.filter(x => UUID.test(x.id));
  if (personal.length === 1) return { options, selected: personal[0].id };
  return { options, selected: null };
}

export default function Home() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingImport = useRef<Backup | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    try {
      const result = discoverWorkspaces(window.localStorage);
      setWorkspaces(result.options);
      setSelected(result.selected);
    } catch { setStorageError("브라우저 저장공간에 접근할 수 없습니다. 사이트 데이터를 지우지 마세요."); }
    setReady(true);
  }, []);

  const patchAssets = useCallback(() => {
    if (!selected) return false;
    const doc = frameRef.current?.contentDocument;
    const view = doc?.defaultView as LocalWindow | null | undefined;
    if (!doc?.body || !doc.head || !view || !doc.querySelector(".headtools")) return false;
    if (new URLSearchParams(view.location.search).get("uid") !== selected) return false;
    const addScript = (id: string, src: string) => {
      if (doc.getElementById(id)) return;
      const script = doc.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      doc.body.appendChild(script);
    };
    addScript("workhub-local-recovery", "/work-hub/local-recovery.js?v=1");
    addScript("workhub-atlas-retired-guard", "/work-hub/work-atlas.js?v=99");
    addScript("workhub-favorites-script", "/work-hub/favorites.js?v=4");
    addScript("workhub-workflow-script", "/work-hub/workflow.js?v=3");
    addScript("workhub-calendar-script", "/work-hub/calendar.js?v=8");
    addScript("workhub-create-script", "/work-hub/create.js?v=3");
    addScript("workhub-arcade-nav-script", "/work-hub/arcade-nav.js?v=7");
    addScript("workhub-notes-script", "/work-hub/work-notes.js?v=4");
    addScript("workhub-ledger-script", "/work-hub/work-ledger.js?v=10");
    addScript("workhub-kart-crossing-init", "/work-hub/kart-crossing-init.js?v=1");
    addScript("workhub-kart-crossing-layout", "/work-hub/kart-crossing-layout.js?v=1");
    addScript("workhub-kart-crossing-script", "/work-hub/kart-crossing.js?v=4");
    addScript("workhub-okestro-theme", "/work-hub/okestro-theme.js?v=10");
    const bridge = view.WorkHubLocalRecovery;
    if (!bridge || bridge.accountId !== selected) return false;
    if (pendingImport.current) {
      const backup = pendingImport.current;
      pendingImport.current = null;
      try {
        const result = bridge.importData(backup);
        window.alert(`업무 ${result.tasks}건을 불러왔습니다. 기존 로컬 내용은 별도 보존했습니다.`);
      } catch (error) { window.alert(error instanceof Error ? error.message : "Import failed."); }
    }
    const toolbar = doc.querySelector(".headtools");
    if (toolbar && !doc.getElementById("google-local-mode")) {
      const group = doc.createElement("div");
      group.id = "google-local-mode";
      group.style.cssText = "display:flex;gap:5px;align-items:center;flex-wrap:wrap";
      const makeButton = (text: string, handler: () => void) => {
        const button = doc.createElement("button");
        button.type = "button";
        button.className = "btn";
        button.textContent = text;
        button.style.cssText = "font-size:11px;padding:8px 10px";
        button.onclick = handler;
        group.appendChild(button);
      };
      const label = doc.createElement("span");
      label.textContent = "이 브라우저에 저장";
      label.style.cssText = "font-size:11px;color:#526781;padding:6px";
      group.appendChild(label);
      makeButton("백업 저장", () => {
        try {
          const data = bridge.exportData();
          const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
          const link = doc.createElement("a");
          link.href = url;
          link.download = "WorkHub_backup_" + new Date().toISOString().slice(0, 10) + ".json";
          doc.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 2000);
        } catch { window.alert("백업 저장에 실패했습니다."); }
      });
      makeButton("복구파일 가져오기", () => fileRef.current?.click());
      makeButton("저장공간 선택", () => {
        try { setWorkspaces(discoverWorkspaces(window.localStorage).options); } catch {}
        setSelected(null);
      });
      toolbar.insertBefore(group, toolbar.firstChild);
    }
    return true;
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    document.title = "Google";
    try { window.localStorage.setItem(SELECTION_KEY, selected); } catch {}
    patchAssets();
    const timer = window.setInterval(() => { if (patchAssets()) window.clearInterval(timer); }, 250);
    const stop = window.setTimeout(() => window.clearInterval(timer), 15000);
    return () => { window.clearInterval(timer); window.clearTimeout(stop); };
  }, [selected, patchAssets]);

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error("Backup exceeds 25 MB.");
      const backup = JSON.parse(await file.text()) as Backup;
      const payload = backup.state || backup;
      const work = payload.work || payload;
      if (!Array.isArray(work.workItems) || !work.workItems.every((x: any) => typeof x?.id === "string" && typeof x?.title === "string")) throw new Error("올바른 Work Hub 복구 파일이 아닙니다.");
      const ownerId = validId(backup.ownerId) ? backup.ownerId : selected || "local";
      if (!window.confirm(`복구파일의 업무 ${work.workItems.length}건과 메모·설정을 불러오시겠습니까? 기존 로컬 내용은 보존용 사본으로 남깁니다.`)) return;
      pendingImport.current = { ...backup, ownerId };
      if (selected === ownerId) patchAssets();
      else setSelected(ownerId);
    } catch (error) { window.alert(error instanceof Error ? error.message : "Import failed."); }
  }

  return <>
    <input ref={fileRef} type="file" accept=".json,application/json" onChange={importFile} hidden />
    {selected ? <iframe key={selected} ref={frameRef} onLoad={patchAssets} src={`/work-hub/index.html?v=55-local-recovery&uid=${encodeURIComponent(selected)}`} title="Google" className="workhub-frame" /> : <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-kicker">WORK HUB</div>
        <h1>저장된 업무 열기</h1>
        {!ready ? <p>이 브라우저의 저장내용을 확인하고 있습니다.</p> : <>
          <p>로그인 없이 기존 브라우저 저장본을 엽니다. 클라우드 동기화는 중지된 상태입니다.</p>
          {storageError && <p role="alert">{storageError}</p>}
          {workspaces.map((item, index) => <button key={item.id} type="button" className="auth-submit" style={{ marginBottom: 8 }} onClick={() => setSelected(item.id)}>{item.id === "guest" ? "임시 작업" : `기존 저장공간 ${index + 1}`} {`· 업무 ${item.count}건`}</button>)}
          {!workspaces.length && <div className="auth-note">이 주소의 브라우저 저장본을 찾지 못했습니다. 서버 자료 삭제를 뜻하지 않습니다. 복구파일을 가져오면 기존 내용을 불러옵니다.</div>}
          <button type="button" className="auth-submit" onClick={() => fileRef.current?.click()}>복구파일 가져오기</button>
          <button type="button" className="auth-link" onClick={() => setSelected("local")}>새 로컬 작업공간</button>
        </>}
      </section>
    </main>}
  </>;
}
