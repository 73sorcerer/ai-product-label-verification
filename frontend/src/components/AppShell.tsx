"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Logo from "./Logo";
import Sidebar, { NAV_ITEMS, isNavActive } from "./Sidebar";

function MarketingHeader() {
  return <header className="marketing-header">
    <Link href="/" aria-label="VeriLabel home" className="home-brand"><Logo variant="light" /></Link>
    <nav aria-label="Primary" className="marketing-links">
      {NAV_ITEMS.map(item => <Link key={item.href} href={item.href} aria-current={item.href === "/" ? "page" : undefined}>{item.label}</Link>)}
    </nav>
    <div className="marketing-actions"><Link href="/inspect?demo=1" className="primary-button">Try a Sample Inspection</Link><Link href="/specs?new=1" className="outline-button">Create a Specification</Link></div>
  </header>;
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
        className="grid grid-cols-4 gap-1 px-3 pb-3"
        aria-label="Primary"
      >
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-1 py-2 text-xs font-medium sm:text-sm ${
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
      <div className="marketing-shell flex flex-col bg-white">
        <MarketingHeader />
        <main>{children}</main>
        <footer className="marketing-footer">VeriLabel <span aria-hidden="true">·</span> AI product label verification</footer>

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
        </main>
      </div>
    </div>
  );
}
