'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectCard } from './project-card';
import { ProjectFilters } from './project-filters';
import { Skeleton } from '@/components/ui/skeleton';
import { getProjects } from '@/lib/api/projects';
import { useAuthStore } from '@/store/auth-store';
import type { ProjectFilters as ProjectFiltersType } from '@/types';

export function ProjectList() {
  const [page, setPage] = useState(1);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [filters, setFilters] = useState<ProjectFiltersType>({});
  const [activeView, setActiveView] = useState<'pitching' | 'matching'>('pitching');
  const { user } = useAuthStore();
  
  const { ref, inView } = useInView({
    threshold: 0,
  });
  
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['projects', { ...filters, view: activeView }, page, user?.id],
    queryFn: () => getProjects({ ...filters, view: activeView }, page, 10, user?.id),
  });
  
  useEffect(() => {
    if (data?.data) {
      if (page === 1) {
        setAllProjects(data.data);
      } else {
        setAllProjects(prev => [...prev, ...data.data]);
      }
    }
  }, [data, page]);
  
  useEffect(() => {
    const pag = data?.pagination;
    if (inView && pag && (pag.page ?? 0) < (pag.totalPages ?? 0) && !isFetching) {
      setPage(prev => prev + 1);
    }
  }, [inView, data?.pagination, isFetching]);
  
  useEffect(() => {
    setPage(1);
    setAllProjects([]);
  }, [filters, activeView]);
  
  const handleViewChange = (view: string) => {
    setActiveView(view as 'pitching' | 'matching');
    setPage(1);
    setAllProjects([]);
  };
  
  if (isLoading && page === 1) {
    return (
      <div className="space-y-6">
        <Tabs value={activeView} onValueChange={handleViewChange}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="pitching">Pitching Projects</TabsTrigger>
            <TabsTrigger value="matching">Matching Projects</TabsTrigger>
          </TabsList>
        </Tabs>
        <ProjectFilters onFiltersChange={setFilters} />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-4 rounded-lg border p-6">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <Tabs value={activeView} onValueChange={handleViewChange}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="pitching">Pitching Projects</TabsTrigger>
          <TabsTrigger value="matching">Matching Projects</TabsTrigger>
        </TabsList>
      </Tabs>
      
      <ProjectFilters onFiltersChange={setFilters} />
      
      {allProjects.length === 0 && !isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {activeView === 'matching' 
              ? 'No matching projects found. Apply to projects in the Pitching tab to see them here.'
              : 'No projects found matching your criteria.'
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {allProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
      
      {/* Infinite scroll trigger */}
      <div ref={ref} className="h-10">
        {isFetching && page > 1 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-4 rounded-lg border p-6">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}