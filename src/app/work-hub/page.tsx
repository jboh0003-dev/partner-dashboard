"use client";

import { useEffect, useRef } from "react";

export default function WorkHubPage() {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const patchFavorites = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body || doc.getElementById("workhub-favorites-script")) return false;
    const script = doc.createElement("script");
    script.id = "workhub-favorites-script";
    script.src = "/work-hub/favorites.js?v=3";
    doc.body.appendChild(script);
    return true;
  };

  useEffect(() => {
    document.title = "Work Hub";
    patchFavorites();
    const timer = window.setInterval(() => {
      if (patchFavorites()) window.clearInterval(timer);
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
      onLoad={patchFavorites}
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
