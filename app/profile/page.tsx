"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard as Edit,
  MapPin,
  Link as LinkIcon,
  Calendar,
  Star,
  Check,
  X,
  MessageCircle,
  StarHalf,
  LogOut,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { getUserProjects } from "@/lib/api/projects";
import {
  getPitchedMatches,
  type PitchedProjectMatches,
} from "@/lib/api/matches";
import {
  getPendingRatings,
  submitRating,
  type PendingRating,
} from "@/lib/api/ratings";
import {
  getInitials,
  formatDate,
  calculateProfileCompleteness,
} from "@/lib/utils";
import type { Project, User } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import CollaborationManager from "@/components/collaborations/collaboration-manager";

const resolveNumericId = (value?: number | string | null) => {
  if (value === undefined || value === null) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export default function ProfilePage() {
  const router = useRouter();
  const { user: authUser, isAuthenticated, logout } = useAuthStore();
  const userId = authUser?.id;
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [acceptedPitchedMatches, setAcceptedPitchedMatches] = useState<PitchedProjectMatches[]>([]);

  const mapPitchedProjectToProfile = (
    project: PitchedProjectMatches["project"],
    matches: PitchedProjectMatches["matches"]
  ): Project => ({
    id: project.id,
    title: project.title,
    description: project.description,
    techStack: project.requiredSkills ?? [],
    status: "pitching",
    authorId: ownerNumericId ? String(ownerNumericId) : "",
    applicants: matches.map((match) => ({
      userId: String(match.recommendedUser.id),
      user: {
        id: String(match.recommendedUser.id),
        name: match.recommendedUser.name,
        email: match.recommendedUser.email,
        skills: match.recommendedUser.skills ?? [],
      },
      roleId: match.requiredSkill ?? "general",
      status: match.userDecision === "accepted" ? "accepted" : "pending",
      appliedAt: new Date(match.createdAt),
      matchId: String(match.matchId),
      metrics: {
        skillMatchScore: match.skillMatchScore,
        engagementScore: match.engagementScoreSnapshot,
        ratingSnapshot: match.ratingSnapshot,
      },
      decisions: {
        owner: match.ownerDecision,
        user: match.userDecision,
      },
    })),
    collaborators: matches
      .filter((match) => match.ownerDecision === "accepted" && match.userDecision === "accepted")
      .map((match) => ({
        id: String(match.recommendedUser.id),
        name: match.recommendedUser.name,
        email: match.recommendedUser.email,
        skills: match.recommendedUser.skills ?? [],
      })),
  });
  const [pendingRatings, setPendingRatings] = useState<PendingRating[]>([]);
  const [ratingModal, setRatingModal] = useState<{
    open: boolean;
    rating?: PendingRating;
    score: number;
    feedback: string;
  }>({ open: false, score: 5, feedback: "" });

  const loadUserProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/profile?userId=${userId}`);
      const data = await res.json();
      setUser({
        ...data.user,
        skills: Array.isArray(data.user.skills) ? data.user.skills : [],
      });
    } catch (error) {
      console.error("Failed to load profile", error);
    }
  }, [userId]);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  const [isEditing, setIsEditing] = useState(false);
  const [activeProjectTab, setActiveProjectTab] = useState<
    "pitched" | "matched"
  >("pitched");

  const ownerNumericId = resolveNumericId(
    user?.user_id ?? user?.id ?? authUser?.user_id ?? authUser?.id
  );

  const { data: pitchedProjects, isLoading: pitchedLoading } = useQuery({
    queryKey: ["pitch-matches", ownerNumericId],
    queryFn: () => getPitchedMatches(ownerNumericId!),
    enabled: !!ownerNumericId,
    refetchInterval: 15000,
  });

  const { data: matchedProjects, isLoading: matchedLoading } = useQuery({
    queryKey: ["user-projects", user?.id ?? userId, "matched"],
    queryFn: () => getUserProjects(user?.id ?? userId, "matched"),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const { data: pendingRatingsData } = useQuery({
    queryKey: ["pending-ratings", ownerNumericId],
    queryFn: () => getPendingRatings(ownerNumericId!),
    enabled: !!ownerNumericId,
    refetchInterval: 30000,
  });

  // Compute userId for collaborations query (before effectiveUserId is defined)
  const collaborationsUserId = useMemo(() => {
    return String(
      user?.user_id ??
        user?.id ??
        authUser?.user_id ??
        authUser?.id ??
        userId ??
        ""
    );
  }, [user, authUser, userId]);

  // Fetch active collaborations (both accepted) for Profile Matched tab and Finish button
  const { data: activeCollaborationsData, isLoading: activeCollaborationsLoading } = useQuery<{
    collaborations: Array<{
      project_id: number;
      project_title: string;
      project_description: string;
      required_skill: string | null;
      project_required_skills?: string[] | null;
      project_owner_id?: number;
      project_owner_name?: string;
      project_owner_email?: string;
    }>;
  }>({
    queryKey: ["user-collaborations", collaborationsUserId],
    queryFn: async () => {
      if (!collaborationsUserId) return { collaborations: [] };
      const res = await fetch(`/api/user-collaborations?userId=${collaborationsUserId}`);
      if (!res.ok) return { collaborations: [] };
      return res.json();
    },
    enabled: !!collaborationsUserId,
    refetchInterval: 15000,
  });

  const activeCollaborationProjectIds = useMemo(() => {
    return new Set(
      activeCollaborationsData?.collaborations?.map((c) => c.project_id) ?? []
    );
  }, [activeCollaborationsData]);

  // Profile Matched tab: show only active collaborations (both accepted), with Finish button
  const activeCollaborationProjects = useMemo((): Project[] => {
    const collabs = activeCollaborationsData?.collaborations ?? [];
    return collabs.map((c) => ({
      id: String(c.project_id),
      title: c.project_title ?? "",
      description: c.project_description ?? "",
      techStack: Array.isArray(c.project_required_skills) ? c.project_required_skills : c.required_skill ? [c.required_skill] : [],
      status: "matching",
      authorId: String(c.project_owner_id ?? ""),
      author: {
        id: String(c.project_owner_id ?? ""),
        name: c.project_owner_name ?? "Project Owner",
        email: c.project_owner_email ?? "",
        skills: [],
      },
      applicants: [],
      collaborators: [],
    }));
  }, [activeCollaborationsData]);

  useEffect(() => {
    if (pendingRatingsData) {
      setPendingRatings(pendingRatingsData);
    }
  }, [pendingRatingsData]);

  const handleOpenRating = useCallback((rating: PendingRating) => {
    setRatingModal({
      open: true,
      rating,
      score: 5,
      feedback: "",
    });
  }, []);

  const handleCloseRatingModal = useCallback(() => {
    setRatingModal((prev) => ({ ...prev, open: false, rating: undefined }));
  }, []);

  const handleRatingScoreChange = useCallback((value: number[]) => {
    if (!value.length) return;
    setRatingModal((prev) => ({ ...prev, score: value[0] }));
  }, []);

  const handleRatingFeedbackChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const { value } = event.target;
      setRatingModal((prev) => ({ ...prev, feedback: value }));
    },
    []
  );

  const invalidateRatingRelatedQueries = useCallback(() => {
    if (ownerNumericId) {
      queryClient.invalidateQueries({ queryKey: ["pending-ratings", ownerNumericId] });
      queryClient.invalidateQueries({ queryKey: ["pitch-matches", ownerNumericId] });
    }
    const collaboratorId = user?.id ?? userId;
    if (collaboratorId) {
      queryClient.invalidateQueries({ queryKey: ["user-projects", collaboratorId, "matched"] });
    }
  }, [ownerNumericId, queryClient, user?.id, userId]);

  const finishCollaborationMutation = useMutation({
    mutationFn: async ({ userId: uid, projectId }: { userId: string; projectId: number }) => {
      const res = await fetch("/api/finish-collaboration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, projectId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to finish collaboration");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(
        data.canJoinNewProjects
          ? "Collaboration finished. You can be recommended for new projects."
          : "Collaboration marked as completed."
      );
      if (ownerNumericId) {
        queryClient.invalidateQueries({ queryKey: ["user-collaboration-status", ownerNumericId] });
      }
      const collaboratorId = user?.id ?? userId;
      if (collaboratorId) {
        queryClient.invalidateQueries({ queryKey: ["user-projects", collaboratorId, "matched"] });
      }
      // Invalidate active collaborations so the Finish button disappears
      const uid = user?.user_id ?? user?.id ?? authUser?.user_id ?? authUser?.id ?? userId;
      if (uid) {
        queryClient.invalidateQueries({ queryKey: ["user-collaborations", String(uid)] });
      }
      loadUserProfile();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const submitRatingMutation = useMutation({
    mutationFn: async ({
      ratingId,
      score,
      feedback,
      raterId,
    }: {
      ratingId: number;
      score: number;
      feedback?: string;
      raterId: number;
    }) => submitRating(ratingId, { score, feedback, raterId }),
    onSuccess: (_, variables) => {
      toast.success("Rating submitted. Thanks for the feedback!");
      setPendingRatings((prev) => prev.filter((rating) => rating.ratingId !== variables.ratingId));
      invalidateRatingRelatedQueries();
      loadUserProfile();
      handleCloseRatingModal();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Could not submit rating. Please try again.";
      toast.error(message);
    },
  });

  const handleSubmitRating = useCallback(() => {
    if (!ratingModal.rating || !ownerNumericId || submitRatingMutation.isPending) {
      return;
    }
    submitRatingMutation.mutate({
      ratingId: ratingModal.rating.ratingId,
      score: ratingModal.score,
      feedback: ratingModal.feedback,
      raterId: ownerNumericId,
    });
  }, [ownerNumericId, ratingModal, submitRatingMutation]);

  const handleLogout = useCallback(() => {
    logout();
    router.push("/");
  }, [logout, router]);

  useEffect(() => {
    if (!pitchedProjects) {
      setAcceptedPitchedMatches([]);
      return;
    }
    setAcceptedPitchedMatches(pitchedProjects);
  }, [pitchedProjects]);

  const pendingRatingBanner = pendingRatings.length > 0 && (
    <Alert className="border-amber-500/40 bg-amber-50 text-amber-900">
      <AlertTitle className="flex items-center justify-between gap-4">
        <span>
          You have {pendingRatings.length} teammate
          {pendingRatings.length > 1 ? "s" : ""} waiting for a rating
        </span>
        <Badge variant="secondary" className="bg-white text-amber-900">
          Awaiting feedback
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-4 space-y-3">
        {pendingRatings.slice(0, 3).map((rating) => (
          <div
            key={rating.ratingId}
            className="flex flex-col gap-2 rounded-xl border border-amber-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-sm">
                Rate {rating.ratee.name}
                {rating.projectTitle ? ` for ${rating.projectTitle}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Requested {formatDate(new Date(rating.createdAt))}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => handleOpenRating(rating)}
            >
              Rate teammate
            </Button>
          </div>
        ))}
        {pendingRatings.length > 3 && (
          <p className="text-xs text-muted-foreground">
            +{pendingRatings.length - 3} more pending ratings
          </p>
        )}
      </AlertDescription>
    </Alert>
  );

  const handleChatClick = (userId: string) => {
    // TODO: integrate chat launcher on profile
    console.log("Open chat with user:", userId);
  };

  const completeness = useMemo(() => {
    if (!user) return 0;
    return calculateProfileCompleteness(user);
  }, [user]);

  const acceptedMatchedProjects = useMemo(() => {
    if (!matchedProjects) return [];
    return matchedProjects.filter((project) => project.status === "matching");
  }, [matchedProjects]);

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  const userSkills = Array.isArray(user.skills) ? user.skills : [];
  const effectiveUserId =
    String(
      user.user_id ??
        user.id ??
        authUser?.user_id ??
        authUser?.id ??
        userId
    );

  const PitchedProjectsList = ({
    projects,
    loading,
    onDecision,
    decisionPending,
  }: {
    projects?: PitchedProjectMatches[];
    loading: boolean;
    onDecision: (matchId: number, decision: "accepted" | "rejected") => void;
    decisionPending: boolean;
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
            You havent received any recommendations yet. Pitch a project to
            trigger the matching engine.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {projects.map(({ project, matches }) => (
          <Card key={project.id}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">{project.title}</h3>
                  <p className="text-muted-foreground text-sm">
                    {project.description}
                  </p>
                </div>
                <Badge variant="secondary">{matches.length} matches</Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                {(project.requiredSkills ?? []).map((skill) => (
                  <Badge key={skill} variant="outline" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>

              {matches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No candidates found yet. Try updating your required skills or
                  refresh recommendations.
                </p>
              ) : (
                <div className="space-y-4">
                  {matches.map((match) => (
                    <div
                      key={match.matchId}
                      className="p-4 border rounded-xl space-y-3"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src="" alt={match.recommendedUser.name} />
                            <AvatarFallback>
                              {getInitials(match.recommendedUser.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {match.recommendedUser.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {match.recommendedUser.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Badge variant="secondary">
                            Owner: {match.ownerDecision}
                          </Badge>
                          <Badge variant="outline">
                            User: {match.userDecision}
                          </Badge>
                        </div>
                      </div>

                      {match.ownerDecision === "accepted" && match.userDecision === "accepted" && (
                        <Alert>
                          <AlertTitle className="text-sm font-semibold">
                            Collaboration confirmed
                          </AlertTitle>
                          <AlertDescription className="text-xs">
                            You and {match.recommendedUser.name} are now collaborating on this project.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                        <span>
                          Skill match: {match.skillMatchScore?.toFixed(2) ?? "-"}
                        </span>
                        <span>Engagement: {match.engagementScoreSnapshot ?? "-"}</span>
                        <span>Rating: {match.ratingSnapshot ?? "-"}</span>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        {match.requiredSkill && (
                          <Badge variant="outline">
                            Required Skill: {match.requiredSkill}
                          </Badge>
                        )}
                        <Badge variant="outline">
                          Recommended {formatDate(new Date(match.createdAt))}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <div className="flex flex-wrap gap-2">
                          {match.recommendedUser.skills?.map((skill) => (
                            <Badge key={skill} variant="ghost" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleChatClick(String(match.recommendedUser.id))}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
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

  const ProjectsList = ({
    projects,
    loading,
    type,
    onFinishCollaboration,
    finishCollaborationPending,
    currentUserId,
    activeCollaborationProjectIds,
  }: {
    projects?: Project[];
    loading: boolean;
    type: "pitched" | "matched";
    onFinishCollaboration?: (projectId: number) => void;
    finishCollaborationPending?: boolean;
    currentUserId?: string;
    activeCollaborationProjectIds?: Set<number>;
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
                    {(project.techStack ?? []).map((tech) => (
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

                  {onFinishCollaboration && currentUserId && activeCollaborationProjectIds?.has(Number(project.id)) && (
                    <div className="pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        disabled={finishCollaborationPending}
                        onClick={() => onFinishCollaboration(Number(project.id))}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {finishCollaborationPending ? "Finishing…" : "Finish collaboration"}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        Mark this project as done to free a slot and get recommended for more projects.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const currentRatingTarget = ratingModal.rating;

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

      {pendingRatingBanner}

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
                  {userSkills.length > 0 ? (
                    userSkills.map((skill) => (
                      <Badge key={skill} variant="outline">
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Add your skills in onboarding to get better matches.
                    </span>
                  )}
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
                    projects={acceptedPitchedMatches.map(({ project, matches }) =>
                      mapPitchedProjectToProfile(project, matches)
                    )}
                    loading={pitchedLoading}
                    type="pitched"
                  />
                </TabsContent>

                <TabsContent value="matched">
                  <ProjectsList
                    projects={activeCollaborationProjects}
                    loading={activeCollaborationsLoading}
                    type="matched"
                    onFinishCollaboration={(projectId) =>
                      finishCollaborationMutation.mutate({
                        userId: effectiveUserId,
                        projectId,
                      })
                    }
                    finishCollaborationPending={finishCollaborationMutation.isPending}
                    currentUserId={effectiveUserId}
                    activeCollaborationProjectIds={activeCollaborationProjectIds}
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

          <CollaborationManager userId={effectiveUserId} />

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
              <Button 
                variant="outline" 
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={ratingModal.open}
        onOpenChange={(open) => {
          if (!open) handleCloseRatingModal();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate your teammate</DialogTitle>
            <DialogDescription>
              {currentRatingTarget
                ? `Share feedback for ${currentRatingTarget.ratee.name}${
                    currentRatingTarget.projectTitle ? ` on ${currentRatingTarget.projectTitle}` : ""
                  }.`
                : "Provide feedback to help improve collaboration quality."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm font-medium">
                <span>Score</span>
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500" />
                  {ratingModal.score.toFixed(1)} / 5
                </span>
              </div>
              <Slider
                min={0}
                max={5}
                step={0.5}
                value={[ratingModal.score]}
                onValueChange={handleRatingScoreChange}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Feedback (optional)</p>
              <Textarea
                placeholder="What went well? Anything they could improve?"
                value={ratingModal.feedback}
                onChange={handleRatingFeedbackChange}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCloseRatingModal}
              disabled={submitRatingMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitRating} disabled={submitRatingMutation.isPending}>
              {submitRatingMutation.isPending ? "Submitting..." : "Submit rating"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
