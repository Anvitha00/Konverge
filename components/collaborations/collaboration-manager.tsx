import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from "sonner";

interface Collaboration {
  collaboration_id: number;
  project_id: number;
  project_title: string;
  project_description: string;
  required_skill: string;
  joined_at: string;
}

interface UserStatus {
  activeCollaborations: number;
  completedCollaborations: number;
  pitchedProjects: number;
  totalCommitments: number;
  accountStatus: string;
  canJoinNewProjects: boolean;
}

export default function CollaborationManager({ userId }: { userId: string }) {
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCollaborations();
    fetchUserStatus();
  }, [userId]);

  const fetchCollaborations = async () => {
    try {
      const response = await fetch(`/api/user-collaborations?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setCollaborations(data.collaborations || []);
      }
    } catch (error) {
      console.error('Error fetching collaborations:', error);
    }
  };

  const fetchUserStatus = async () => {
    try {
      const response = await fetch(`/api/user-collaboration-status?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setUserStatus(data);
      }
    } catch (error) {
      console.error('Error fetching user status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFinishCollaboration = async (projectId: number) => {
    try {
      const response = await fetch('/api/finish-collaboration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, projectId }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(
          `Collaboration finished. You can now join ${data.canJoinNewProjects ? 'new projects' : 'up to 1 more project'}.`
        );
        
        // Refresh data
        fetchCollaborations();
        fetchUserStatus();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to finish collaboration');
      }
    } catch (error) {
      console.error('Error finishing collaboration:', error);
      toast.error('Failed to finish collaboration');
    }
  };

  if (loading) {
    return <div>Loading collaborations...</div>;
  }

  const activeCollaborations = collaborations.filter(c => 
    c.collaboration_id && c.project_id
  );

  return (
    <div className="space-y-6">
      {/* User Status Card */}
      {userStatus && (
        <Card>
          <CardHeader>
            <CardTitle>Your Collaboration Status</CardTitle>
            <CardDescription>
              <span className="block mb-1">Current collaboration limits (max 2 total).</span>
              <span className="block text-xs">
                <strong>Active Collaborations</strong> = projects you&apos;ve joined on (as a collaborator).{' '}
                <strong>Pitched Projects</strong> = projects you own. Both count toward your limit.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:gap-y-8">
              <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 p-4">
                <div className="text-2xl font-bold">{userStatus.activeCollaborations}</div>
                <div className="text-sm text-muted-foreground text-center mt-1">Active Collaborations</div>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 p-4">
                <div className="text-2xl font-bold">{userStatus.pitchedProjects}</div>
                <div className="text-sm text-muted-foreground text-center mt-1">Pitched Projects</div>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 p-4">
                <div className="text-2xl font-bold">{userStatus.totalCommitments}</div>
                <div className="text-sm text-muted-foreground text-center mt-1">Total Active Commitments</div>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 p-4">
                <Badge variant={userStatus.accountStatus === 'active' ? 'default' : 'destructive'}>
                  {userStatus.accountStatus}
                </Badge>
                <div className="text-sm text-muted-foreground text-center mt-1">Account Status</div>
              </div>
            </div>
            
            {!userStatus.canJoinNewProjects && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  You&apos;ve <span className="font-semibold">reached your collaboration limit</span> of 2 active
                  commitments (pitched projects + collaborations). Finish a current project to join new ones.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active Collaborations */}
      <Card>
        <CardHeader>
          <CardTitle>Active Collaborations</CardTitle>
          <CardDescription>
            Projects you&apos;ve joined as a collaborator (not ones you pitched)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeCollaborations.length === 0 ? (
            <p className="text-muted-foreground">No active collaborations</p>
          ) : (
            <div className="space-y-4">
              {activeCollaborations.map((collaboration) => (
                <div
                  key={collaboration.collaboration_id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold">{collaboration.project_title}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {collaboration.project_description}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{collaboration.required_skill}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Joined {new Date(collaboration.joined_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleFinishCollaboration(collaboration.project_id)}
                    variant="outline"
                    size="sm"
                  >
                    Finish Collaboration
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
