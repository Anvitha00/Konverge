import type { User, Project, Match, Thread, Message, Badge, LeaderboardEntry } from '@/types';
import { generateId } from '@/lib/utils';

export const mockUsers: User[] = [
  {
    id: '1',
    email: 'alice@example.com',
    name: 'Alice Chen',
    avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
    skills: ['React', 'Node.js', 'TypeScript', 'GraphQL'],
    availability: 'available',
    bio: 'Full-stack developer passionate about building scalable web applications.',
    links: {
      github: 'https://github.com/alicechen',
      linkedin: 'https://linkedin.com/in/alicechen'
    },
    badges: [],
    points: 1250,
    joinedAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    email: 'bob@example.com',
    name: 'Bob Martinez',
    avatar: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
    skills: ['Python', 'Django', 'PostgreSQL', 'Docker'],
    availability: 'busy',
    bio: 'Backend engineer with 5+ years experience in API development.',
    links: {
      github: 'https://github.com/bobmartinez'
    },
    badges: [],
    points: 980,
    joinedAt: new Date('2024-02-01'),
  },
  {
    id: '3',
    email: 'sarah@example.com',
    name: 'Sarah Kim',
    avatar: 'https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop',
    skills: ['UI/UX Design', 'Figma', 'React', 'Tailwind CSS'],
    availability: 'available',
    bio: 'Product designer who loves to code. Bridging the gap between design and development.',
    links: {
      portfolio: 'https://sarahkim.design'
    },
    badges: [],
    points: 1500,
    joinedAt: new Date('2023-12-10'),
  },
];

export const mockProjects: Project[] = [
  {
    id: '1',
    title: 'EcoTrack - Carbon Footprint Tracker',
    description: 'A mobile-first web app to help individuals track and reduce their carbon footprint through daily activities.',
    problem: 'People want to be environmentally conscious but lack easy tools to track their impact.',
    goals: ['Track daily activities', 'Calculate carbon footprint', 'Suggest eco-friendly alternatives'],
    techStack: ['Next.js', 'React Native', 'Node.js', 'PostgreSQL'],
    status: 'pitching',
    authorId: '1',
    author: mockUsers[0],
    roles: [
      {
        id: '1',
        title: 'Frontend Developer',
        description: 'Build responsive UI with React and Next.js',
        skills: ['React', 'Next.js', 'TypeScript'],
        commitment: 'part-time',
        filled: false,
        applicants: [],
      },
      {
        id: '2',
        title: 'Backend Developer',
        description: 'Design and implement REST APIs',
        skills: ['Node.js', 'PostgreSQL', 'Express'],
        commitment: 'part-time',
        filled: false,
        applicants: [mockUsers[1]],
      },
    ],
    collaborators: [],
    applicants: [
      {
        userId: '2',
        user: mockUsers[1],
        roleId: '2',
        status: 'pending',
        appliedAt: new Date('2024-03-02'),
      }
    ],
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-01'),
    deadline: new Date('2024-06-01'),
    commitment: 'part-time',
  },
  {
    id: '2',
    title: 'DevMentor - Peer Learning Platform',
    description: 'Connect junior developers with experienced mentors for structured learning paths.',
    problem: 'Junior developers struggle to find quality mentorship and structured learning.',
    goals: ['Match mentors with mentees', 'Create learning paths', 'Track progress'],
    techStack: ['React', 'Python', 'FastAPI', 'MongoDB'],
    status: 'matching',
    authorId: '3',
    author: mockUsers[2],
    roles: [
      {
        id: '3',
        title: 'UX Designer',
        description: 'Design user-friendly interface for mentor-mentee interactions',
        skills: ['Figma', 'User Research', 'Prototyping'],
        commitment: 'weekend',
        filled: true,
        applicants: [],
      },
    ],
    collaborators: [mockUsers[0]],
    applicants: [],
    createdAt: new Date('2024-02-15'),
    updatedAt: new Date('2024-03-05'),
    commitment: 'weekend',
  },
  {
    id: '3',
    title: 'TaskFlow - Project Management Tool',
    description: 'A modern project management tool with real-time collaboration features.',
    problem: 'Teams need better tools for managing complex projects with multiple stakeholders.',
    goals: ['Real-time collaboration', 'Task automation', 'Progress tracking'],
    techStack: ['Vue.js', 'Node.js', 'Socket.io', 'Redis'],
    status: 'pitching',
    authorId: '2',
    author: mockUsers[1],
    roles: [
      {
        id: '4',
        title: 'Frontend Developer',
        description: 'Build responsive Vue.js interface',
        skills: ['Vue.js', 'TypeScript', 'CSS'],
        commitment: 'part-time',
        filled: false,
        applicants: [],
      },
    ],
    collaborators: [],
    applicants: [],
    createdAt: new Date('2024-03-10'),
    updatedAt: new Date('2024-03-10'),
    commitment: 'part-time',
  },
];

