"use client";

import { useCallback, useEffect, useRef } from "react";

export default function Home() {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const patchAssets = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body || !doc.head) return false;

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
    addScript("workhub-cloud-personal", "/work-hub/cloud-personal.js?v=1");
    addScript("workhub-arcade-nav-script", "/work-hub/arcade-nav.js?v=5");
    addScript("workhub-notes-script", "/work-hub/work-notes.js?v=2");
    addScript("workhub-ledger-script", "/work-hub/work-ledger.js?v=3");
    addScript("workhub-kart-crossing-init", "/work-hub/kart-crossing-init.js?v=1");
    addScript("workhub-kart-crossing-layout", "/work-hub/kart-crossing-layout.js?v=1");
    addScript("workhub-kart-crossing-script", "/work-hub/kart-crossing.js?v=2");
    addScript("workhub-kakao-theme", "/work-hub/kakao-theme.js?v=3");
    return true;
  }, []);

  useEffect(() => {
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
  }, [patchAssets]);

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
