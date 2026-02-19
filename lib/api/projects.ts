import type { Project, Paginated, ProjectFilters } from '@/types';
import { mockProjects } from './mock-data';
import { API_BASE, handleResponse } from './base';

export interface CreateProjectPayload {
  title: string;
  description: string;
  required_skills: string[];
  owner_id: number;
  status?: string;
  roles_available?: number;
}

export async function createProject(payload: CreateProjectPayload) {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ project: any; matches: any[] }>(res);
}

export async function deleteProject(projectId: number | string) {
  const res = await fetch(`${API_BASE}/projects/${projectId}`, {
    method: 'DELETE',
  });
  return handleResponse<{ status: string; projectId: number }>(res);
}

export async function getProjects(
  filters?: ProjectFilters,
  page = 1,
  limit = 10,
  userId?: string
): Promise<Paginated<Project>> {
  // Real API call
  const params = new URLSearchParams();
  params.set('view', filters?.view || 'pitching');
  if (filters?.view === 'matching' && userId) {
    params.set('userId', userId);
  }

  const res = await fetch(`${API_BASE}/projects?${params.toString()}`);
  const data = await handleResponse<{ projects: any[] }>(res);
  // Return in expected format
  return {
    data: data.projects,
    pagination: {
      page,
      limit,
      total: data.projects.length,
      totalPages: 1,
    },
  };
}

export async function getUserProjects(userId: string, type: 'pitched' | 'matched'): Promise<Project[]> {
  if (type === 'pitched') {
    const res = await fetch(`${API_BASE}/matches/pitched?owner_id=${userId}`);
    const data = await handleResponse<{ projects: { project: any; matches: any[] }[] }>(res);
    return data.projects.map(({ project, matches }) => ({
      id: String(project.project_id),
      title: project.title,
      description: project.description,
      techStack: project.required_skills ?? [],
      status: 'pitching',
      authorId: String(project.owner_id),
      applicants: matches.map((m) => ({
        userId: String(m.recommended_user_id),
        user: {
          id: String(m.recommended_user_id),
          name: m.recommended_user_name,
          email: m.recommended_user_email,
          skills: m.recommended_user_skills ?? [],
        },
        roleId: m.required_skill ?? 'general',
        status: m.user_decision === 'accepted' ? 'accepted' : 'pending',
        appliedAt: new Date(m.created_at),
      })),
      collaborators: [],
      required_skills: project.required_skills,
    }));
  }

  const res = await fetch(`${API_BASE}/matches/assigned?user_id=${userId}`);
  const data = await handleResponse<{ matches: any[] }>(res);
  return data.matches.map((match) => ({
    id: String(match.project_id),
    title: match.project_title,
    description: match.project_description,
    techStack: match.project_required_skills ?? [],
    status: 'matching',
    authorId: String(match.owner_id ?? match.project_owner_id ?? ''),
    author: {
      id: String(match.owner_id ?? match.project_owner_id ?? ''),
      name: match.project_owner_name ?? 'Owner',
      email: match.project_owner_email ?? '',
      skills: [],
    },
    applicants: [],
    collaborators: [],
  }));
}

export async function updateApplicationStatus(
  matchId: string,
  actor: 'owner' | 'user',
  decision: 'accepted' | 'rejected',
  reason?: Record<string, any>
): Promise<void> {
  const endpoint = `${API_BASE}/matches/${matchId}/${actor}`;
  const res = await fetch(endpoint, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision, reason }),
  });
  await handleResponse(res);
}

export async function getProject(id: string): Promise<Project> {
  const project = mockProjects.find(p => p.id === id);
  if (!project) {
    throw new Error('Project not found');
  }
  return project;
}