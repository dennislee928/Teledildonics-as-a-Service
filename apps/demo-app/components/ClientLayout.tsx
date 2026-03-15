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
        { href: "/explorer/insights", icon: <BarChart3 size={18} />, label: "ANALYTICS" },
        { href: "/explorer/telemetry", icon: <Radio size={18} />, label: "LIVE_FEED" },
      ]
    }
  ];

  return (
    <div className="flex min-h-screen bg-black text-white noise-overlay overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside 
        className={`hidden lg:flex flex-col border-r border-white/10 transition-all duration-500 ease-in-out bg-black z-30 ${
          isSidebarOpen ? "w-72" : "w-20"
        }`}
      >
        <div className="p-6 h-24 flex items-center justify-between border-b border-white/5">
          <div className={`overflow-hidden transition-all duration-500 ${isSidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0"}`}>
            <DotMatrixText color="#ff0000" dotSize={4}>TAAS</DotMatrixText>
          </div>
          <button 
            onClick={toggleSidebar}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            {isSidebarOpen ? <X size={20} className="text-muted-foreground" /> : <Menu size={20} className="text-red-500" />}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-8 overflow-y-auto scrollbar-hide">
          {navGroups.map((group, idx) => (
            <div key={idx} className="space-y-2">
              <p className={`text-[9px] font-black tracking-[0.3em] text-white/20 uppercase px-4 transition-opacity duration-500 ${isSidebarOpen ? "opacity-100" : "opacity-0"}`}>
                {group.title}
              </p>
              <div className="space-y-1">
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

        <div className="p-6 border-t border-white/5 bg-black/50">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className={`text-[10px] font-mono text-muted-foreground transition-opacity duration-500 ${isSidebarOpen ? "opacity-100" : "opacity-0"}`}>
              SYS_STATUS: OPTIMAL
            </span>
          </div>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 relative h-screen">
        {/* Top Navbar */}
        <header className="h-20 flex items-center justify-between px-6 lg:px-10 border-b border-white/10 glass-dark sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2" onClick={toggleMobileMenu}>
              <Menu size={24} />
            </button>
            <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
              <Lock size={12} className="text-red-500" /> Secure_Relay_v2.0 // Node_01
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Workspace_Context</span>
              <span className="text-xs font-black font-mono text-red-500 tracking-tighter">ws_demo</span>
            </div>
            <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-white/5">
              <Cpu size={20} className="text-red-500" />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-10 dot-bg">
          <div className="max-w-7xl mx-auto pb-20">
            {children}
          </div>
        </main>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-black z-50 flex flex-col p-8 lg:hidden animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-12">
              <DotMatrixText color="#ff0000" dotSize={4}>TAAS</DotMatrixText>
              <button onClick={toggleMobileMenu}><X size={32} /></button>
            </div>
            <nav className="flex-1 space-y-6">
              {navGroups.flatMap(g => g.items).map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href} 
                  className="flex items-center gap-6 text-2xl font-black tracking-tight"
                >
                  <span className="text-red-500">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="pt-12 border-t border-white/10">
               <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">Authenticated_As</p>
               <p className="font-black text-red-500 uppercase tracking-tighter">Admin_Root_Session</p>
            </div>
          </div>
        )}

        {/* System Footer */}
        <footer className="h-14 border-t border-white/5 glass-dark flex items-center justify-between px-6 lg:px-10 text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
          <div className="flex items-center gap-4">
            <span>v2.4.0-REL</span>
            <DottedSeparator />
            <span>Latency: 12ms</span>
          </div>
          <div className="flex items-center gap-4">
            <span>{new Date().toISOString().split('T')[0]}</span>
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
      className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group relative ${
        active ? "bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(255,0,0,0.05)]" : "border border-transparent hover:bg-white/[0.02]"
      }`}
    >
      <span className={`transition-colors duration-300 ${active ? "text-red-500" : "text-muted-foreground group-hover:text-red-400"}`}>
        {icon}
      </span>
      {!collapsed && (
        <span className={`text-[11px] font-black tracking-widest transition-opacity duration-500 ${active ? "text-white" : "text-white/60 group-hover:text-white"}`}>
          {label}
        </span>
      )}
      {active && !collapsed && (
        <div className="absolute right-4 w-1 h-1 rounded-full bg-red-500 shadow-[0_0_8px_#ff0000]" />
      )}
    </Link>
  );
}

function DottedSeparator() {
  return <div className="w-1 h-1 rounded-full bg-white/10" />;
}
