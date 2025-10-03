"use client";

import "./globals.css";
import { Inter } from "next/font/google";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/common/app-shell";
import { useAuthStore } from "@/store/auth-store";
import { mockUsers } from "@/lib/api/mock-data";
import { useEffect, useState } from "react";

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
  const { setUser } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Mock authentication - set the first user as logged in
    setUser(mockUsers[0]);
  }, [setUser]);

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
  // Show AppShell (side/top navbars) only if user is authenticated
  const { isAuthenticated } = useAuthStore();
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
          </AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
