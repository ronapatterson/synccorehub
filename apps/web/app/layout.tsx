import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@synccorehub/ui/globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    template: "%s | SyncCoreHub",
    default: "SyncCoreHub — CRM for Growing Businesses",
  },
  description: "Know your customers, manage projects, and grow your business with SyncCoreHub.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
