"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderOpen,
  Folder,
  Users,
  UserCheck,
  UserX,
  UserPlus,
  ThumbsUp,
  ThumbsDown,
  HandshakeIcon,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

interface AdminStats {
  openProjects: number;
  totalProjects: number;
  activeCollaborations: number;
  completedCollaborations: number;
  frozenUsers: number;
  activeUsers: number;
  totalUsers: number;
  newUsersLastMonth: number;
  acceptanceRateOwner: number;
  rejectionRateOwner: number;
  acceptanceRateUser: number;
  rejectionRateUser: number;
}

export default function AdminDashboardPage() {
  const { user } = useAuthStore();

  const {
    data: stats,
    isLoading,
    error,
    isError,
  } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (res.status === 403) {
        const err = new Error("Admin access required");
        (err as Error & { status?: number }).status = 403;
        throw err;
      }
      if (!res.ok) throw new Error("Failed to load admin stats");
      return res.json();
    },
    enabled: Boolean(user),
    retry: false,
  });

  const is403 = isError && error && (error as Error & { status?: number }).status === 403;

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please sign in</h1>
          <p className="text-muted-foreground">You must be signed in to view this page.</p>
        </div>
      </div>
    );
  }

  if (is403) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access denied</h1>
          <p className="text-muted-foreground max-w-md">
            This page is restricted to administrators. If you believe you should have access,
            ensure your email is listed in ADMIN_EMAILS.
          </p>
        </div>
      </div>
    );
  }

  if (isError && !is403) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error loading stats</h1>
          <p className="text-destructive">{error instanceof Error ? error.message : "Unknown error"}</p>
        </div>
      </div>
    );
  }

  if (isLoading || !stats) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const cards: { title: string; value: string | number; sub: string; icon: React.ElementType }[] = [
    { title: "Open projects", value: stats.openProjects, sub: "Status = Open", icon: FolderOpen },
    { title: "Total projects", value: stats.totalProjects, sub: "All time", icon: Folder },
    { title: "Active collaborations", value: stats.activeCollaborations, sub: "Ongoing", icon: HandshakeIcon },
    { title: "Completed collaborations", value: stats.completedCollaborations, sub: "Finished", icon: CheckCircle2 },
    { title: "Frozen users", value: stats.frozenUsers, sub: "account_status = frozen", icon: UserX },
    { title: "Active users", value: stats.activeUsers, sub: "account_status = active", icon: UserCheck },
    { title: "Total users", value: stats.totalUsers, sub: "All registered", icon: Users },
    { title: "New users (30 days)", value: stats.newUsersLastMonth, sub: "Past month", icon: UserPlus },
    { title: "Owner acceptance rate", value: `${stats.acceptanceRateOwner}%`, sub: "Owner decisions", icon: ThumbsUp },
    { title: "Owner rejection rate", value: `${stats.rejectionRateOwner}%`, sub: "Owner decisions", icon: ThumbsDown },
    { title: "User acceptance rate", value: `${stats.acceptanceRateUser}%`, sub: "Recommended user decisions", icon: ThumbsUp },
    { title: "User rejection rate", value: `${stats.rejectionRateUser}%`, sub: "Recommended user decisions", icon: ThumbsDown },
  ];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin dashboard</h1>
        <p className="text-muted-foreground">Platform-wide statistics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {cards.map(({ title, value, sub, icon: Icon }) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
