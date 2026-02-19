import { API_BASE, handleResponse } from './base';

export type MatchDecision = 'pending' | 'accepted' | 'rejected';

export interface RecommendedMatch {
  matchId: number;
  projectId: number;
  requiredSkill: string | null;
  skillMatchScore: number;
  engagementScoreSnapshot: number;
  ratingSnapshot: number;
  ownerDecision: MatchDecision;
  userDecision: MatchDecision;
  createdAt: string;
  updatedAt: string;
  recommendedUser: {
    id: number;
    name: string;
    email: string;
    skills: string[] | null;
  };
}

export interface PitchedProjectMatches {
  project: {
    id: string;
    title: string;
    description: string;
    requiredSkills: string[];
  };
  matches: RecommendedMatch[];
}

export interface AssignedMatch {
  matchId: number;
  projectId: number;
  projectTitle: string;
  projectDescription: string;
  projectRequiredSkills: string[];
  requiredSkill: string | null;
  skillMatchScore: number;
  engagementScoreSnapshot: number;
  ratingSnapshot: number;
  ownerDecision: MatchDecision;
  userDecision: MatchDecision;
  createdAt: string;
  updatedAt: string;
  projectOwnerName?: string;
  projectOwnerEmail?: string;
}

function mapRecommendedMatch(row: any): RecommendedMatch {
  return {
    matchId: row.match_id,
    projectId: row.project_id,
    requiredSkill: row.required_skill ?? null,
    skillMatchScore: row.skill_match_score ?? 0,
    engagementScoreSnapshot: row.engagement_score_snapshot ?? 0,
    ratingSnapshot: row.rating_snapshot ?? 0,
    ownerDecision: row.owner_decision as MatchDecision,
    userDecision: row.user_decision as MatchDecision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    recommendedUser: {
      id: row.recommended_user_id,
      name: row.recommended_user_name,
      email: row.recommended_user_email,
      skills: row.recommended_user_skills ?? [],
    },
  };
}

export async function getPitchedMatches(ownerId: number | string): Promise<PitchedProjectMatches[]> {
  const res = await fetch(`${API_BASE}/matches/pitched?owner_id=${ownerId}`);
  const data = await handleResponse<{ projects: { project: any; matches: any[] }[] }>(res);
  return data.projects.map(({ project, matches }) => ({
    project: {
      id: String(project.project_id),
      title: project.title,
      description: project.description,
      requiredSkills: project.required_skills ?? [],
    },
    matches: matches.map(mapRecommendedMatch),
  }));
}

export async function getAssignedMatches(userId: number | string): Promise<AssignedMatch[]> {
  const res = await fetch(`${API_BASE}/matches/assigned?user_id=${userId}`);
  const data = await handleResponse<{ matches: any[] }>(res);
  return data.matches.map((match) => ({
    matchId: match.match_id,
    projectId: match.project_id,
    projectTitle: match.project_title,
    projectDescription: match.project_description,
    projectRequiredSkills: match.project_required_skills ?? [],
    requiredSkill: match.required_skill ?? null,
    skillMatchScore: match.skill_match_score ?? 0,
    engagementScoreSnapshot: match.engagement_score_snapshot ?? 0,
    ratingSnapshot: match.rating_snapshot ?? 0,
    ownerDecision: match.owner_decision as MatchDecision,
    userDecision: match.user_decision as MatchDecision,
    createdAt: match.created_at,
    updatedAt: match.updated_at,
    projectOwnerName: match.project_owner_name,
    projectOwnerEmail: match.project_owner_email,
  }));
}

export async function updateMatchDecision(
  matchId: number | string,
  actor: 'owner' | 'user',
  decision: 'accepted' | 'rejected',
  reason?: Record<string, any>
) {
  const res = await fetch(`${API_BASE}/matches/${matchId}/${actor}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, reason }),
  });
  return handleResponse<{ match: any }>(res);
}