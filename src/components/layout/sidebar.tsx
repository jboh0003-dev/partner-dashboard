"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/layout/brand-logo";
import { useOkePanel } from "@/components/search/oke-panel-context";
import { OKE_MENU_LABEL } from "@/lib/search/oke-branding";
import {
  Building2,
  CalendarDays,
  FileText,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  MonitorUp,
  ScrollText,
  Sparkles,
  Upload,
  Users
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "운영 대시보드", icon: LayoutDashboard }]
  },
  {
    title: "Partner",
    items: [
      { href: "/dashboard/partners", label: "파트너사", icon: Building2 },
      { href: "/dashboard/contacts", label: "인력·담당자", icon: Users },
      { href: "/dashboard/documents", label: "문서 관리", icon: FileText },
      { href: "/dashboard/policy", label: "파트너 정책", icon: ScrollText }
    ]
  },
  {
    title: "Operations",
    items: [
      { href: "/dashboard/trainings", label: "교육 현황", icon: GraduationCap },
      { href: "/dashboard/events", label: "행사 현황", icon: CalendarDays },
      { href: "/dashboard/pocs", label: "PoC 현황", icon: FlaskConical },
      { href: "/dashboard/assets", label: "장비·리소스", icon: MonitorUp }
    ]
  },
  {
    title: "AI",
    items: [{ href: "__oke__", label: OKE_MENU_LABEL, icon: Sparkles }]
  },
  {
    title: "Admin",
    items: [{ href: "/dashboard/upload", label: "데이터 업로드", icon: Upload }]
  }
];

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isOkeNavActive(pathname: string): boolean {
  return pathname === "/dashboard/chat" || pathname.startsWith("/dashboard/chat/");
}

function navItemClass(isActive: boolean): string {
  return [
    "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
    isActive
      ? "bg-okestro-50 font-semibold text-okestro-800 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r before:bg-okestro-600"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
  ].join(" ");
}

function navIconClass(isActive: boolean): string {
  return isActive ? "text-okestro-600" : "text-slate-400 group-hover:text-slate-500";
}

export function Sidebar() {
  const pathname = usePathname();
  const { openPanel, open } = useOkePanel();
  const okeActive = open || isOkeNavActive(pathname);

  return (
    <aside className="fixed left-0 top-0 z-10 flex h-screen w-64 flex-col border-r border-slate-200/90 bg-white">
      <div className="border-b border-slate-100 px-5 py-5">
        <Link href="/dashboard" className="inline-flex">
          <BrandLogo className="h-8 w-auto object-contain" priority />
        </Link>
        <p className="mt-2.5 text-2xs font-medium uppercase tracking-wider text-slate-400">
          Enterprise Partner Portal
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-5 last:mb-0">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isOke = item.href === "__oke__";
                const isActive = isOke ? okeActive : isNavActive(pathname, item.href);

                if (isOke) {
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => openPanel({ fullscreen: okeActive })}
                      className={["group w-full", navItemClass(isActive)].join(" ")}
                    >
                      <Icon
                        size={17}
                        strokeWidth={isActive ? 2.25 : 2}
                        className={navIconClass(isActive)}
                      />
                      {item.label}
                    </button>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={["group", navItemClass(isActive)].join(" ")}
                  >
                    <Icon
                      size={17}
                      strokeWidth={isActive ? 2.25 : 2}
                      className={navIconClass(isActive)}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 px-5 py-4">
        <p className="text-2xs text-slate-400">OKESTRO Partner Portal</p>
      </div>
    </aside>
  );
}
