'use client';

import { ProjectList } from '@/components/projects/project-list';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useUIStore } from '@/store/ui-store';

export default function ProjectsPage() {
  const { setProjectFormOpen } = useUIStore();
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Discover Projects</h1>
          <p className="text-muted-foreground">
            Find exciting projects and collaborate with talented developers
          </p>
        </div>
        <Button onClick={() => setProjectFormOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Pitch Project</span>
        </Button>
      </div>
      
      <ProjectList />
    </div>
  );
}