import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    // This would typically be called by a cron job or scheduled task
    // For now, we'll allow manual triggering
    
    try {
      // Call the freeze_inactive_users function
      const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/user-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to freeze inactive users');
      }

      const data = await response.json();
      
      return res.status(200).json({
        message: 'Inactive user freeze process completed',
        usersFrozen: data.usersFrozen,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Cron job error:', error);
      return res.status(500).json({ 
        error: 'Failed to process inactive users' 
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
