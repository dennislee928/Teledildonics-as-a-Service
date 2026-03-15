import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TaasProvider } from "@/components/TaasProvider";
import { ClientLayout } from "@/components/ClientLayout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TaaS // Advanced Haptic API",
  description: "Next-generation Teledildonics-as-a-Service Control Interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-[#0a0a0a]`}>
        <TaasProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </TaasProvider>
      </body>
    </html>
  );
}
