"use client";

import "./globals.css";
import { Inter } from "next/font/google";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

import { AppShell } from "@/components/common/app-shell";
import { SessionSync } from "@/components/providers/session-sync";

const inter = Inter({ subsets: ["latin"] });

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 1,
    },
  },
});

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Don't auto-set any user - let login/register handle it!
  }, []);

  if (!mounted) {
    return null;
  }

  return <>{children}</>;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <SessionProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <SessionSync />
              <AppShell>{children}</AppShell>
              <Toaster position="top-right" />
            </AuthProvider>
          </QueryClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
