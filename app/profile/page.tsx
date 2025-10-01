'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard as Edit, MapPin, Link as LinkIcon, Calendar, Star, Check, X, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/auth-store';
import { getUserProjects, updateApplicationStatus } from '@/lib/api/projects';
import { getInitials, formatDate, calculateProfileCompleteness } from '@/lib/utils';
import type { Project } from '@/types';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [activeProjectTab, setActiveProjectTab] = useState<'pitched' | 'matched'>('pitched');
  
  const { data: pitchedProjects, isLoading: pitchedLoading } = useQuery({
    queryKey: ['user-projects', user?.id, 'pitched'],
    queryFn: () => getUserProjects(user?.id!, 'pitched'),
    enabled: !!user,
  });
  
  const { data: matchedProjects, isLoading: matchedLoading } = useQuery({
    queryKey: ['user-projects', user?.id, 'matched'],
    queryFn: () => getUserProjects(user?.id!, 'matched'),
    enabled: !!user,
  });
  
  const handleApplicationAction = async (projectId: string, userId: string, action: 'accepted' | 'rejected') => {
    try {
      await updateApplicationStatus(projectId, userId, action);
      // Refetch projects to update UI
      // In a real app, you'd use query invalidation
      window.location.reload();
    } catch (error) {
      console.error('Failed to update application:', error);
    }
  };
  
  const handleChatClick = (userId: string) => {
    // TODO: Open chat with user
    console.log('Open chat with user:', userId);
  };
  
  if (!user) return null;
  
  const completeness = calculateProfileCompleteness(user);
  
  const ProjectsList = ({ projects, loading, type }: { projects?: Project[], loading: boolean, type: 'pitched' | 'matched' }) => {
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
            {type === 'pitched' 
              ? 'You haven\'t pitched any projects yet.'
              : 'You haven\'t collaborated on any projects yet.'
            }
          </p>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">{project.title}</h3>
                  <p className="text-muted-foreground text-sm mb-3">{project.description}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {project.techStack.map((tech) => (
                      <Badge key={tech} variant="outline" className="text-xs">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Badge variant={project.status === 'completed' ? 'default' : 'secondary'}>
                  {project.status.replace('-', ' ')}
                </Badge>
              </div>
              
              {type === 'pitched' && project.applicants.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Applications</h4>
                  {project.applicants.map((application) => (
                    <div key={application.userId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={application.user.avatar} alt={application.user.name} />
                          <AvatarFallback>{getInitials(application.user.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{application.user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Applied {formatDate(application.appliedAt)}
                          </p>
                        </div>
                      </div>
                      
                      {application.status === 'pending' ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleChatClick(application.userId)}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApplicationAction(project.id, application.userId, 'accepted')}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApplicationAction(project.id, application.userId, 'rejected')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant={application.status === 'accepted' ? 'default' : 'destructive'}>
                            {application.status}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleChatClick(application.userId)}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {type === 'pitched' && project.collaborators.length > 0 && (
                <div className="space-y-3 mt-4">
                  <h4 className="font-medium">Collaborators</h4>
                  <div className="flex flex-wrap gap-2">
                    {project.collaborators.map((collaborator) => (
                      <div key={collaborator.id} className="flex items-center gap-2 p-2 border rounded-lg">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={collaborator.avatar} alt={collaborator.name} />
                          <AvatarFallback>{getInitials(collaborator.name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{collaborator.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleChatClick(collaborator.id)}
                        >
                          <MessageCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {type === 'matched' && (
                <div className="space-y-3">
                  <h4 className="font-medium">Project Team</h4>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={project.author.avatar} alt={project.author.name} />
                      <AvatarFallback>{getInitials(project.author.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{project.author.name}</p>
                      <p className="text-xs text-muted-foreground">Project Owner</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleChatClick(project.author.id)}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {project.collaborators.filter(c => c.id !== user.id).map((collaborator) => (
                    <div key={collaborator.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={collaborator.avatar} alt={collaborator.name} />
                        <AvatarFallback>{getInitials(collaborator.name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{collaborator.name}</p>
                        <p className="text-xs text-muted-foreground">Collaborator</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleChatClick(collaborator.id)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold">Profile</h1>
        <Button onClick={() => setIsEditing(!isEditing)} variant="outline" className="gap-2">
          <Edit className="h-4 w-4" />
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </Button>
      </div>
      
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="text-xl">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{user.name}</h2>
                  <p className="text-muted-foreground">{user.email}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Joined {formatDate(user.joinedAt)}
                    </div>
                    <Badge
                      variant={
                        user.availability === 'available' ? 'default' :
                        user.availability === 'busy' ? 'destructive' :
                        'secondary'
                      }
                    >
                      {user.availability}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {user.bio && (
                <div>
                  <h3 className="font-semibold mb-2">Bio</h3>
                  <p className="text-muted-foreground">{user.bio}</p>
                </div>
              )}
              
              <div>
                <h3 className="font-semibold mb-2">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {user.skills.map((skill) => (
                    <Badge key={skill} variant="outline">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {user.links && (
                <div>
                  <h3 className="font-semibold mb-2">Links</h3>
                  <div className="space-y-2">
                    {user.links.github && (
                      <a
                        href={user.links.github}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <LinkIcon className="h-4 w-4" />
                        GitHub
                      </a>
                    )}
                    {user.links.linkedin && (
                      <a
                        href={user.links.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <LinkIcon className="h-4 w-4" />
                        LinkedIn
                      </a>
                    )}
                    {user.links.portfolio && (
                      <a
                        href={user.links.portfolio}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <LinkIcon className="h-4 w-4" />
                        Portfolio
                      </a>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* My Projects */}
          <Card>
            <CardHeader>
              <CardTitle>My Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeProjectTab} onValueChange={(value) => setActiveProjectTab(value as 'pitched' | 'matched')}>
                <TabsList className="grid w-full grid-cols-2 max-w-md mb-6">
                  <TabsTrigger value="pitched">Pitched</TabsTrigger>
                  <TabsTrigger value="matched">Matched</TabsTrigger>
                </TabsList>
                
                <TabsContent value="pitched">
                  <ProjectsList 
                    projects={pitchedProjects} 
                    loading={pitchedLoading} 
                    type="pitched" 
                  />
                </TabsContent>
                
                <TabsContent value="matched">
                  <ProjectsList 
                    projects={matchedProjects} 
                    loading={matchedLoading} 
                    type="matched" 
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          {/* Badges */}
          <Card>
            <CardHeader>
              <CardTitle>Badges & Achievements</CardTitle>
            </CardHeader>
            <CardContent>
              {user.badges.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {user.badges.map((badge) => (
                    <div
                      key={badge.id}
                      className="flex flex-col items-center text-center p-4 border rounded-lg"
                    >
                      <div className="text-3xl mb-2">{badge.icon}</div>
                      <h4 className="font-semibold text-sm">{badge.name}</h4>
                      <p className="text-xs text-muted-foreground">{badge.description}</p>
                      <Badge
                        className="mt-2"
                        variant={
                          badge.rarity === 'legendary' ? 'default' :
                          badge.rarity === 'epic' ? 'destructive' :
                          badge.rarity === 'rare' ? 'secondary' :
                          'outline'
                        }
                      >
                        {badge.rarity}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Star className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold">No badges yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Complete projects and contribute to earn your first badge!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          {/* Profile Completeness */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Completeness</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-sm text-muted-foreground">{completeness}%</span>
                </div>
                <Progress value={completeness} className="h-2" />
              </div>
              
              <div className="text-sm text-muted-foreground">
                {completeness < 100 && (
                  <p>Complete your profile to get better matches and increase visibility.</p>
                )}
                {completeness === 100 && (
                  <p>Great job! Your profile is complete.</p>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Points</span>
                <span className="font-semibold">{user.points.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Projects</span>
                <span className="font-semibold">6</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Collaborations</span>
                <span className="font-semibold">12</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Rating</span>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">4.8</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start">
                View My Projects
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Find Collaborators
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Update Availability
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}