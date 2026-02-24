'use client';

import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, Award, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getInitials } from '@/lib/utils';
import type { LeaderboardEntry } from '@/types';
import { API_BASE } from '@/lib/api/base';

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Trophy className="h-6 w-6 text-yellow-500" />;
    case 2:
      return <Medal className="h-6 w-6 text-gray-400" />;
    case 3:
      return <Award className="h-6 w-6 text-amber-600" />;
    default:
      return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
  }
};

const getRankColor = (rank: number) => {
  switch (rank) {
    case 1:
      return 'border-yellow-200 bg-yellow-50';
    case 2:
      return 'border-gray-200 bg-gray-50';
    case 3:
      return 'border-amber-200 bg-amber-50';
    default:
      return '';
  }
};

export default function LeaderboardPage() {
  const { data: leaderboard, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      const response = await fetch(`${API_BASE}/leaderboard`);
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard data');
      }
      const result = await response.json();
      return result.leaderboard || [];
    },
  });
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Leaderboard</h1>
          <p className="text-muted-foreground">
            Top performers in Konverge community
          </p>
        </div>
        
        <div className="space-y-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 p-6">
                <Skeleton className="h-6 w-6" />
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Leaderboard</h1>
          <p className="text-red-600">
            Failed to load leaderboard data. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Leaderboard</h1>
          <p className="text-muted-foreground">
            No active users found. Be the first to start collaborating!
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Leaderboard</h1>
        <p className="text-muted-foreground">
          Top performers in Konverge community - Ranked by engagement score
        </p>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3 space-y-4">
          {leaderboard?.map((entry, index) => (
            <Card key={entry.user.id} className={getRankColor(entry.rank)}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="flex-shrink-0">
                  {getRankIcon(entry.rank)}
                </div>
                
                <Avatar className="h-12 w-12">
                  {entry.user.avatar ? (
                    <AvatarImage src={entry.user.avatar} alt={entry.user.name} />
                  ) : (
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                      {getInitials(entry.user.name)}
                    </AvatarFallback>
                  )}
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg">{entry.user.name}</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {entry.user.skills.slice(0, 3).map((skill, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {entry.user.skills.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{entry.user.skills.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {entry.points.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">points</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Top Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Most Projects</div>
                <div className="text-lg font-semibold">
                  {Math.max(...(leaderboard?.map(e => e.projectsCompleted) || []))} completed
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Highest Score</div>
                <div className="text-lg font-semibold">
                  {Math.max(...(leaderboard?.map(e => e.collaborationScore) || []))}⭐
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Top Points</div>
                <div className="text-lg font-semibold">
                  {Math.max(...(leaderboard?.map(e => e.points) || [])).toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Badge Achievements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col space-y-4">
                {/* First Collaboration Badge */}
                <div className="flex flex-col gap-3 p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-100">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">🤝</span>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm">First Collaboration</h4>
                      <p className="text-xs text-muted-foreground">Complete your first project</p>
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-white/80 rounded-md border border-blue-200 text-center">
                    <span className="text-xs text-blue-700 font-medium">Unlocked when you complete your first project</span>
                  </div>
                </div>
                
                {/* Team Player Badge */}
                <div className="flex flex-col gap-3 p-4 border rounded-lg bg-gradient-to-r from-green-50 to-emerald-100">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">🏆</span>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm">Team Player</h4>
                      <p className="text-xs text-muted-foreground">Complete 5+ collaborative projects</p>
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-white/80 rounded-md border border-green-200 text-center">
                    <span className="text-xs text-green-700 font-medium">For dedicated team contributors</span>
                  </div>
                </div>
                
                {/* Top Rated Badge */}
                <div className="flex flex-col gap-3 p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-pink-100">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">⭐</span>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm">Top Rated</h4>
                      <p className="text-xs text-muted-foreground">Maintain 4.5+ average rating</p>
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-white/80 rounded-md border border-purple-200 text-center">
                    <span className="text-xs text-purple-700 font-medium">For consistently high-quality collaborators</span>
                  </div>
                </div>
                
                {/* Super Engaged Badge */}
                <div className="flex flex-col gap-3 p-4 border rounded-lg bg-gradient-to-r from-yellow-50 via-orange-200 to-red-100">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">🔥</span>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm">Super Engaged</h4>
                      <p className="text-xs text-muted-foreground">Earn 100+ engagement points</p>
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-white/80 rounded-md border border-orange-200 text-center">
                    <span className="text-xs text-orange-700 font-medium">For most active community members</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}