"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Logo from "./Logo";

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 10 3.5l7 7M5 9.5V17h4v-4h2v4h4V9.5" />
    </svg>
  );
}

function SpecsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 2.5h5.5L15 6v11.5H6V2.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.5 2.5V6H15M8.5 10h4M8.5 12.8h4" />
    </svg>
  );
}

function InspectIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" />
      <path strokeLinecap="round" d="M13.5 13.5 17 17" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 10a6.5 6.5 0 1 1 1.9 4.6M3.5 10V6.8M3.5 10h3.2" />
      <path strokeLinecap="round" d="M10 6.5V10l2.6 1.6" />
    </svg>
  );
}

export const NAV_ITEMS: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/", label: "Home", icon: <HomeIcon /> },
  { href: "/specs", label: "Specs", icon: <SpecsIcon /> },
  { href: "/inspect", label: "Inspect", icon: <InspectIcon /> },
  { href: "/history", label: "History", icon: <HistoryIcon /> },
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
      <div className="mt-auto flex items-center gap-3 px-2 text-sm text-white">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c8ddef] text-xs font-semibold text-[#234361]">TB</span>
        <div><p>Tray Branch <span className="ml-1 text-navy-200">›</span></p><p className="text-xs text-navy-200">Team</p></div>
        <span aria-hidden="true" className="ml-auto text-navy-200">›</span>
      </div>
    </aside>
  );
}
