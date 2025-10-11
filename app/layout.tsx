"use client";

import "./globals.css";
import { Inter } from "next/font/google";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/common/app-shell";
import { useAuthStore } from "@/store/auth-store";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

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
  const { isAuthenticated } = useAuthStore();

  // Check if we're on an auth page
  const isAuthPage =
    typeof window !== "undefined" &&
    (window.location.pathname === "/" ||
      window.location.pathname.startsWith("/auth"));

  const showAppShell = isAuthenticated && !isAuthPage;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {showAppShell ? <AppShell>{children}</AppShell> : children}
            <Toaster position="top-right" />
          </AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
