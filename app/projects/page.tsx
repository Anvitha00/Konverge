"use client";

import { useEffect, useState } from "react";
import type { JSX } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  MessageCircle,
  User,
  Briefcase,
  Plus,
  Code2,
  Box,
  Wrench,
  Users,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn, getInitials } from "@/lib/utils";
import { applyToProject } from "@/lib/api/applications";
import { API_BASE } from "@/lib/api/base";

interface Project {
  project_id: number;
  title: string;
  description: string;
  required_skills: string[];
  owner_id: number;
  owner_name: string;
  owner_email: string;
  status: string;
  roles_available?: number;
  created_at: string;
}

interface UserProfile {
  user_id: number;
  name: string;
  email: string;
  bio?: string;
  skills: string[];
  github?: string;
  linkedin?: string;
  rating?: number;
  engagement_score?: number;
}

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const { setProjectFormOpen } = useUIStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [rawSearch, setRawSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"projects" | "people">(
    "projects",
  );
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Debounce search input
  useEffect(() => {
    const handle = setTimeout(() => setSearchQuery(rawSearch.trim()), 300);
    return () => clearTimeout(handle);
  }, [rawSearch]);

  // Fetch all projects - using YOUR Next.js API
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ["all-projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects?view=pitching");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });

  // Fetch all users - using YOUR profile API
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      // Fetch from your existing API or create a new endpoint
      const res = await fetch(`${API_BASE}/users`);
      if (!res.ok) {
        // Fallback: return empty array if endpoint doesn't exist
        return { users: [] };
      }
      return res.json();
    },
  });

  // Create or get direct message thread
  const createThreadMutation = useMutation({
    mutationFn: async (targetUserId: number) => {
      const res = await fetch(`${API_BASE}/threads/direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user1_id: user?.user_id,
          user2_id: targetUserId,
        }),
      });
      if (!res.ok) throw new Error("Failed to create thread");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Opening chat...");
      queryClient.invalidateQueries({ queryKey: ["threads"] });
      router.push(`/chat?thread=${data.thread.thread_id}`);
    },
    onError: () => {
      toast.error(
        "Failed to start chat. Make sure WebSocket server is running.",
      );
    },
  });

  // Apply to project mutation
  const applyMutation = useMutation({
    mutationFn: async (projectId: number) => {
      return applyToProject(projectId);
    },
    onSuccess: (data) => {
      toast.success(`Application submitted for "${data.project_title}"`);
      setSelectedProject(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleApplyToProject = (projectId: number) => {
    if (!user) {
      toast.error("Please login to apply to projects");
      return;
    }
    applyMutation.mutate(projectId);
  };

  const projects: Project[] = projectsData?.projects || [];
  const users: UserProfile[] = usersData?.users || [];

  // Filter based on search
  const filteredProjects = projects.filter((p) => {
    const currentUserIds = [user?.user_id, user?.id].filter(
      (value): value is number | string =>
        value !== undefined && value !== null,
    );
    if (
      currentUserIds.length > 0 &&
      currentUserIds.some((id) => Number(p.owner_id) === Number(id))
    ) {
      return false;
    }

    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.title?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query) ||
      p.required_skills?.some((s) => s.toLowerCase().includes(query)) ||
      p.owner_name?.toLowerCase().includes(query)
    );
  });

  const filteredUsers = users.filter((u) => {
    if (u.user_id === user?.user_id) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.bio?.toLowerCase().includes(query) ||
      u.skills?.some((s) => s.toLowerCase().includes(query))
    );
  });

  const handleMessageUser = (userId: number) => {
    if (!user?.user_id) {
      toast.error("Please log in to send messages");
      return;
    }
    createThreadMutation.mutate(userId);
  };

  const accentMap: Record<string, { color: string; icon: JSX.Element }> = {
    react: { color: "#3B82F6", icon: <Code2 className="h-3.5 w-3.5" /> },
    vue: { color: "#3B82F6", icon: <Code2 className="h-3.5 w-3.5" /> },
    fastapi: { color: "#3B82F6", icon: <Code2 className="h-3.5 w-3.5" /> },
    python: { color: "#10B981", icon: <Code2 className="h-3.5 w-3.5" /> },
    node: { color: "#10B981", icon: <Code2 className="h-3.5 w-3.5" /> },
    flutter: { color: "#8B5CF6", icon: <Box className="h-3.5 w-3.5" /> },
    reactnative: { color: "#8B5CF6", icon: <Box className="h-3.5 w-3.5" /> },
    docker: { color: "#14B8A6", icon: <Wrench className="h-3.5 w-3.5" /> },
    kubernetes: { color: "#14B8A6", icon: <Wrench className="h-3.5 w-3.5" /> },
    go: { color: "#14B8A6", icon: <Wrench className="h-3.5 w-3.5" /> },
    rust: { color: "#F59E0B", icon: <Code2 className="h-3.5 w-3.5" /> },
    solidity: { color: "#F59E0B", icon: <Code2 className="h-3.5 w-3.5" /> },
    nlp: { color: "#EC4899", icon: <Box className="h-3.5 w-3.5" /> },
    transformers: { color: "#EC4899", icon: <Box className="h-3.5 w-3.5" /> },
  };

  const getCategoryColor = (skill: string) => {
    const key = skill.replace(/\s+/g, "").toLowerCase();
    return (
      accentMap[key] ?? {
        color: "#fb923c",
        icon: <Code2 className="h-3.5 w-3.5" />,
      }
    );
  };

  const renderProjectSkeletons = (count = 6) => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, idx) => (
        <Card
          key={idx}
          className="border border-black/5 rounded-[12px] skeleton-card p-6 h-full"
        >
          <div className="space-y-4">
            <div className="h-4 w-2/3 bg-white/40 rounded" />
            <div className="h-3 w-full bg-white/30 rounded" />
            <div className="h-3 w-5/6 bg-white/30 rounded" />
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-white/30 rounded-full" />
              <div className="h-6 w-20 bg-white/30 rounded-full" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  const renderUserSkeletons = (count = 6) => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, idx) => (
        <Card
          key={idx}
          className="border border-black/5 rounded-[12px] skeleton-card p-6 h-full"
        >
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-white/40" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-1/2 bg-white/40 rounded" />
              <div className="h-3 w-3/4 bg-white/30 rounded" />
              <div className="h-3 w-2/3 bg-white/30 rounded" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  const renderEmptyState = () => (
    <div className="text-center py-16">
      <div className="mx-auto mb-6 h-32 w-32 rounded-full bg-gradient-to-br from-orange-200 to-orange-100 flex items-center justify-center">
        <Briefcase className="h-12 w-12 text-orange-500" />
      </div>
      <h3 className="text-2xl font-semibold mb-2">
        No projects match your search
      </h3>
      <p className="text-muted-foreground max-w-md mx-auto mb-6">
        Try different keywords or broaden your filters to discover more
        opportunities.
      </p>
      <Button onClick={() => setProjectFormOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        Pitch a Project
      </Button>
    </div>
  );

  return (
    <div className="space-y-10 pb-10 bg-[hsl(var(--background))]">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between px-2">
        <div>
          <h1 className="text-4xl md:text-[40px] font-bold leading-tight">
            Discover Projects
          </h1>
          <p className="text-lg text-[#6B7280] mt-2">
            Find exciting projects and collaborate with talented developers
          </p>
        </div>
        <Button
          onClick={() => setProjectFormOpen(true)}
          className="gap-2 text-base px-6 py-5 rounded-2xl"
        >
          <Plus className="h-5 w-5" />
          <span>Pitch Project</span>
        </Button>
      </div>

      {/* Search Bar with Tabs */}
      <div className="rounded-[28px] bg-white/95 border border-black/5 shadow-[0_15px_35px_rgba(15,23,42,0.06)] p-6 space-y-6">
        <Tabs
          value={searchType}
          onValueChange={(v) => setSearchType(v as any)}
          className="space-y-6"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={`Search ${searchType}...`}
                value={rawSearch}
                onChange={(e) => setRawSearch(e.target.value)}
                className="pl-11 pr-4 h-12 rounded-[12px] border border-black/5 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:border-orange-400 focus-visible:border-[2px] focus-visible:shadow-[0_0_0_3px_rgba(255,107,53,0.1)]"
              />
            </div>
            <TabsList className="bg-muted/40 rounded-2xl px-2 py-1 gap-2">
              <TabsTrigger
                value="projects"
                className="gap-2 rounded-xl text-sm transition-all duration-300 ease-out"
              >
                <Briefcase className="h-4 w-4" />
                Projects
              </TabsTrigger>
              <TabsTrigger
                value="people"
                className="gap-2 rounded-xl text-sm transition-all duration-300 ease-out"
              >
                <User className="h-4 w-4" />
                People
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Projects Tab */}
          <TabsContent value="projects" className="mt-6">
            {projectsLoading ? (
              renderProjectSkeletons()
            ) : filteredProjects.length === 0 ? (
              renderEmptyState()
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((project, idx) => {
                  const firstSkill = project.required_skills?.[0];
                  const { color } = firstSkill
                    ? getCategoryColor(firstSkill)
                    : { color: "#fb923c" };
                  const isFeatured =
                    project.roles_available !== undefined &&
                    project.roles_available >= 4;
                  return (
                    <Card
                      key={project.project_id}
                      className={cn(
                        "relative cursor-pointer rounded-[12px] border border-black/5 bg-white/90 backdrop-blur transition-all duration-300 ease-out",
                        "will-change-transform card-enter shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
                      )}
                      style={{ animationDelay: `${idx * 0.1}s` }}
                      onClick={() => setSelectedProject(project)}
                    >
                      <div
                        className="absolute inset-y-4 left-4 w-[4px] rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <CardHeader className="pb-0 pt-6 pl-8 pr-6">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div
                              className="h-12 w-12 rounded-full text-white text-lg font-semibold flex items-center justify-center mb-4"
                              style={{
                                background: `linear-gradient(135deg, ${color}, #ff9f68)`,
                              }}
                            >
                              {project.title.charAt(0)}
                            </div>
                            <CardTitle className="text-xl font-semibold leading-tight">
                              {project.title}
                            </CardTitle>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge
                              className={cn(
                                "rounded-full px-3 py-1 text-xs uppercase tracking-wide",
                                project.status?.toLowerCase() === "open"
                                  ? "bg-orange-100 text-orange-700 status-badge-open badge-pulse"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {project.status}
                            </Badge>
                            {isFeatured && (
                              <Badge className="gap-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-white text-xs font-semibold shadow-md">
                                <Star className="h-3 w-3" />
                                Featured
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-5 p-6 pt-4 pl-8">
                        <p className="text-base text-muted-foreground leading-relaxed line-clamp-3 mt-3">
                          {project.description}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {project.required_skills
                            ?.slice(0, 3)
                            .map((skill, i) => {
                              const { color, icon } = getCategoryColor(skill);
                              return (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 rounded-[8px] px-3 py-1 text-xs font-medium text-white transition-all duration-200 hover:scale-105"
                                  style={{ backgroundColor: color }}
                                >
                                  {icon}
                                  {skill}
                                </span>
                              );
                            })}
                          {(project.required_skills?.length || 0) > 3 && (
                            <Badge
                              variant="outline"
                              className="rounded-[8px] px-3 py-1 text-xs"
                            >
                              +{project.required_skills.length - 3}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-dashed">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="text-sm">
                                {getInitials(project.owner_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="text-sm">
                              <p className="font-medium">
                                {project.owner_name}
                              </p>
                              <p className="text-muted-foreground">
                                Project Owner
                              </p>
                            </div>
                          </div>
                          {project.roles_available !== undefined && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Users className="h-4 w-4" />
                              {project.roles_available} roles
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* People Tab */}
          <TabsContent value="people" className="mt-6">
            {usersLoading ? (
              renderUserSkeletons()
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No users found</p>
                <p className="text-sm">
                  {searchQuery
                    ? "Try a different search term"
                    : "No other users available"}
                </p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredUsers.map((person, idx) => (
                  <Card
                    key={person.user_id}
                    className="cursor-pointer rounded-[12px] border border-black/5 bg-white/95 backdrop-blur transition-all duration-300 ease-out card-enter shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                    style={{
                      animationDelay: `${idx * 0.1}s`,
                      willChange: "transform",
                    }}
                    onClick={() => setSelectedUser(person)}
                  >
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-16 w-16 rounded-2xl">
                          <AvatarFallback className="text-lg">
                            {getInitials(person.name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0 space-y-2">
                          <h3 className="font-semibold truncate text-lg">
                            {person.name}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {person.email}
                          </p>

                          {person.bio && (
                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                              {person.bio}
                            </p>
                          )}
                        </div>
                      </div>

                      {person.skills && person.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {person.skills.slice(0, 4).map((skill, i) => {
                            const { color, icon } = getCategoryColor(skill);
                            return (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 rounded-[8px] px-3 py-1 text-xs font-medium text-white transition-transform duration-200 hover:scale-105"
                                style={{ backgroundColor: color }}
                              >
                                {icon}
                                {skill}
                              </span>
                            );
                          })}
                          {person.skills.length > 4 && (
                            <Badge
                              variant="outline"
                              className="text-xs rounded-[8px]"
                            >
                              +{person.skills.length - 4}
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Project Detail Dialog */}
      <Dialog
        open={!!selectedProject}
        onOpenChange={() => setSelectedProject(null)}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedProject && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <DialogTitle className="text-2xl">
                    {selectedProject.title}
                  </DialogTitle>
                  <Badge>{selectedProject.status}</Badge>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                {/* Owner Info */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {getInitials(selectedProject.owner_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {selectedProject.owner_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedProject.owner_email}
                      </p>
                    </div>
                  </div>
                  {selectedProject.owner_id !== user?.user_id && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMessageUser(selectedProject.owner_id);
                      }}
                      disabled={createThreadMutation.isPending}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Message Owner
                    </Button>
                  )}
                </div>

                {/* Description */}
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {selectedProject.description}
                  </p>
                </div>

                {/* Required Skills */}
                <div>
                  <h3 className="font-semibold mb-2">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedProject.required_skills?.map((skill, i) => (
                      <Badge key={i} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Roles */}
                {selectedProject.roles_available !== undefined && (
                  <div className="flex items-center gap-4 p-4 border rounded-lg">
                    <div>
                      <p className="text-2xl font-bold">
                        {selectedProject.roles_available}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Roles Available
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    className="flex-1"
                    onClick={() =>
                      handleApplyToProject(selectedProject.project_id)
                    }
                    disabled={applyMutation.isPending}
                  >
                    {applyMutation.isPending ? "Applying..." : "Apply to Join"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedProject(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* User Profile Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedUser && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-2xl">
                      {getInitials(selectedUser.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-2xl">
                      {selectedUser.name}
                    </DialogTitle>
                    <p className="text-muted-foreground">
                      {selectedUser.email}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                {/* Bio */}
                {selectedUser.bio && (
                  <div>
                    <h3 className="font-semibold mb-2">About</h3>
                    <p className="text-muted-foreground">{selectedUser.bio}</p>
                  </div>
                )}

                {/* Skills */}
                {selectedUser.skills && selectedUser.skills.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.skills.map((skill, i) => (
                        <Badge key={i} variant="secondary">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats */}
                {(selectedUser.rating || selectedUser.engagement_score) && (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedUser.rating && (
                      <div className="p-4 border rounded-lg">
                        <p className="text-2xl font-bold">
                          {selectedUser.rating.toFixed(1)}
                        </p>
                        <p className="text-sm text-muted-foreground">Rating</p>
                      </div>
                    )}
                    {selectedUser.engagement_score && (
                      <div className="p-4 border rounded-lg">
                        <p className="text-2xl font-bold">
                          {selectedUser.engagement_score}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Engagement Score
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMessageUser(selectedUser.user_id);
                    }}
                    disabled={createThreadMutation.isPending}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedUser(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
