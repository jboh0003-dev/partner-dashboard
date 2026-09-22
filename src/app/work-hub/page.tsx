"use client";

import { useEffect, useRef } from "react";

export default function WorkHubPage() {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const patchAssets = () => {
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

    const runner = doc.getElementById("workhub-runner");
    const runnerIsCurrent = runner?.dataset.version === "2";

    if (!runnerIsCurrent && !doc.getElementById("workhub-runner-script-v2")) {
      runner?.remove();
      doc.getElementById("workhub-runner-script")?.remove();
      doc
        .querySelectorAll<HTMLScriptElement>('script[src*="/work-hub/runner-engine.js"]')
        .forEach((engineScript) => {
          engineScript.onload = null;
          engineScript.remove();
        });
      addScript("workhub-runner-script-v2", "/work-hub/runner.js?v=2");
    }

    addScript("workhub-favorites-script", "/work-hub/favorites.js?v=4");
    addScript("workhub-workflow-script", "/work-hub/workflow.js?v=2");
    addScript("workhub-calendar-script", "/work-hub/calendar.js?v=5");
    addScript("workhub-create-script", "/work-hub/create.js?v=2");
    addScript("supabase-js", "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js");
    addScript("workhub-cloud-script", "/work-hub/cloud.js?v=2");

    return doc.getElementById("workhub-runner")?.dataset.version === "2";
  };

  useEffect(() => {
    document.title = "워크허브";
    patchAssets();
    const timer = window.setInterval(() => {
      if (patchAssets()) window.clearInterval(timer);
    }, 400);
    const stop = window.setTimeout(() => window.clearInterval(timer), 8000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, []);

  return (
    <iframe
      ref={frameRef}
      onLoad={patchAssets}
      src="/work-hub/index.html?v=9"
      title="워크허브"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: 0,
        zIndex: 9999,
        background: "#f2eee5",
      }}
    />
  );
}
