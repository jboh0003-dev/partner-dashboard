"use client";

import { useCallback, useEffect, useRef } from "react";

// Temporary local-only operation while Supabase Auth/Storage is restricted.
// Data remains in the current browser; no cross-account or friend data is loaded.
export default function Home() {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const patchAssets = useCallback(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    const view = doc?.defaultView;
    if (!doc?.body || !doc.head || !view) return false;

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
    // Do not load cloud.js: it redirects to Supabase login on HTTP 402.
    addScript("workhub-arcade-nav-script", "/work-hub/arcade-nav.js?v=7");
    addScript("workhub-notes-script", "/work-hub/work-notes.js?v=4");
    addScript("workhub-ledger-script", "/work-hub/work-ledger.js?v=10");
    addScript("workhub-kart-crossing-init", "/work-hub/kart-crossing-init.js?v=1");
    addScript("workhub-kart-crossing-layout", "/work-hub/kart-crossing-layout.js?v=1");
    addScript("workhub-kart-crossing-script", "/work-hub/kart-crossing.js?v=4");
    addScript("workhub-okestro-theme", "/work-hub/okestro-theme.js?v=10");

    const toolbar = doc.querySelector(".headtools");
    if (toolbar && !doc.getElementById("google-local-mode")) {
      const group = doc.createElement("div");
      group.id = "google-local-mode";
      group.style.cssText = "display:flex;gap:5px;align-items:center;flex-wrap:wrap";
      const label = doc.createElement("span");
      label.textContent = "임시 로컬 모드";
      label.title = "Supabase 사용량 제한 중입니다. 이 브라우저에만 저장되며 친구 보기와 동기화는 중지됩니다.";
      label.style.cssText = "border:1px solid #c8d6e8;padding:8px 10px;border-radius:8px;font-size:11px;font-weight:800;color:#4b6384;background:#edf3fc";
      group.appendChild(label);

      const makeButton = (title: string) => {
        const button = doc.createElement("button");
        button.type = "button";
        button.className = "btn";
        button.textContent = title;
        button.style.cssText = "font-size:11px;padding:8px 10px";
        group.appendChild(button);
        return button;
      };

      makeButton("백업 저장").onclick = () => {
        try {
          const store = view.localStorage;
          const work = JSON.parse(store.getItem("dayflow_v4_state") || "{}");
          if (!Array.isArray(work.workItems)) {
            view.alert("이 브라우저에서 저장된 업무를 찾지 못했습니다.");
            return;
          }
          const partner = JSON.parse(store.getItem("workhub_partner_v2") || "{}");
          const file = new Blob([JSON.stringify({ version: 1, work, partner, savedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(file);
          const anchor = doc.createElement("a");
          anchor.href = url;
          anchor.download = "Google_업무백업_" + new Date().toISOString().slice(0, 10) + ".json";
          doc.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          view.setTimeout(() => URL.revokeObjectURL(url), 2000);
        } catch {
          view.alert("백업 파일을 저장하지 못했습니다.");
        }
      };

      const fileInput = doc.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".json,application/json";
      fileInput.style.display = "none";
      fileInput.onchange = async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        try {
          const parsed = JSON.parse(await file.text());
          const payload = parsed.state || parsed;
          const work = payload.work || payload;
          if (!Array.isArray(work.workItems)) throw new Error("invalid backup");
          const count = work.workItems.length;
          if (!view.confirm(`백업의 업무 ${count}건을 가져오시겠습니까? 현재 브라우저에 있는 업무는 복구용 사본으로 보존합니다.`)) return;
          const store = view.localStorage;
          const existing = store.getItem("dayflow_v4_state");
          if (existing) {
            store.setItem("workhub_snapshot_before_import_" + new Date().toISOString().replace(/[:.]/g, "-"), existing);
          }
          store.setItem("dayflow_v4_state", JSON.stringify(work));
          if (payload.partner && typeof payload.partner === "object") {
            store.setItem("workhub_partner_v2", JSON.stringify(payload.partner));
          }
          view.location.reload();
        } catch {
          view.alert("올바른 Google 업무 백업(JSON) 파일을 선택해주세요.");
        }
      };
      group.appendChild(fileInput);
      makeButton("백업 가져오기").onclick = () => fileInput.click();
      toolbar.insertBefore(group, toolbar.firstChild);
    }
    return true;
  }, []);

  useEffect(() => {
    document.title = "Google";
    patchAssets();
    const timer = window.setInterval(() => {
      if (patchAssets()) window.clearInterval(timer);
    }, 300);
    const stop = window.setTimeout(() => window.clearInterval(timer), 8000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [patchAssets]);

  return (
    <iframe
      ref={frameRef}
      onLoad={patchAssets}
      src="/work-hub/index.html?v=54-local"
      title="Google"
      className="workhub-frame"
    />
  );
}
