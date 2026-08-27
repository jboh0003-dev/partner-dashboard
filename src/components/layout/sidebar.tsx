"use client";

import { BrandLogo } from "@/components/layout/brand-logo";
import { GlobalPartnerSearch } from "@/components/layout/global-partner-search";
import { SidebarUserFooter } from "@/components/layout/sidebar-user-footer";
import { useOkePanel } from "@/components/search/oke-panel-context";
import { OKE_MENU_LABEL } from "@/lib/search/oke-branding";
import {
  ArrowUpCircle,
  Building2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  MonitorUp,
  Settings,
  Sparkles,
  TrendingUp,
  Upload,
  UserPlus,
  Users
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { isAdminOnlySidebarHref } from "@/lib/auth/roles";

type NavLeaf = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

type NavAccordion = {
  type: "accordion";
  id: string;
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  children: NavLeaf[];
};

type NavEntry = NavLeaf | NavAccordion;

type NavGroup = {
  title: string;
  items: NavEntry[];
};

const PARTNER_ACCORDION_ID = "partner";

const PARTNER_CHILD_PREFIXES = [
  "/dashboard/contacts",
  "/dashboard/documents",
  "/dashboard/platinum-upgrade",
  "/dashboard/performance",
  "/partner-apply",
  "/dashboard/partner-applications"
] as const;

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "운영 대시보드", icon: LayoutDashboard }]
  },
  {
    title: "Partner",
    items: [
      {
        type: "accordion",
        id: PARTNER_ACCORDION_ID,
        href: "/dashboard/partners",
        label: "파트너",
        icon: Building2,
        children: [
          { href: "/dashboard/contacts", label: "인력·담당자", icon: Users },
          { href: "/dashboard/documents", label: "파트너 문서", icon: FileText },
          { href: "/dashboard/platinum-upgrade", label: "플래티넘 승급", icon: ArrowUpCircle },
          { href: "/dashboard/performance", label: "실적/파이프라인", icon: TrendingUp },
          { href: "/partner-apply", label: "신규 파트너 신청", icon: UserPlus },
          { href: "/dashboard/partner-applications", label: "파트너 신청 관리", icon: ClipboardCheck }
        ]
      }
    ]
  },
  {
    title: "Operations",
    items: [
      { href: "/dashboard/trainings", label: "교육 현황", icon: GraduationCap },
      { href: "/dashboard/assets", label: "장비·리소스", icon: MonitorUp }
    ]
  },
  {
    title: "AI",
    items: [{ href: "__oke__", label: OKE_MENU_LABEL, icon: Sparkles }]
  },
  {
    title: "Admin",
    items: [
      { href: "/dashboard/upload-hub", label: "데이터 업로드", icon: Upload },
      { href: "/dashboard/settings/users", label: "계정 관리", icon: Settings }
    ]
  }
];

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isPartnerSectionPath(pathname: string): boolean {
  return PARTNER_CHILD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isOkeNavActive(pathname: string): boolean {
  return pathname === "/dashboard/chat" || pathname.startsWith("/dashboard/chat/");
}

function isAccordion(entry: NavEntry): entry is NavAccordion {
  return "type" in entry && entry.type === "accordion";
}

function navItemClass(isActive: boolean): string {
  return [
    "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
    isActive
      ? "bg-okestro-50 font-semibold text-okestro-800 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r before:bg-okestro-600"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
  ].join(" ");
}

function navChildClass(isActive: boolean): string {
  return [
    "relative flex items-center gap-2.5 rounded-lg py-2 pl-10 pr-3 text-sm font-medium transition",
    isActive
      ? "bg-okestro-50 font-semibold text-okestro-800 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r before:bg-okestro-600"
      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
  ].join(" ");
}

function navIconClass(isActive: boolean): string {
  return isActive ? "text-okestro-600" : "text-slate-400 group-hover:text-slate-500";
}

function PartnerAccordion({ item, pathname }: { item: NavAccordion; pathname: string }) {
  const listActive = isNavActive(pathname, item.href);
  const childSectionActive = isPartnerSectionPath(pathname);
  const shouldStayOpen = listActive || childSectionActive;
  const [open, setOpen] = useState(shouldStayOpen);

  useEffect(() => {
    if (shouldStayOpen) setOpen(true);
  }, [shouldStayOpen, pathname]);

  const Icon = item.icon;
  const parentToneActive = listActive || childSectionActive;

  return (
    <div>
      <div className="flex items-center gap-0.5">
        <Link
          href={item.href}
          className={[
            "group min-w-0 flex-1",
            listActive
              ? navItemClass(true)
              : [
                  "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  childSectionActive
                    ? "text-okestro-800"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                ].join(" ")
          ].join(" ")}
        >
          <Icon size={17} strokeWidth={parentToneActive ? 2.25 : 2} className={navIconClass(parentToneActive)} />
          <span className="truncate">{item.label}</span>
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${item.label} 하위 메뉴 ${open ? "접기" : "펼치기"}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen((prev) => !prev);
          }}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ChevronDown size={16} className={["transition-transform duration-200", open ? "rotate-180" : "rotate-0"].join(" ")} aria-hidden />
        </button>
      </div>

      {open ? (
        <div className="mt-0.5 space-y-0.5" role="group" aria-label={`${item.label} 하위 메뉴`}>
          {item.children.map((child) => {
            const ChildIcon = child.icon;
            const isActive = isNavActive(pathname, child.href);
            return (
              <Link key={child.href} href={child.href} className={["group", navChildClass(isActive)].join(" ")}>
                <ChildIcon size={15} strokeWidth={isActive ? 2.25 : 2} className={navIconClass(isActive)} />
                {child.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function Sidebar({
  userEmail = null,
  userName = null,
  roleLabel = null,
  isAdmin = false
}: {
  userEmail?: string | null;
  userName?: string | null;
  roleLabel?: string | null;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const { openPanel, open } = useOkePanel();
  const okeActive = open || isOkeNavActive(pathname);

  return (
    <aside className="fixed left-0 top-0 z-10 flex h-screen w-64 flex-col border-r border-slate-200/90 bg-white">
      <div className="border-b border-slate-100 px-5 py-5">
        <Link href="/dashboard" className="inline-flex">
          <BrandLogo className="h-8 w-auto object-contain" priority />
        </Link>
        <p className="mt-2.5 text-2xs font-medium uppercase tracking-wider text-slate-400">OKESTRO Partner Portal</p>
        <GlobalPartnerSearch />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => {
          if (group.title === "Admin" && !isAdmin) return null;
          return (
          <div key={group.title} className="mb-5 last:mb-0">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{group.title}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                if (isAccordion(item)) {
                  const children = isAdmin
                    ? item.children
                    : item.children.filter((child) => !isAdminOnlySidebarHref(child.href));
                  return (
                    <PartnerAccordion
                      key={item.id}
                      item={{ ...item, children }}
                      pathname={pathname}
                    />
                  );
                }

                const Icon = item.icon;
                const isOke = item.href === "__oke__";
                const isActive = isOke ? okeActive : isNavActive(pathname, item.href);

                if (isOke) {
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => openPanel({ fullscreen: true })}
                      className={[
                        "group w-full",
                        navItemClass(isActive),
                        isActive ? "" : "ring-1 ring-inset ring-okestro-100"
                      ].join(" ")}
                    >
                      <Icon size={17} strokeWidth={isActive ? 2.25 : 2} className={navIconClass(isActive)} />
                      {item.label}
                    </button>
                  );
                }

                return (
                  <Link key={item.href} href={item.href} className={["group", navItemClass(isActive)].join(" ")}>
                    <Icon size={17} strokeWidth={isActive ? 2.25 : 2} className={navIconClass(isActive)} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
          );
        })}
      </nav>

      <SidebarUserFooter name={userName} email={userEmail} roleLabel={roleLabel} />
    </aside>
  );
}
