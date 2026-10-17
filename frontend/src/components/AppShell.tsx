"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Logo from "./Logo";
import SampleBanner from "./SampleBanner";
import Sidebar, { NAV_ITEMS, isNavActive } from "./Sidebar";

function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-mist-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link href="/" aria-label="VeriLabel home">
          <Logo variant="dark" />
        </Link>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/inspect?demo=1"
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            Try a Sample Inspection
            <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/specs"
            className="inline-flex items-center rounded-xl border border-mist-200 bg-white px-4 py-2.5 text-sm font-semibold text-navy-900 transition-colors hover:border-brand-600 hover:text-brand-700"
          >
            Create a Specification
          </Link>
        </div>
      </div>
    </header>
  );
}

function MobileNav() {
  const pathname = usePathname();
  return (
    <header className="bg-navy-900 lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/" aria-label="VeriLabel home">
          <Logo variant="light" />
        </Link>
      </div>
      <nav
        className="flex gap-1 overflow-x-auto px-4 pb-3"
        aria-label="Primary"
      >
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                active
                  ? "bg-navy-800 text-white"
                  : "text-navy-200 hover:text-white"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  if (isHome) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <MarketingHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-mist-200 py-6 text-center text-sm text-ink-500">
          VeriLabel · AI product label verification · CSE 651
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mist-50">
      <Sidebar />
      <div className="flex min-h-screen flex-col lg:pl-60">
        <MobileNav />
        <main className="app-main w-full min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {children}
          <SampleBanner />
        </main>
      </div>
    </div>
  );
}
