"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Check, X, Trash2 } from "lucide-react";
import { getInitials, formatDate } from "@/lib/utils";
import type { PitchedProjectMatches } from "@/lib/api/matches";

interface PitchedProjectsListProps {
  projects?: PitchedProjectMatches[];
  loading: boolean;
  onDecision: (matchId: number, decision: "accepted" | "rejected") => void;
  decisionPending: boolean;
  onChatClick?: (userId: string) => void;
  onDeleteProject?: (projectId: number) => void;
  deleting?: boolean;
}

export function PitchedProjectsList({
  projects,
  loading,
  onDecision,
  decisionPending,
  onChatClick,
  onDeleteProject,
  deleting,
}: PitchedProjectsListProps) {
  const handleChatClick = (userId: string) => {
    if (onChatClick) onChatClick(userId);
  };

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
                <p className="text-muted-foreground text-sm">{project.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{matches.length} matches</Badge>
                {onDeleteProject && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete project"
                    title="Delete project"
                    disabled={deleting}
                    onClick={() => onDeleteProject(Number(project.id))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {project.requiredSkills.map((skill) => (
                <Badge key={skill} variant="outline" className="text-xs">
                  {skill}
                </Badge>
              ))}
            </div>

            {matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No candidates found yet. Try updating your required skills or refresh recommendations.
              </p>
            ) : (
              <div className="space-y-4">
                {matches.map((match) => (
                  <div key={match.matchId} className="p-4 border rounded-xl space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src="" alt={match.recommendedUser.name} />
                          <AvatarFallback>
                            {getInitials(match.recommendedUser.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{match.recommendedUser.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {match.recommendedUser.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
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
                      <span>Skill match: {match.skillMatchScore?.toFixed(2) ?? "-"}</span>
                      <span>Engagement: {match.engagementScoreSnapshot ?? "-"}</span>
                      <span>Rating: {match.ratingSnapshot ?? "-"}</span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      {match.requiredSkill && (
                        <Badge variant="outline">Required Skill: {match.requiredSkill}</Badge>
                      )}
                      <Badge variant="outline">
                        Recommended {formatDate(new Date(match.createdAt))}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="flex flex-wrap gap-2">
                        {match.recommendedUser.skills?.map((skill) => (
                          <Badge key={skill} variant="outline" className="text-xs">
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
                        {match.ownerDecision === "pending" ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={decisionPending}
                              onClick={() => onDecision(match.matchId, "accepted")}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={decisionPending}
                              onClick={() => onDecision(match.matchId, "rejected")}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Badge
                            variant={match.ownerDecision === "accepted" ? "default" : "destructive"}
                          >
                            {match.ownerDecision}
                          </Badge>
                        )}
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
}
