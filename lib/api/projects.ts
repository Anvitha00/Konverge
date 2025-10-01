import type { Project, Paginated, ProjectFilters } from '@/types';
import { mockProjects } from './mock-data';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export async function getProjects(
  filters?: ProjectFilters,
  page = 1,
  limit = 10,
  userId?: string
): Promise<Paginated<Project>> {
  // Mock implementation - replace with real API calls
  let filteredProjects = [...mockProjects];
  
  // Filter by view type
  if (filters?.view === 'matching' && userId) {
    // For matching view, show projects where user has matches or applied
    filteredProjects = filteredProjects.filter(p => 
      p.applicants.some(app => app.userId === userId) ||
      mockMatches.some(m => m.userId === userId && m.projectId === p.id)
    );
  } else if (filters?.view === 'pitching') {
    // For pitching view, show all projects
    filteredProjects = filteredProjects.filter(p => p.status === 'pitching' || p.status === 'matching');
  }
  
  if (filters?.search) {
    const search = filters.search.toLowerCase();
    filteredProjects = filteredProjects.filter(
      p => p.title.toLowerCase().includes(search) ||
           p.description.toLowerCase().includes(search)
    );
  }
  
  if (filters?.skills?.length) {
    filteredProjects = filteredProjects.filter(
      p => filters.skills!.some(skill => 
        p.techStack.some(tech => tech.toLowerCase().includes(skill.toLowerCase()))
      )
    );
  }
  
  if (filters?.status?.length) {
    filteredProjects = filteredProjects.filter(
      p => filters.status!.includes(p.status)
    );
  }
  
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedData = filteredProjects.slice(startIndex, endIndex);
  
  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      total: filteredProjects.length,
      totalPages: Math.ceil(filteredProjects.length / limit),
    },
  };
}

export async function getUserProjects(userId: string, type: 'pitched' | 'matched'): Promise<Project[]> {
  if (type === 'pitched') {
    return mockProjects.filter(p => p.authorId === userId);
  } else {
    // Projects where user is a collaborator
    return mockProjects.filter(p => 
      p.collaborators.some(c => c.id === userId) ||
      p.applicants.some(app => app.userId === userId && app.status === 'accepted')
    );
  }
}

export async function updateApplicationStatus(
  projectId: string, 
  userId: string, 
  status: 'accepted' | 'rejected'
): Promise<void> {
  const project = mockProjects.find(p => p.id === projectId);
  if (project) {
    const application = project.applicants.find(app => app.userId === userId);
    if (application) {
      application.status = status;
      if (status === 'accepted') {
        const user = application.user;
        if (!project.collaborators.find(c => c.id === userId)) {
          project.collaborators.push(user);
        }
      }
    }
  }
}

export async function getProject(id: string): Promise<Project> {
  const project = mockProjects.find(p => p.id === id);
  if (!project) {
    throw new Error('Project not found');
  }
  return project;
}

export async function createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'author' | 'collaborators'>): Promise<Project> {
  // Mock implementation
  const newProject: Project = {
    ...project,
    id: Math.random().toString(36).substring(2),
    createdAt: new Date(),
    updatedAt: new Date(),
    author: mockProjects[0].author, // Mock author
    collaborators: [],
  };
  
  mockProjects.unshift(newProject);
  return newProject;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  const index = mockProjects.findIndex(p => p.id === id);
  if (index === -1) {
    throw new Error('Project not found');
  }
  
  mockProjects[index] = {
    ...mockProjects[index],
    ...updates,
    updatedAt: new Date(),
  };
  
  return mockProjects[index];
}