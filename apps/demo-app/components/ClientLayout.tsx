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
  Cpu,
  Menu,
  X,
  ChevronRight,
  Shield,
  Network,
  Database,
  Lock,
  Radio
} from "lucide-react";
import { NothingCard, DotMatrixText, TerminalBlink } from "@dennislee928/nothingx-react-components";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  // Close mobile menu on path change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const navGroups = [
    {
      title: "Core_System",
      items: [
        { href: "/", icon: <LayoutDashboard size={18} />, label: "OVERVIEW" },
        { href: "/explorer/sessions", icon: <Activity size={18} />, label: "SESSIONS" },
        { href: "/explorer/control", icon: <Shield size={18} />, label: "CONTROL" },
      ]
    },
    {
      title: "Security_Auth",
      items: [
        { href: "/explorer/pairing", icon: <Unplug size={18} />, label: "DEVICE_PAIR" },
        { href: "/explorer/handshake", icon: <Lock size={18} />, label: "HANDSHAKE" },
        { href: "/explorer/simulation", icon: <Terminal size={18} />, label: "SIMULATOR" },
      ]
    },
    {
      title: "Logic_Analytics",
      items: [
        { href: "/explorer/rules", icon: <Zap size={18} />, label: "RULE_SETS" },
        { href: "/explorer/analytics", icon: <BarChart3 size={18} />, label: "ANALYTICS" },
        { href: "/explorer/telemetry", icon: <Radio size={18} />, label: "LIVE_FEED" },
      ]
    }
  ];

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] text-white noise-overlay overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside 
        className={`hidden lg:flex flex-col border-r border-white/[0.06] transition-all duration-300 ease-out bg-[#080808] z-30 ${
          isSidebarOpen ? "w-64" : "w-20"
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-white/[0.06] shrink-0">
          <div className={`overflow-hidden transition-all duration-300 ${isSidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0"}`}>
            <DotMatrixText color="#e11d48" dotSize={4}>TAAS</DotMatrixText>
          </div>
          <button 
            onClick={toggleSidebar}
            className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} className="text-red-500" />}
          </button>
        </div>

        <nav className="flex-1 py-5 px-3 space-y-6 overflow-y-auto scrollbar-hide">
          {navGroups.map((group, idx) => (
            <div key={idx} className="space-y-2">
              <p className={`text-[10px] font-semibold tracking-widest text-white/30 uppercase px-3 transition-opacity duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0"}`}>
                {group.title.replace(/_/g, " ")}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink 
                    key={item.href} 
                    href={item.href} 
                    icon={item.icon} 
                    label={item.label} 
                    active={pathname === item.href} 
                    collapsed={!isSidebarOpen} 
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
            <span className={`text-[10px] font-medium text-white/40 transition-opacity duration-300 ${isSidebarOpen ? "opacity-100" : "opacity-0"}`}>
              System optimal
            </span>
          </div>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 relative h-screen">
        {/* Top Navbar */}
        <header className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 -ml-1 rounded-lg text-white/70 hover:text-white hover:bg-white/5" onClick={toggleMobileMenu} aria-label="Open menu">
              <Menu size={22} />
            </button>
            <div className="hidden lg:flex items-center gap-2 text-[11px] font-medium text-white/50">
              <Lock size={12} className="text-red-500/80" />
              Secure Relay v2 · Node 01
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] text-white/40">Workspace</span>
              <span className="text-xs font-semibold text-red-500">ws_demo</span>
            </div>
            <div className="w-9 h-9 rounded-lg border border-white/[0.08] flex items-center justify-center bg-white/[0.04]">
              <Cpu size={18} className="text-red-500/90" />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8 dot-bg">
          <div className="max-w-5xl mx-auto pb-16">
            {children}
          </div>
        </main>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-[#0a0a0a] z-50 flex flex-col p-6 lg:hidden animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-10">
              <DotMatrixText color="#e11d48" dotSize={4}>TAAS</DotMatrixText>
              <button onClick={toggleMobileMenu} className="p-2 rounded-lg hover:bg-white/5" aria-label="Close menu"><X size={24} /></button>
            </div>
            <nav className="flex-1 space-y-1">
              {navGroups.flatMap(g => g.items).map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href} 
                  className="flex items-center gap-4 py-3 px-4 rounded-xl text-lg font-semibold text-white/90 hover:bg-white/5 hover:text-white"
                >
                  <span className="text-red-500">{item.icon}</span>
                  {item.label.replace(/_/g, " ")}
                </Link>
              ))}
            </nav>
            <div className="pt-8 border-t border-white/[0.06]">
               <p className="text-[10px] text-white/40 mb-1">Authenticated as</p>
               <p className="font-semibold text-red-500">Admin · Root Session</p>
            </div>
          </div>
        )}

        {/* System Footer */}
        <footer className="h-12 shrink-0 border-t border-white/[0.06] flex items-center justify-between px-4 sm:px-6 lg:px-8 text-[10px] text-white/40">
          <div className="flex items-center gap-3">
            <span>v2.4.0</span>
            <span className="w-0.5 h-0.5 rounded-full bg-white/20" />
            <span>Latency 12ms</span>
          </div>
          <div className="flex items-center gap-3">
            <span>{new Date().toISOString().split("T")[0]}</span>
            <TerminalBlink />
          </div>
        </footer>
      </div>
    </div>
  );
}

function NavLink({ href, icon, label, active, collapsed }: { href: string; icon: React.ReactNode; label: string; active: boolean; collapsed: boolean }) {
  return (
    <Link 
      href={href} 
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
        active ? "bg-white/[0.06] text-white" : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
      }`}
    >
      <span className={`shrink-0 transition-colors duration-200 ${active ? "text-red-500" : "text-white/40 group-hover:text-red-500/80"}`}>
        {icon}
      </span>
      {!collapsed && (
        <span className={`text-[11px] font-medium tracking-wide transition-opacity duration-300 ${active ? "text-white" : "text-inherit"}`}>
          {label.replace(/_/g, " ")}
        </span>
      )}
      {active && !collapsed && (
        <div className="absolute right-3 w-0.5 h-4 rounded-full bg-red-500" />
      )}
    </Link>
  );
}

function DottedSeparator() {
  return <div className="w-1 h-1 rounded-full bg-white/10" />;
}
