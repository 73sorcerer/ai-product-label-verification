"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Logo from "./Logo";
import { House, ClipboardCheck, ScanText, History, Building2 } from "lucide-react";

export const NAV_ITEMS: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/", label: "Home", icon: <House size={20} strokeWidth={1.75} aria-hidden="true" /> },
  { href: "/specs", label: "Specs", icon: <ClipboardCheck size={20} strokeWidth={1.75} aria-hidden="true" /> },
  { href: "/inspect", label: "Inspect", icon: <ScanText size={20} strokeWidth={1.75} aria-hidden="true" /> },
  { href: "/history", label: "History", icon: <History size={20} strokeWidth={1.75} aria-hidden="true" /> },
];

export function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="app-sidebar fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-navy-900 px-3 py-7 lg:flex">
      <div className="px-2">
        <Logo variant="light" />
      </div>
      <nav className="mt-9 flex flex-col gap-1.5" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-l-2 border-[#00b6ee] bg-navy-800 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "text-navy-200 hover:bg-navy-800/60 hover:text-white"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      {/* No accounts yet (ADR 0004), so don't show a signed-in user. */}
      <div className="mt-auto flex items-center gap-3 px-2 text-sm text-white" title="Everyone using this site shares one workspace. Sign-in comes later.">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-800 text-navy-200"><Building2 size={18} strokeWidth={1.75} aria-hidden="true" /></span>
        <div><p>Demo workspace</p><p className="text-xs text-navy-200">No sign-in yet</p></div>
      </div>
    </aside>
  );
}
