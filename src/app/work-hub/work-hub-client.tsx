"use client";

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export default function WorkHubClient({ ownerId }: { ownerId: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const patchAssets = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body || !doc.head || !doc.defaultView) return false;
    // Share Connect's cookie-backed client. No second login or localStorage token.
    const frameWindow = doc.defaultView as Window & {
      __workhubConnectClient?: ReturnType<typeof createClient>;
      __workhubAuthorizedUserId?: string;
    };
    frameWindow.__workhubConnectClient = createClient();
    frameWindow.__workhubAuthorizedUserId = ownerId;

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
    addScript("workhub-cloud-script", "/work-hub/cloud.js?v=4");
    addScript("workhub-arcade-nav-script", "/work-hub/arcade-nav.js?v=4");
    addScript("workhub-notes-script", "/work-hub/work-notes.js?v=2");
    addScript("workhub-ledger-script", "/work-hub/work-ledger.js?v=3");
    addScript("workhub-kart-crossing-init", "/work-hub/kart-crossing-init.js?v=1");
    addScript("workhub-kart-crossing-layout", "/work-hub/kart-crossing-layout.js?v=1");
    addScript("workhub-kart-crossing-script", "/work-hub/kart-crossing.js?v=2");
    addScript("workhub-kakao-theme", "/work-hub/kakao-theme.js?v=2");


    return true;
  }, [ownerId]);

  useEffect(() => {
    document.title = "Work Hub";
    patchAssets();
    const timer = window.setInterval(() => {
      if (patchAssets()) window.clearInterval(timer);
    }, 400);
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
      src="/work-hub/index.html?v=21"
      title="Work Hub"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: 0,
        zIndex: 9999,
        background: "#f7f7f7",
      }}
    />
  );
}
