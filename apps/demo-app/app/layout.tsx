import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Activity, 
  Settings, 
  Unplug, 
  Zap, 
  BarChart3, 
  Terminal 
} from "lucide-react";
import { TaasProvider } from "@/components/TaasProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TaaS Next.js Demo",
  description: "Demonstration of Teledildonics-as-a-Service APIs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <TaasProvider>
          <div className="flex min-h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-64 border-r bg-muted/30 hidden md:block">
              <div className="p-6">
                <h1 className="text-xl font-bold tracking-tight">TaaS Demo</h1>
              </div>
              <nav className="px-4 space-y-2">
                <NavLink href="/" icon={<LayoutDashboard size={18} />} label="Dashboard" />
                <NavLink href="/sessions" icon={<Activity size={18} />} label="Sessions" />
                <NavLink href="/rules" icon={<Zap size={18} />} label="RuleSets" />
                <NavLink href="/pairing" icon={<Unplug size={18} />} label="Pairing" />
                <NavLink href="/simulator" icon={<Terminal size={18} />} label="Event Simulator" />
                <NavLink href="/insights" icon={<BarChart3 size={18} />} label="Insights" />
              </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col">
              <header className="h-16 border-b flex items-center justify-between px-8 bg-background/80 backdrop-blur-md sticky top-0 z-10">
                <div className="font-medium text-muted-foreground md:hidden">TaaS Demo</div>
                <div className="flex items-center gap-4 ml-auto">
                  <div className="text-xs bg-accent/10 text-accent px-2 py-1 rounded border border-accent/20">
                    Demo Workspace: ws_demo
                  </div>
                </div>
              </header>
              <div className="p-8">
                {children}
              </div>
            </main>
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
      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
