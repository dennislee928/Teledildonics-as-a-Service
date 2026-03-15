"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Cpu,
  LayoutDashboard,
  Lock,
  Menu,
  Radio,
  Shield,
  Sparkles,
  Terminal,
  Unplug,
  X,
  Zap,
} from "lucide-react";

type NavItem = {
  href: string;
  icon: React.ReactNode;
  label: string;
  summary: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", icon: <LayoutDashboard size={15} />, label: "Overview", summary: "Workspace posture" },
  { href: "/explorer/sessions", icon: <Activity size={15} />, label: "Sessions", summary: "Lifecycle control" },
  { href: "/explorer/control", icon: <Shield size={15} />, label: "Control", summary: "Arm and stop flows" },
  { href: "/explorer/pairing", icon: <Unplug size={15} />, label: "Pairing", summary: "Bridge bootstrap" },
  { href: "/explorer/handshake", icon: <Lock size={15} />, label: "Handshake", summary: "Transport exchange" },
  { href: "/explorer/simulation", icon: <Terminal size={15} />, label: "Simulation", summary: "Signed event replay" },
  { href: "/explorer/rules", icon: <Zap size={15} />, label: "Rules", summary: "Pricing logic" },
  { href: "/explorer/analytics", icon: <BarChart3 size={15} />, label: "Analytics", summary: "Hot-zone insight" },
  { href: "/explorer/telemetry", icon: <Radio size={15} />, label: "Telemetry", summary: "Live stream watch" },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const currentItem = useMemo(
    () => NAV_ITEMS.find((item) => isActivePath(pathname, item.href)),
    [pathname]
  );

  return (
    <div className="relative min-h-screen pb-8">
      <header className="sticky top-0 z-40 pt-4 sm:pt-5">
        <div className="app-frame">
          <div className="surface !rounded-[30px] !px-4 !py-4 sm:!px-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start justify-between gap-4">
                <Link href="/" className="min-w-0 space-y-2 no-underline">
                  <div className="eyebrow">
                    <Sparkles size={12} />
                    TaaS Demo Console
                  </div>
                  <div className="space-y-1">
                    <p className="truncate text-lg font-semibold text-[var(--text)] sm:text-xl">
                      Operational explorer for the control API
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">
                      Warmed-up demos, real routes, and fewer terminal-cosplay styling mistakes.
                    </p>
                  </div>
                </Link>

                <button
                  type="button"
                  className="btn-secondary xl:hidden"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open navigation"
                >
                  <Menu size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-4 xl:items-end">
                <div className="hidden flex-wrap justify-end gap-2 xl:flex">
                  {NAV_ITEMS.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`nav-chip no-underline ${active ? "nav-chip-active" : ""}`}
                      >
                        <span className={active ? "text-[var(--text)]" : "text-[var(--text-soft)]"}>{item.icon}</span>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="status-pill">
                    {currentItem?.summary ?? "Workspace posture"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-3">
              <div className="surface-muted !rounded-[22px] !p-4">
      
               
              </div>
              <div className="surface-muted !rounded-[22px] !p-4">
               
                <p className="mt-2 text-lg font-semibold text-[var(--text)]">
                  {currentItem?.label ?? "Overview"}
                </p>
              </div>
              <div className="surface-muted !rounded-[22px] !p-4">

              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="app-frame mt-6">
        {children}
      </main>

      <footer className="app-frame mt-8">
        <div className="surface-muted flex flex-col gap-3 !rounded-[24px] !px-5 !py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[var(--text-muted)]">
            Demo routes exercise the real control API, but the UI now reads like a product instead of a stress test.
          </p>
          <div className="flex items-center gap-2 text-[var(--text-soft)]">
            <Radio size={14} />
            Teledildonics-as-a-Service (TaaS) is a production-oriented baseline for secure, low-latency remote control sessions. This repository ships a greenfield monorepo with:

          </div>
        </div>
      </footer>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 p-4 backdrop-blur-sm xl:hidden">
          <div className="surface flex h-full flex-col !rounded-[30px] !p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="eyebrow">
                  <Sparkles size={12} />
                  Navigation
                </div>
                <p className="text-lg font-semibold text-[var(--text)]">Demo routes</p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation"
              >
                <X size={16} />
              </button>
            </div>

            <nav className="mt-6 grid gap-2">
              {NAV_ITEMS.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`surface-muted flex items-center justify-between !rounded-[20px] !border !p-4 no-underline ${
                      active ? "!border-[var(--border-strong)]" : "!border-[var(--border)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={active ? "text-[var(--accent)]" : "text-[var(--text-soft)]"}>{item.icon}</span>
                      <div>
                        <p className="font-semibold text-[var(--text)]">{item.label}</p>
                        <p className="text-sm text-[var(--text-muted)]">{item.summary}</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto pt-6">
              <div className="surface-muted !rounded-[22px] !p-4">
                <p className="metric-label">Workspace</p>
                <p className="mt-2 text-lg font-semibold text-[var(--text)]">ws_demo</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
