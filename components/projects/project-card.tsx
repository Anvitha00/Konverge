'use client';

import Link from 'next/link';
import { Calendar, Clock, Users, MessageCircle, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Project } from '@/types';
import { formatRelativeTime, getInitials, truncate } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';

interface ProjectCardProps {
  project: Project;
  viewType?: 'pitching' | 'matching';
}

export function ProjectCard({ project, viewType }: ProjectCardProps) {
  const availableRoles = project.roles.filter(role => !role.filled);
  const { user } = useAuthStore();
  
  const handleDiscussionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // TODO: Open discussion modal or navigate to discussion page
    console.log('Open discussion for project:', project.id);
  };
  
  const handleChatClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // TODO: Open chat with project owner
    console.log('Open chat with project owner:', project.author.id);
  };
  
  return (
    <Card className="group hover:shadow-md transition-shadow duration-200">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <Link 
              href={`/projects/${project.id}`}
              className="block text-lg font-semibold leading-tight group-hover:text-primary transition-colors"
            >
              {project.title}
            </Link>
            <p className="text-sm text-muted-foreground">
              {truncate(project.description, 120)}
            </p>
          </div>
          <Badge
            variant={
              project.status === 'pitching' ? 'default' :
              project.status === 'matching' ? 'secondary' :
              project.status === 'in-progress' ? 'outline' :
              'secondary'
            }
          >
            {project.status.replace('-', ' ')}
          </Badge>
        </div>
        
        <div className="flex items-center gap-3">
          <Avatar className="h-6 w-6">
            <AvatarImage src={project.author.avatar} alt={project.author.name} />
            <AvatarFallback>{getInitials(project.author.name)}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">
            {project.author.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(project.createdAt)}
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div>
          <div className="flex flex-wrap gap-1 mb-2">
            {project.techStack.slice(0, 4).map((tech) => (
              <Badge key={tech} variant="outline" className="text-xs">
                {tech}
              </Badge>
            ))}
            {project.techStack.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{project.techStack.length - 4}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span className="capitalize">{project.commitment.replace('-', ' ')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{availableRoles.length} role{availableRoles.length !== 1 ? 's' : ''} open</span>
          </div>
        </div>
        
        {project.deadline && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Due {formatRelativeTime(project.deadline)}</span>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-0">
        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDiscussionClick}
            className="flex-1 gap-1"
          >
            <MessageSquare className="h-4 w-4" />
            Discussion
          </Button>
          
          {viewType === 'matching' && project.author.id !== user?.id && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleChatClick}
              className="flex-1 gap-1"
            >
              <MessageCircle className="h-4 w-4" />
              Chat Owner
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}