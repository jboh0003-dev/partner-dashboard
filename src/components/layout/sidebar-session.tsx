"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";

type SessionUser = {
  id?: string | null;
  email: string | null;
  name: string | null;
  roleLabel: string | null;
  isAdmin: boolean;
};

export function SidebarSession() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetch("/api/account/me", {
      credentials: "include",
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      },
      signal: controller.signal
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!active) return;
        if (payload?.ok && payload.user) {
          setUser(payload.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return (
    <Sidebar
      userId={user?.id ?? null}
      userEmail={user?.email ?? null}
      userName={user?.name ?? null}
      roleLabel={user?.roleLabel ?? null}
      isAdmin={user?.isAdmin ?? false}
    />
  );
}
