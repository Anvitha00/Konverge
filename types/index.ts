export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  skills: string[];
  availability: 'available' | 'busy' | 'away';
  bio?: string;
  links?: {
    github?: string;
    linkedin?: string;
    portfolio?: string;
  };
  badges: Badge[];
  points: number;
  joinedAt: Date;
}

export interface Profile extends User {
  completeness: number;
  timezone?: string;
  preferredRoles: string[];
}

export interface Project {
  id: string;
  title: string;
  description: string;
  problem: string;
  goals: string[];
  techStack: string[];
  status: 'pitching' | 'matching' | 'in-progress' | 'completed';
  authorId: string;
  author: User;
  roles: RoleRequirement[];
  collaborators: User[];
  applicants: Array<{
    userId: string;
    user: User;
    roleId: string;
    status: 'pending' | 'accepted' | 'rejected';
    appliedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
  deadline?: Date;
  commitment: 'part-time' | 'full-time' | 'weekend' | 'flexible';
}

export interface RoleRequirement {
  id: string;
  title: string;
  description: string;
  skills: string[];
  commitment: string;
  filled: boolean;
  applicants: User[];
}

export interface Match {
  id: string;
  projectId: string;
  userId: string;
  roleId: string;
  score: number;
  reasons: string[];
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  project: Project;
  user: User;
  role: RoleRequirement;
}

export interface Discussion {
  id: string;
  projectId: string;
  messages: DiscussionMessage[];
  participants: User[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscussionMessage {
  id: string;
  discussionId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  sender: User;
}

export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  type: 'text' | 'system' | 'image';
  createdAt: Date;
  sender: User;
  readBy: string[];
}

export interface Thread {
  id: string;
  participants: User[];
  lastMessage?: Message;
  updatedAt: Date;
  unreadCount: number;
  title?: string;
  projectId?: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earnedAt?: Date;
}

export interface LeaderboardEntry {
  user: User;
  rank: number;
  points: number;
  badges: Badge[];
  projectsCompleted: number;
  collaborationScore: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProjectFilters {
  search?: string;
  skills?: string[];
  commitment?: string[];
  status?: string[];
  view?: 'pitching' | 'matching';
}