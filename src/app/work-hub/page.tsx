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
      link.href = "/work-hub/large.css?v=1";
      doc.head.appendChild(link);
    }

    if (!doc.getElementById("workhub-favorites-script")) {
      const script = doc.createElement("script");
      script.id = "workhub-favorites-script";
      script.src = "/work-hub/favorites.js?v=3";
      doc.body.appendChild(script);
    }

    return true;
  };

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
  }, []);

  return (
    <iframe
      ref={frameRef}
      onLoad={patchAssets}
      src="/work-hub/index.html"
      title="Work Hub"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: 0,
        zIndex: 9999,
        background: "#f2f5fa",
      }}
    />
  );
}
