"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  MessageCircle,
  Trophy,
  User,
  Plus,
  BookOpen,
  BarChart3,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

const sidebarItems = [
  { href: "/projects", label: "Discover", icon: Search },
  { href: "/projects/pitch", label: "Pitch Project", icon: Plus },
  { href: "/chat", label: "Messages", icon: MessageCircle },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/matched", label: "Matched", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { isAuthenticated, hasHydrated, logout, user } = useAuthStore();
  const isAdmin = Boolean(user?.isAdmin);

  // Only hide on landing page - show on all other pages when user exists
  if (!hasHydrated) return null;
  const isAuthRoute = pathname === "/" || pathname.startsWith("/auth");
  if (isAuthRoute) return null;
  if (!isAuthenticated) return null;

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:block">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/projects" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              K
            </div>
            <span className="text-lg font-semibold">Konverge</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin/dashboard"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/admin/dashboard"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <ShieldCheck className="h-5 w-5" />
              Admin
            </Link>
          )}
        </nav>

        <div className="border-t p-4">
          <Button
            variant="outline"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </aside>
  );
}
