// components/projects/project-card.tsx
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, Users } from "lucide-react";
import { formatProjectDate } from "@/lib/utils/date";

interface ProjectCardProps {
  project: {
    project_id: number;
    title: string;
    description: string;
    required_skills: string[];
    status: string;
    owner_name?: string;
    owner_email?: string;
    roles_available?: number;
    created_at?: string | Date;
  };
  onDiscussClick?: () => void;
}

export function ProjectCard({ project, onDiscussClick }: ProjectCardProps) {
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: any }> = {
      Open: { label: "Open", variant: "default" },
      "In Progress": { label: "In Progress", variant: "secondary" },
      Completed: { label: "Completed", variant: "outline" },
    };
    return statusMap[status] || { label: status, variant: "secondary" };
  };

  const statusBadge = getStatusBadge(project.status);
  const rolesOpen = project.roles_available ?? 0;
  const projectDate = formatProjectDate(project.created_at);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold">{project.title}</h3>
              <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {project.description}
            </p>
          </div>
        </div>

        {/* Owner info */}
        {project.owner_name && (
          <div className="flex items-center gap-2 mb-3">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">
                {project.owner_name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">
              {project.owner_name}
            </span>
            <span className="text-xs text-muted-foreground">
              • {projectDate}
            </span>
          </div>
        )}

        {/* Skills */}
        {project.required_skills && project.required_skills.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {project.required_skills.slice(0, 4).map((skill, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
            {project.required_skills.length > 4 && (
              <Badge variant="outline" className="text-xs">
                +{project.required_skills.length - 4} more
              </Badge>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>
                {rolesOpen} {rolesOpen === 1 ? "role" : "roles"} open
              </span>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={onDiscussClick}>
            Discussion
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
