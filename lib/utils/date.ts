/**
 * Format date to relative time or absolute date
 * Examples: "2 days ago", "Mar 15, 2024", "Just now"
 */
export function formatProjectDate(date: Date | string | undefined): string {
  if (!date) return 'Unknown date';
  
  const projectDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - projectDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  // Just now (< 1 minute)
  if (diffMins < 1) return 'Just now';
  
  // Minutes ago (< 1 hour)
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  
  // Hours ago (< 24 hours)
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  
  // Days ago (< 7 days)
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  
  // Absolute date for older projects
  return projectDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: projectDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
  });
}

/**
 * Format date for display (e.g., "March 15, 2024")
 */
export function formatDate(date: Date | string | undefined): string {
  if (!date) return 'Unknown date';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format date for inputs (YYYY-MM-DD)
 */
export function formatDateForInput(date: Date | string | undefined): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toISOString().split('T')[0];
}