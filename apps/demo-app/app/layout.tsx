import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Activity, 
  Unplug, 
  Zap, 
  BarChart3, 
  Terminal,
  Cpu
} from "lucide-react";
import { TaasProvider } from "@/components/TaasProvider";
import { NothingCard, DotMatrixText, DottedDivider } from "@dennislee928/nothingx-react-components";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TaaS // NothingX Demo",
  description: "Advanced Teledildonics-as-a-Service Interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-black dot-bg text-white`}>
        <TaasProvider>
          <div className="flex min-h-screen p-4 md:p-6 gap-4">
            {/* Sidebar */}
            <aside className="w-72 hidden lg:flex flex-col gap-4">
              <NothingCard dark style={{ height: '100%', border: '1px solid #333' }}>
                <div className="flex flex-col h-full">
                  <div className="p-4 mb-6">
                    <DotMatrixText color="#ff0000" dotSize={4}>TAAS</DotMatrixText>
                    <p className="text-[10px] text-muted-foreground mt-2 tracking-[0.2em] font-mono">REMOTE_HAPTIC_v2.0</p>
                  </div>
                  
                  <nav className="flex-1 space-y-1">
                    <NavLink href="/" icon={<LayoutDashboard size={18} />} label="OVERVIEW" />
                    <NavLink href="/sessions" icon={<Activity size={18} />} label="SESSIONS" />
                    <NavLink href="/rules" icon={<Zap size={18} />} label="RULE_SETS" />
                    <NavLink href="/pairing" icon={<Unplug size={18} />} label="DEVICE_PAIR" />
                    <NavLink href="/simulator" icon={<Terminal size={18} />} label="SIMULATOR" />
                    <NavLink href="/insights" icon={<BarChart3 size={18} />} label="ANALYTICS" />
                  </nav>

                  <div className="mt-auto p-4 pt-6 border-t border-white/10">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                      <Cpu size={14} className="text-red-500" />
                      <span>SYS_STATUS: OPTIMAL</span>
                    </div>
                  </div>
                </div>
              </NothingCard>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col gap-4">
              <header className="flex items-center justify-between px-6 py-4 bg-black/40 backdrop-blur-xl border border-white/10 rounded-[24px]">
                <div className="lg:hidden">
                   <DotMatrixText color="#ff0000" dotSize={3}>TAAS</DotMatrixText>
                </div>
                <div className="hidden lg:block text-[10px] font-mono tracking-widest text-muted-foreground">
                  CONTROL_PLANE // SECURE_RELAY_ACTIVE
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-mono text-muted-foreground">WORKSPACE_ID</span>
                    <span className="text-xs font-bold font-mono">ws_demo</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-auto rounded-[24px] glass p-6 border border-white/5">
                {children}
              </div>
            </div>
          </div>
        </TaasProvider>
      </body>
    </html>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link 
      href={href} 
      className="flex items-center gap-4 px-4 py-3 rounded-xl text-xs font-bold tracking-widest transition-all hover:bg-white/5 group border border-transparent hover:border-white/10"
    >
      <span className="text-muted-foreground group-hover:text-red-500 transition-colors">{icon}</span>
      <span className="font-mono">{label}</span>
    </Link>
  );
}
