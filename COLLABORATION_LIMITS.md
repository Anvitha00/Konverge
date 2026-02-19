# Collaboration Limits and Inactive User Management

This document outlines the implementation of two key features:

## 1. Collaboration Limits (Max 2 Projects per User)

### Database Changes
- Added `account_status` column to users table
- Created trigger to enforce 2-project limit
- Added functions for collaboration management

### API Endpoints
- `POST /api/finish-collaboration` - Mark collaboration as completed
- `GET /api/user-collaboration-status` - Check user's current status
- `GET /api/user-collaborations` - Get user's active projects

### Frontend Component
- `CollaborationManager` component displays active projects
- Shows "Finish Collaboration" button for each active project
- Displays current collaboration count and limits

## 2. Inactive User Management (5 Weeks No Response)

### Database Functions
- `freeze_inactive_users()` - Freezes users with pending decisions > 5 weeks
- `unfreeze_user(user_id)` - Manually unfreeze a user
- Views for monitoring inactive users

### API Endpoints
- `POST /api/user-status` - Run freeze process (for cron jobs)
- `PATCH /api/user-status` - Unfreeze specific user
- `GET /api/user-status` - View users with pending decisions

### Backend Updates
- Modified recommendation logic to exclude frozen users
- Updated candidate filtering to respect collaboration limits

## Setup Instructions

### 1. Apply Database Schema Updates
```sql
-- Run the schema updates
\i schema_updates.sql
```

### 2. Update Existing Data
```sql
-- Add account_status to existing users
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'active';
```

### 3. Set Up Cron Job (Optional)
For automatic freezing of inactive users, set up a cron job to call:
```
POST /api/cron/freeze-inactive-users
```

## Usage Examples

### Finishing a Collaboration
```javascript
const response = await fetch('/api/finish-collaboration', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: '123', projectId: '456' }),
});
```

### Checking User Status
```javascript
const response = await fetch('/api/user-collaboration-status?userId=123');
const { activeCollaborations, canJoinNewProjects } = await response.json();
```

### Manual User Unfreeze
```javascript
const response = await fetch('/api/user-status', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: '123' }),
});
```

## Integration Points

### Recommendation System
The backend now automatically:
- Excludes frozen users from recommendations
- Respects the 2-project collaboration limit
- Only recommends to users with available capacity

### User Interface
The CollaborationManager component provides:
- Clear visualization of current limits
- Easy way to finish collaborations
- Status indicators for account health

## Monitoring

### Database Views
- `user_collaboration_summary` - Overview of all users' collaboration status
- `users_pending_decisions` - Users at risk of being frozen

### API Monitoring
- Track freeze/unfreeze operations
- Monitor collaboration limit violations
- Watch recommendation system performance
