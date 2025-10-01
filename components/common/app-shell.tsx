'use client';

import { ReactNode } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Navbar } from './navbar';
import { Sidebar } from './sidebar';
import { Toaster } from '@/components/ui/sonner';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Navbar />
      
      <main className="pb-16 lg:pl-64 md:pb-0">
        <div className="container mx-auto max-w-7xl px-4 py-6">
          {children}
        </div>
      </main>
      
      <Toaster />
    </div>
  );
}