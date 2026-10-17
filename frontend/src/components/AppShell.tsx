"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Logo from "./Logo";
import SampleBanner from "./SampleBanner";
import Sidebar, { NAV_ITEMS, isNavActive } from "./Sidebar";

function MarketingHeader() {
  return <header className="marketing-header">
    <Link href="/" aria-label="VeriLabel home" className="home-brand"><Logo variant="light" /></Link>
    <nav aria-label="Product navigation" className="marketing-links">
      <a href="#product">Product</a><a href="#solutions">Solutions</a><a href="#resources">Resources</a><a href="#pricing">Pricing</a>
    </nav>
    <div className="marketing-actions"><Link href="/specs" className="outline-button">Sign in</Link><Link href="/specs?new=1" className="primary-button">Request a pilot</Link></div>
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
      <div className="marketing-shell flex min-h-screen flex-col bg-white">
        <MarketingHeader />
        <main className="flex-1">{children}</main>

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