export const mockMatches: Match[] = [
  {
    id: '1',
    projectId: '1',
    userId: '2',
    roleId: '2',
    score: 85,
    reasons: ['Skills match: Node.js, PostgreSQL', 'Available part-time', 'Similar project experience'],
    status: 'pending',
    createdAt: new Date('2024-03-02'),
    project: mockProjects[0]!,
    user: mockUsers[1]!,
    role: mockProjects[0]!.roles![1],
  },
];

export const mockThreads: Thread[] = [
  {
    id: '1',
    participants: [mockUsers[0], mockUsers[1]],
    lastMessage: {
      id: '1',
      threadId: '1',
      senderId: '1',
      content: 'Hi Bob! I saw your interest in the backend role for EcoTrack. Would you like to discuss the project details?',
      type: 'text',
      createdAt: new Date('2024-03-03T10:00:00Z'),
      sender: mockUsers[0],
      readBy: ['1'],
    },
    updatedAt: new Date('2024-03-03T10:00:00Z'),
    unreadCount: 1,
    title: 'EcoTrack Backend Discussion',
    projectId: '1',
  },
];

export const mockMessages: Message[] = [
  {
    id: '1',
    threadId: '1',
    senderId: '1',
    content: 'Hi Bob! I saw your interest in the backend role for EcoTrack. Would you like to discuss the project details?',
    type: 'text',
    createdAt: new Date('2024-03-03T10:00:00Z'),
    sender: mockUsers[0],
    readBy: ['1'],
  },
  {
    id: '2',
    threadId: '1',
    senderId: '2',
    content: 'Hi Alice! Yes, I\'m definitely interested. The project sounds exciting. Could you tell me more about the expected time commitment?',
    type: 'text',
    createdAt: new Date('2024-03-03T10:15:00Z'),
    sender: mockUsers[1],
    readBy: ['1', '2'],
  },
];

export const mockBadges: Badge[] = [
  {
    id: '1',
    name: 'First Collaboration',
    description: 'Completed your first collaborative project',
    icon: '🤝',
    rarity: 'common',
  },
  {
    id: '2',
    name: 'Code Reviewer',
    description: 'Provided 10+ code reviews',
    icon: '👁️',
    rarity: 'rare',
  },
  {
    id: '3',
    name: 'Mentor',
    description: 'Mentored 5+ junior developers',
    icon: '🎓',
    rarity: 'epic',
  },
];

export const mockLeaderboard: LeaderboardEntry[] = [
  {
    user: mockUsers[2],
    rank: 1,
    points: 1500,
    badges: [mockBadges[0], mockBadges[2]],
    projectsCompleted: 8,
    collaborationScore: 4.9,
  },
  {
    user: mockUsers[0],
    rank: 2,
    points: 1250,
    badges: [mockBadges[0], mockBadges[1]],
    projectsCompleted: 6,
    collaborationScore: 4.7,
  },
  {
    user: mockUsers[1],
    rank: 3,
    points: 980,
    badges: [mockBadges[0]],
    projectsCompleted: 4,
    collaborationScore: 4.5,
  },
];