"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  Unplug,
  Zap,
  BarChart3,
  Terminal,
  Menu,
  X,
  Shield,
  Lock,
  Radio,
} from "lucide-react";
import { DotMatrixText, TerminalBlink } from "@dennislee928/nothingx-react-components";

/** 對應 control-api 的導覽項目：每個項目對應一個可 fetch API 的頁面 */
const NAV_ITEMS: { href: string; icon: React.ReactNode; label: string }[] = [
  { href: "/", icon: <LayoutDashboard size={16} />, label: "Overview" },
  { href: "/explorer/sessions", icon: <Activity size={16} />, label: "Sessions" },
  { href: "/explorer/control", icon: <Shield size={16} />, label: "Control" },
  { href: "/explorer/pairing", icon: <Unplug size={16} />, label: "Device pair" },
  { href: "/explorer/handshake", icon: <Lock size={16} />, label: "Handshake" },
  { href: "/explorer/simulation", icon: <Terminal size={16} />, label: "Simulator" },
  { href: "/explorer/rules", icon: <Zap size={16} />, label: "Rule sets" },
  { href: "/explorer/analytics", icon: <BarChart3 size={16} />, label: "Analytics" },
  { href: "/explorer/telemetry", icon: <Radio size={16} />, label: "Live feed" },
];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-white noise-overlay">
      {/* Top bar: logo + title + nav + workspace */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="TAAS Home">
              <DotMatrixText color="#e11d48" dotSize={3}>TAAS</DotMatrixText>
              <span className="hidden text-xs font-semibold text-white/70 sm:inline">Control API Explorer</span>
            </Link>

            {/* Desktop: horizontal menu bar */}
            <nav className="hidden lg:flex items-center gap-0.5 ml-2" aria-label="Main">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors no-underline ${
                      active
                        ? "bg-white/[0.08] text-white"
                        : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
                    }`}
                  >
                    <span className={active ? "text-red-500" : "text-white/40"}>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] text-white/40">Workspace</span>
              <span className="text-xs font-semibold text-red-500">ws_demo</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
              <span className="text-[10px] text-white/50">OK</span>
            </div>
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-white/70 hover:bg-white/5 hover:text-white"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>

        {/* Mobile: second row scrollable nav (optional, or only hamburger) */}
        <div className="lg:hidden overflow-x-auto border-t border-white/[0.04] scrollbar-hide">
          <nav className="flex gap-0.5 px-4 py-2 min-w-max" aria-label="API pages">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium no-underline ${
                    active ? "bg-white/[0.08] text-white" : "text-white/50"
                  }`}
                >
                  <span className={active ? "text-red-500" : "text-white/40"}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 dot-bg">
        <div className="mx-auto max-w-5xl pb-12">
          {children}
        </div>
      </main>

      <footer className="shrink-0 flex h-10 items-center justify-between border-t border-white/[0.06] px-4 sm:px-6 text-[10px] text-white/40">
        <div className="flex items-center gap-3">
          <span>v2.4.0</span>
          <span className="h-0.5 w-0.5 rounded-full bg-white/20" />
          <span>Control API</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{new Date().toISOString().split("T")[0]}</span>
          <TerminalBlink />
        </div>
      </footer>

      {/* Mobile full-screen menu */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a] p-6 lg:hidden animate-in fade-in duration-200"
          role="dialog"
          aria-label="Navigation menu"
        >
          <div className="flex justify-between items-center mb-8">
            <span className="text-sm font-semibold text-white/80">API Explorer</span>
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-white/5 text-white/70 hover:text-white"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <X size={22} />
            </button>
          </div>
          <nav className="flex flex-col gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium no-underline ${
                    active ? "bg-white/[0.08] text-white" : "text-white/70 hover:bg-white/[0.05]"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className={active ? "text-red-500" : "text-white/50"}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto pt-8 border-t border-white/[0.06]">
            <p className="text-[10px] text-white/40 mb-1">Workspace</p>
            <p className="font-semibold text-red-500">ws_demo</p>
          </div>
        </div>
      )}
    </div>
  );
}
