"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useQuery } from "@tanstack/react-query";
import {
  CreditCard as Edit,
  MapPin,
  Link as LinkIcon,
  Calendar,
  Star,
  Check,
  X,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserProjects, updateApplicationStatus } from "@/lib/api/projects";
import {
  getInitials,
  formatDate,
  calculateProfileCompleteness,
} from "@/lib/utils";
import type { Project } from "@/types";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const { user: authUser } = useAuthStore();
  const userId = authUser?.id;

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/profile?userId=${userId}`)
      .then((res) => res.json())
      .then((data) => setUser(data.user));
  }, [userId]);

  const [isEditing, setIsEditing] = useState(false);
  const [activeProjectTab, setActiveProjectTab] = useState<
    "pitched" | "matched"
  >("pitched");

  const { data: pitchedProjects, isLoading: pitchedLoading } = useQuery({
    queryKey: ["user-projects", user?.id ?? userId, "pitched"],
    queryFn: () => getUserProjects(user?.id ?? userId, "pitched"),
    enabled: !!user,
  });

  const { data: matchedProjects, isLoading: matchedLoading } = useQuery({
    queryKey: ["user-projects", user?.id ?? userId, "matched"],
    queryFn: () => getUserProjects(user?.id ?? userId, "matched"),
    enabled: !!user,
  });

  const handleApplicationAction = async (
    projectId: string,
    userId: string,
    action: "accepted" | "rejected"
  ) => {
    try {
      await updateApplicationStatus(projectId, userId, action);
      // Refetch projects to update UI
      // In a real app, you'd use query invalidation
      window.location.reload();
    } catch (error) {
      console.error("Failed to update application:", error);
    }
  };

  const handleChatClick = (userId: string) => {
    // TODO: Open chat with user
    console.log("Open chat with user:", userId);
  };

  if (!user) return <div>Loading...</div>;

  const completeness = calculateProfileCompleteness(user);

  const ProjectsList = ({
    projects,
    loading,
    type,
  }: {
    projects?: Project[];
    loading: boolean;
    type: "pitched" | "matched";
  }) => {
    if (loading) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-4" />
                <div className="flex gap-2 mb-4">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (!projects?.length) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {type === "pitched"
              ? "You haven't pitched any projects yet."
              : "You haven't collaborated on any projects yet."}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">
                    {project.title}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-3">
                    {project.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {project.techStack.map((tech) => (
                      <Badge key={tech} variant="outline" className="text-xs">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Badge
                  variant={
                    project.status === "completed" ? "default" : "secondary"
                  }
                >
                  {project.status.replace("-", " ")}
                </Badge>
              </div>

              {type === "pitched" && project.applicants.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Applications</h4>
                  {project.applicants.map((application) => (
                    <div
                      key={application.userId}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={application.user.avatar}
                            alt={application.user.name}
                          />
                          <AvatarFallback>
                            {getInitials(application.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">
                            {application.user.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Applied {formatDate(application.appliedAt)}
                          </p>
                        </div>
                      </div>

                      {application.status === "pending" ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleChatClick(application.userId)}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleApplicationAction(
                                project.id,
                                application.userId,
                                "accepted"
                              )
                            }
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleApplicationAction(
                                project.id,
                                application.userId,
                                "rejected"
                              )
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              application.status === "accepted"
                                ? "default"
                                : "destructive"
                            }
                          >
                            {application.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleChatClick(application.userId)}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {type === "pitched" && project.collaborators.length > 0 && (
                <div className="space-y-3 mt-4">
                  <h4 className="font-medium">Collaborators</h4>
                  <div className="flex flex-wrap gap-2">
                    {project.collaborators.map((collaborator) => (
                      <div
                        key={collaborator.id}
                        className="flex items-center gap-2 p-2 border rounded-lg"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage
                            src={collaborator.avatar}
                            alt={collaborator.name}
                          />
                          <AvatarFallback>
                            {getInitials(collaborator.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{collaborator.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleChatClick(collaborator.id)}
                        >
                          <MessageCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {type === "matched" && (
                <div className="space-y-3">
                  <h4 className="font-medium">Project Team</h4>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={project.author.avatar}
                        alt={project.author.name}
                      />
                      <AvatarFallback>
                        {getInitials(project.author.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {project.author.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Project Owner
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleChatClick(project.author.id)}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>

                  {project.collaborators
                    .filter((c) => c.id !== user.id)
                    .map((collaborator) => (
                      <div
                        key={collaborator.id}
                        className="flex items-center gap-3 p-3 border rounded-lg"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage
                            src={collaborator.avatar}
                            alt={collaborator.name}
                          />
                          <AvatarFallback>
                            {getInitials(collaborator.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {collaborator.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Collaborator
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleChatClick(collaborator.id)}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Profile</h1>
        <Button
          onClick={() => setIsEditing(!isEditing)}
          variant="outline"
          className="gap-2"
        >
          <Edit className="h-4 w-4" />
          {isEditing ? "Cancel" : "Edit Profile"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="text-xl">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{user.name}</h2>
                  <p className="text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {user.bio && (
                <div>
                  <h3 className="font-semibold mb-2">Bio</h3>
                  <p className="text-muted-foreground">{user.bio}</p>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-2">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {user.skills.map((skill) => (
                    <Badge key={skill} variant="outline">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Links</h3>
                <div className="space-y-2">
                  {user.github && (
                    <a
                      href={user.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <LinkIcon className="h-4 w-4" />
                      GitHub
                    </a>
                  )}
                  {user.linkedin && (
                    <a
                      href={user.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <LinkIcon className="h-4 w-4" />
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* My Projects */}
          <Card>
            <CardHeader>
              <CardTitle>My Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs
                value={activeProjectTab}
                onValueChange={(value) =>
                  setActiveProjectTab(value as "pitched" | "matched")
                }
              >
                <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
                  <TabsTrigger value="pitched">Pitched</TabsTrigger>
                  <TabsTrigger value="matched">Matched</TabsTrigger>
                </TabsList>

                <TabsContent value="pitched">
                  <ProjectsList
                    projects={pitchedProjects}
                    loading={pitchedLoading}
                    type="pitched"
                  />
                </TabsContent>

                <TabsContent value="matched">
                  <ProjectsList
                    projects={matchedProjects}
                    loading={matchedLoading}
                    type="matched"
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Badges section removed: not in DB */}
        </div>

        <div className="space-y-6">
          {/* Profile Completeness section removed: not in DB */}

          {/* Stats section removed: not in DB, except rating and engagement_score */}
          <Card>
            <CardHeader>
              <CardTitle>Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Rating</span>
                <span className="font-semibold">{user.rating}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Engagement Score</span>
                <span className="font-semibold">{user.engagement_score}</span>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                View My Projects
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Find Collaborators
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Update Availability
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
