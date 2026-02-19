'use client';

import { useQuery } from '@tanstack/react-query';
import { Trophy, Medal, Award, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { mockLeaderboard } from '@/lib/api/mock-data';
import { getInitials } from '@/lib/utils';
import type { LeaderboardEntry } from '@/types';

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
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async (): Promise<LeaderboardEntry[]> => {
      // Mock API call
      return new Promise(resolve => 
        setTimeout(() => resolve(mockLeaderboard), 500)
      );
    },
  });
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Leaderboard</h1>
          <p className="text-muted-foreground">
            Top performers in the Konverge community
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
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Leaderboard</h1>
        <p className="text-muted-foreground">
          Top performers in the Konverge community
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
                  <AvatarImage src={entry.user.avatar} alt={entry.user.name} />
                  <AvatarFallback>{getInitials(entry.user.name)}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg">{entry.user.name}</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {entry.badges.slice(0, 3).map((badge) => (
                      <Badge key={badge.id} variant="outline" className="text-xs">
                        {badge.icon} {badge.name}
                      </Badge>
                    ))}
                    {entry.badges.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{entry.badges.length - 3} more
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
              <CardTitle>Badge Rarities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">🎖️ Common</span>
                <Badge variant="outline">Basic achievements</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">🏅 Rare</span>
                <Badge variant="secondary">Special skills</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">🏆 Epic</span>
                <Badge variant="default">Major milestones</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">👑 Legendary</span>
                <Badge className="bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-400 text-white">
                  Elite status
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}