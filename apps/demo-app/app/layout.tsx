import type { Metadata } from "next";
import "./globals.css";
import { TaasProvider } from "@/components/TaasProvider";
import { ClientLayout } from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "TaaS Demo Console",
  description: "Operational demo console for the TaaS control plane.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <TaasProvider>
          <ClientLayout>{children}</ClientLayout>
        </TaasProvider>
      </body>
    </html>
  );
}
