'use client';

import { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import type { ProjectFilters } from '@/types';

interface ProjectFiltersProps {
  onFiltersChange: (filters: ProjectFilters) => void;
}

const TECH_SKILLS = [
  'React', 'Node.js', 'TypeScript', 'Python', 'GraphQL',
  'PostgreSQL', 'MongoDB', 'Docker', 'AWS', 'Next.js',
  'Vue.js', 'Django', 'Ruby on Rails', 'Go', 'Rust'
];

const COMMITMENT_OPTIONS = [
  'part-time', 'full-time', 'weekend', 'flexible'
];

const STATUS_OPTIONS = [
  'pitching', 'matching', 'in-progress', 'completed'
];

export function ProjectFilters({ onFiltersChange }: ProjectFiltersProps) {
  const [search, setSearch] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedCommitments, setSelectedCommitments] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  
  const applyFilters = () => {
    onFiltersChange({
      search: search || undefined,
      skills: selectedSkills.length > 0 ? selectedSkills : undefined,
      commitment: selectedCommitments.length > 0 ? selectedCommitments : undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
    });
  };
  
  const clearFilters = () => {
    setSearch('');
    setSelectedSkills([]);
    setSelectedCommitments([]);
    setSelectedStatuses([]);
    onFiltersChange({});
  };
  
  const hasFilters = search || selectedSkills.length > 0 || 
    selectedCommitments.length > 0 || selectedStatuses.length > 0;
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Skills
                {selectedSkills.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedSkills.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h4 className="font-medium">Skills</h4>
                <div className="grid grid-cols-2 gap-2">
                  {TECH_SKILLS.map((skill) => (
                    <label key={skill} className="flex items-center space-x-2">
                      <Checkbox
                        checked={selectedSkills.includes(skill)}
                        onCheckedChange={(checked) => {
                          setSelectedSkills(prev =>
                            checked
                              ? [...prev, skill]
                              : prev.filter(s => s !== skill)
                          );
                        }}
                      />
                      <span className="text-sm">{skill}</span>
                    </label>
                  ))}
                </div>
                <Button onClick={applyFilters} size="sm" className="w-full">
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Commitment
                {selectedCommitments.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {selectedCommitments.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60">
              <div className="space-y-4">
                <h4 className="font-medium">Commitment</h4>
                <div className="space-y-2">
                  {COMMITMENT_OPTIONS.map((commitment) => (
                    <label key={commitment} className="flex items-center space-x-2">
                      <Checkbox
                        checked={selectedCommitments.includes(commitment)}
                        onCheckedChange={(checked) => {
                          setSelectedCommitments(prev =>
                            checked
                              ? [...prev, commitment]
                              : prev.filter(c => c !== commitment)
                          );
                        }}
                      />
                      <span className="text-sm capitalize">{commitment.replace('-', ' ')}</span>
                    </label>
                  ))}
                </div>
                <Button onClick={applyFilters} size="sm" className="w-full">
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters} size="icon">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          {selectedSkills.map((skill) => (
            <Badge key={skill} variant="secondary" className="gap-1">
              {skill}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setSelectedSkills(prev => prev.filter(s => s !== skill))}
              />
            </Badge>
          ))}
          {selectedCommitments.map((commitment) => (
            <Badge key={commitment} variant="secondary" className="gap-1">
              {commitment.replace('-', ' ')}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setSelectedCommitments(prev => prev.filter(c => c !== commitment))}
              />
            </Badge>
          ))}
          {selectedStatuses.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1">
              {status.replace('-', ' ')}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setSelectedStatuses(prev => prev.filter(s => s !== status))}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}