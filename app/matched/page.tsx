"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/auth-store";
import {
  getAssignedMatches,
  updateMatchDecision,
} from "@/lib/api/matches";
import { getPitchedMatches } from "@/lib/api/matches";
import { deleteProject } from "@/lib/api/projects";
import type { PitchedProjectMatches } from "@/lib/api/matches";
import { PitchedProjectsList } from "@/components/matches/pitched-projects-list";
import { Check, X, Clock, Users } from "lucide-react";
import { toast } from "sonner";

interface UserCollaborationStatus {
  userId: number;
  activeCollaborations: number;
  completedCollaborations: number;
  pitchedProjects: number;
  totalCommitments: number;
  accountStatus: string;
  canJoinNewProjects: boolean;
}

const resolveNumericId = (value?: number | string | null) => {
  if (value === undefined || value === null) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export default function MatchedPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"matched" | "pitched">("matched");
  const resolvedUserId = resolveNumericId(user?.user_id ?? user?.id);
  const ownerNumericId = resolveNumericId(user?.user_id ?? user?.id);
  const queryClient = useQueryClient();

  const { data: collabStatus } = useQuery<UserCollaborationStatus | undefined>({
    queryKey: ["user-collaboration-status", resolvedUserId],
    queryFn: async () => {
      if (!resolvedUserId) return undefined;
      const res = await fetch(`/api/user-collaboration-status?userId=${resolvedUserId}`);
      if (!res.ok) {
        throw new Error("Failed to load collaboration status");
      }
      return res.json();
    },
    enabled: Boolean(resolvedUserId),
    staleTime: 15000,
  });

  const reachedCollaborationLimit = collabStatus ? !collabStatus.canJoinNewProjects : false;

  const {
    data: allMatches = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["assigned-matches", resolvedUserId],
    queryFn: () => getAssignedMatches(resolvedUserId!),
    enabled: Boolean(resolvedUserId),
    refetchInterval: 15000,
  });

  // Only show matches where a decision is still pending (owner or user)
  const matches = useMemo(
    () =>
      allMatches.filter(
        (m) => m.ownerDecision === "pending" || m.userDecision === "pending"
      ),
    [allMatches]
  );

  const deleteProjectMutation = useMutation({
    mutationFn: (projectId: number) => deleteProject(projectId),
    onSuccess: (_, projectId) => {
      toast.success("Project deleted.");
      if (ownerNumericId) {
        queryClient.invalidateQueries({ queryKey: ["pitch-matches", ownerNumericId] });
      }
      queryClient.invalidateQueries({ queryKey: ["assigned-matches", resolvedUserId] });
    },
    onError: (error: Error) => {
      toast.error(error?.message || "Failed to delete project.");
    },
  });

  const handleDeleteProject = (projectId: number) => {
    if (!window.confirm("Delete this project and all its matches? This cannot be undone.")) {
      return;
    }
    deleteProjectMutation.mutate(projectId);
  };

  const {
    data: pitchedProjects,
    isLoading: pitchedLoading,
  } = useQuery<{ project: PitchedProjectMatches["project"]; matches: PitchedProjectMatches["matches"] }[] | undefined>({
    queryKey: ["pitch-matches", ownerNumericId],
    queryFn: () => getPitchedMatches(ownerNumericId!),
    enabled: Boolean(ownerNumericId),
    refetchInterval: 15000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      matchId,
      decision,
    }: {
      matchId: number;
      decision: "accepted" | "rejected";
    }) => updateMatchDecision(matchId, "user", decision),
    onSuccess: (_, variables) => {
      toast.success(`Match ${variables.decision === "accepted" ? "accepted" : "rejected"}.`);
      queryClient.invalidateQueries({ queryKey: ["assigned-matches", resolvedUserId] });
    },
    onError: (error: Error) => {
      toast.error(error?.message || "Failed to update match status. Please try again.");
    },
  });

  const ownerDecisionMutation = useMutation({
    mutationFn: ({
      matchId,
      decision,
    }: {
      matchId: number;
      decision: "accepted" | "rejected";
    }) => updateMatchDecision(matchId, "owner", decision),
    onSuccess: () => {
      toast.success("Decision recorded for your recommendation.");
      if (ownerNumericId) {
        queryClient.invalidateQueries({ queryKey: ["pitch-matches", ownerNumericId] });
      }
    },
    onError: (error: Error) => {
      toast.error(error?.message || "Failed to update decision");
    },
  });

  const statusMeta = useMemo(
    () => ({
      pending: { label: "Pending", variant: "secondary" as const },
      accepted: { label: "Accepted", variant: "default" as const },
      rejected: { label: "Rejected", variant: "destructive" as const },
    }),
    []
  );

  const handleStatusChange = (
    matchId: number,
    decision: "accepted" | "rejected"
  ) => {
    if (decision === "accepted" && reachedCollaborationLimit) {
      toast.error("Reached collaboration limit. Finish an existing collaboration or close a pitched project before accepting new matches.");
      return;
    }
    updateStatusMutation.mutate({ matchId, decision });
  };

  const handleOwnerDecision = (
    matchId: number,
    decision: "accepted" | "rejected"
  ) => {
    ownerDecisionMutation.mutate({ matchId, decision });
  };

  if (!resolvedUserId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Please sign in to view your matched tasks.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <CardTitle className="text-3xl font-bold">Matched Tasks</CardTitle>
        <p className="text-muted-foreground">
          Review tasks that fit your skills and respond to move forward.
        </p>
      </header>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "matched" | "pitched")}
        className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-lg">
          <TabsTrigger value="matched">Assigned to me</TabsTrigger>
          <TabsTrigger value="pitched">My pitched projects</TabsTrigger>
        </TabsList>

        <TabsContent value="matched" className="mt-0">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-16">Loading your matches...</div>
          ) : isError ? (
            <div className="text-center text-destructive py-16">
              We couldn't load your matches. Please refresh the page.
            </div>
          ) : matches.length === 0 ? (
            <div className="text-center text-muted-foreground py-16 space-y-2">
              <p>No pending matches right now.</p>
              <p className="text-sm">
                When both you and the owner accept, the project moves to{" "}
                <strong>Profile → Matched</strong> where you can finish the collaboration.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {matches.map((match) => (
                <Card key={match.matchId}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Project
                        </p>
                        <CardTitle className="text-2xl">{match.projectTitle}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {match.projectDescription}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={statusMeta[match.ownerDecision].variant} className="self-start">
                          Owner: {statusMeta[match.ownerDecision].label}
                        </Badge>
                        <Badge variant={statusMeta[match.userDecision].variant} className="self-start">
                          You: {statusMeta[match.userDecision].label}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg border p-4">
                        <p className="text-xs uppercase text-muted-foreground tracking-wide">
                          Matched Skill
                        </p>
                        <p className="text-lg font-semibold">
                          {match.requiredSkill ?? "General collaborator"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Highest affinity skill match for this project.
                        </p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>Project Owner</span>
                          <span className="font-medium">{match.projectOwnerName ?? "Owner"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm mt-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>Skill Match: {match.skillMatchScore.toFixed(2)}</span>
                        </div>
                        <div className="flex flex-col text-sm text-muted-foreground mt-2">
                          <span>Engagement: {match.engagementScoreSnapshot ?? "-"}</span>
                          <span>Rating Snapshot: {match.ratingSnapshot ?? "-"}</span>
                        </div>
                      </div>
                    </div>

                    {match.userDecision === "pending" ? (
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                          className="flex-1"
                          onClick={() => handleStatusChange(match.matchId, "accepted")}
                          disabled={updateStatusMutation.isPending || reachedCollaborationLimit}
                          title={reachedCollaborationLimit ? "Reached collaboration limit" : undefined}
                        >
                          <Check className="mr-2 h-4 w-4" /> Accept
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleStatusChange(match.matchId, "rejected")}
                          disabled={updateStatusMutation.isPending}
                        >
                          <X className="mr-2 h-4 w-4" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        You have {match.userDecision === "accepted" ? "accepted" : "rejected"} this task.
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pitched" className="mt-0">
          <PitchedProjectsList
            projects={pitchedProjects as PitchedProjectMatches[] | undefined}
            loading={pitchedLoading}
            onDecision={handleOwnerDecision}
            decisionPending={ownerDecisionMutation.isPending}
            onChatClick={(id) => console.log("Open chat with", id)}
            onDeleteProject={handleDeleteProject}
            deleting={deleteProjectMutation.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
