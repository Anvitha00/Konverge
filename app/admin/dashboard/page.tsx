"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import {
  ShieldCheck,
  FolderOpen,
  Users,
  UserCheck,
  Handshake,
  CheckCircle2,
  TrendingUp,
  UserX,
  CheckCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

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
  usersByDay?: { date: string; count: number }[];
  projectsByDay?: { date: string; count: number }[];
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, hasHydrated } = useAuthStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = Boolean(user?.isAdmin);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    if (!isAdmin) {
      setError("Admin access required");
      setLoading(false);
      return;
    }

    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data?.error || `Error ${res.status}`);
          return;
        }
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [hasHydrated, isAuthenticated, isAdmin, router]);

  if (!hasHydrated || !isAuthenticated) return null;

  if (error && !stats) {
    return (
      <div className="container max-w-4xl py-8">
        <Alert variant="destructive">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
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

  if (!stats) return null;

  const userStatusData = [
    { name: "Active", value: stats.activeUsers, color: "#22c55e" },
    { name: "Frozen", value: stats.frozenUsers, color: "#94a3b8" },
  ].filter((d) => d.value > 0);

  const projectStatusData = [
    { name: "Open", value: stats.openProjects, color: "#3b82f6" },
    {
      name: "Closed",
      value: Math.max(0, stats.totalProjects - stats.openProjects),
      color: "#94a3b8",
    },
  ].filter((d) => d.value > 0);

  const collaborationStatusData = [
    { name: "Active", value: stats.activeCollaborations, color: "#22c55e" },
    { name: "Completed", value: stats.completedCollaborations, color: "#3b82f6" },
  ].filter((d) => d.value > 0);

  const timeSeriesData = (() => {
    const users = stats.usersByDay ?? [];
    const projects = stats.projectsByDay ?? [];
    const dates = new Set([
      ...users.map((u) => u.date),
      ...projects.map((p) => p.date),
    ]);
    const sorted = Array.from(dates).sort();
    if (sorted.length > 0) {
      return sorted.map((date) => ({
        date: date.slice(5),
        users: users.find((u) => u.date === date)?.count ?? 0,
        projects: projects.find((p) => p.date === date)?.count ?? 0,
      }));
    }
    // Backfill last 30 days with zeros so growth chart is always visible
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      result.push({
        date: dateStr.slice(5),
        users: 0,
        projects: 0,
      });
    }
    return result;
  })();

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8 flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Platform-wide statistics and metrics
          </p>
        </div>
      </div>

      <div className="space-y-10">
        {/* Stats - dedicated cards for each metric */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Users
                </CardTitle>
                <UserCheck className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {stats.activeUsers}
                </div>
                <p className="text-xs text-muted-foreground">
                  account_status = active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Frozen Users
                </CardTitle>
                <UserX className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-600">
                  {stats.frozenUsers}
                </div>
                <p className="text-xs text-muted-foreground">
                  account_status = frozen
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Collaborations
                </CardTitle>
                <Handshake className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeCollaborations}</div>
                <p className="text-xs text-muted-foreground">Ongoing</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Completed Collaborations
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {stats.completedCollaborations}
                </div>
                <p className="text-xs text-muted-foreground">Finished</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Open Projects
                </CardTitle>
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.openProjects}</div>
                <p className="text-xs text-muted-foreground">
                  of {stats.totalProjects} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Users
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <p className="text-xs text-muted-foreground">All registered</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  New Users (30 days)
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.newUsersLastMonth}</div>
                <p className="text-xs text-muted-foreground">Past month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Owner Decisions
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div>
                    <span className="text-xl font-bold text-green-600">
                      {stats.acceptanceRateOwner}%
                    </span>
                    <p className="text-xs text-muted-foreground">Accept</p>
                  </div>
                  <div>
                    <span className="text-xl font-bold text-red-600">
                      {stats.rejectionRateOwner}%
                    </span>
                    <p className="text-xs text-muted-foreground">Reject</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  User Decisions
                </CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div>
                    <span className="text-xl font-bold text-green-600">
                      {stats.acceptanceRateUser}%
                    </span>
                    <p className="text-xs text-muted-foreground">Accept</p>
                  </div>
                  <div>
                    <span className="text-xl font-bold text-red-600">
                      {stats.rejectionRateUser}%
                    </span>
                    <p className="text-xs text-muted-foreground">Reject</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Charts */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Visualizations</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            {userStatusData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">User Status</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Active vs frozen accounts
                  </p>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      active: { label: "Active", color: "#22c55e" },
                      frozen: { label: "Frozen", color: "#94a3b8" },
                    }}
                    className="h-[200px]"
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie
                        data={userStatusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        innerRadius={0}
                        outerRadius={70}
                        paddingAngle={2}
                        legendType="circle"
                      >
                        {userStatusData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Legend
                        verticalAlign="bottom"
                        formatter={(value, entry) => (
                          <span className="text-sm">
                            {value}: {(entry.payload as { value?: number }).value ?? 0}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {projectStatusData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Project Status</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Open vs closed projects
                  </p>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      open: { label: "Open", color: "#3b82f6" },
                      closed: { label: "Closed", color: "#94a3b8" },
                    }}
                    className="h-[200px]"
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie
                        data={projectStatusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        innerRadius={0}
                        outerRadius={70}
                        paddingAngle={2}
                        legendType="circle"
                      >
                        {projectStatusData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Legend
                        verticalAlign="bottom"
                        formatter={(value, entry) => (
                          <span className="text-sm">
                            {value}: {(entry.payload as { value?: number }).value ?? 0}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {collaborationStatusData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Collaboration Status
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Active vs completed
                  </p>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      active: { label: "Active", color: "#22c55e" },
                      completed: { label: "Completed", color: "#3b82f6" },
                    }}
                    className="h-[200px]"
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie
                        data={collaborationStatusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="45%"
                        innerRadius={0}
                        outerRadius={70}
                        paddingAngle={2}
                        legendType="circle"
                      >
                        {collaborationStatusData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Legend
                        verticalAlign="bottom"
                        formatter={(value, entry) => (
                          <span className="text-sm">
                            {value}: {(entry.payload as { value?: number }).value ?? 0}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">
                  Growth (Last 30 days)
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  New users and projects pitched by day
                </p>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    users: { label: "New Users", color: "#22c55e" },
                    projects: { label: "New Projects", color: "#3b82f6" },
                  }}
                  className="h-[240px]"
                >
                  <LineChart
                    data={timeSeriesData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="users"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="projects"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
