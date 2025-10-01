import type { Match } from '@/types';
import { mockMatches } from './mock-data';

export async function getMatches(projectId?: string, userId?: string): Promise<Match[]> {
  let matches = [...mockMatches];
  
  if (projectId) {
    matches = matches.filter(m => m.projectId === projectId);
  }
  
  if (userId) {
    matches = matches.filter(m => m.userId === userId);
  }
  
  return matches;
}

export async function updateMatchStatus(matchId: string, status: Match['status']): Promise<Match> {
  const match = mockMatches.find(m => m.id === matchId);
  if (!match) {
    throw new Error('Match not found');
  }
  
  match.status = status;
  return match;
}