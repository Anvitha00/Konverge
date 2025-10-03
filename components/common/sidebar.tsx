"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  MessageCircle,
  Trophy,
  User,
  Settings,
  Plus,
  Bell,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

const sidebarItems = [
  { href: "/projects", label: "Discover", icon: Search },
  { href: "/projects/new", label: "Pitch Project", icon: Plus },
  { href: "/chat", label: "Messages", icon: MessageCircle },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  // Only hide on landing page - show on all other pages when user exists
  if (!user || pathname === "/") return null;

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
        </nav>
      </div>
    </aside>
  );
}
