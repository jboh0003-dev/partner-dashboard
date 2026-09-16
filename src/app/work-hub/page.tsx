"use client";

import { useEffect } from "react";

export default function WorkHubPage() {
  useEffect(() => {
    document.title = "Work Hub";
  }, []);

  return (
    <iframe
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
