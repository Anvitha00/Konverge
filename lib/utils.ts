import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

export function formatTime(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatDayLabel(date: Date | string) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(d, today)) return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(d);
}

export function formatRelativeTime(date: Date | string) {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const nowMs = Date.now();
  const targetMs = new Date(date).getTime();
  const diffMs = targetMs - nowMs; // negative for past

  const absMs = Math.abs(diffMs);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (absMs < 45 * 1000) return 'just now';
  if (absMs < hourMs) return rtf.format(Math.round(diffMs / minuteMs), 'minute');
  if (absMs < dayMs) return rtf.format(Math.round(diffMs / hourMs), 'hour');
  return rtf.format(Math.round(diffMs / dayMs), 'day');
}

export function truncate(text: string, length: number = 100) {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

export function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function calculateProfileCompleteness(profile: Partial<Profile>): number {
  const fields = [
    'name', 'bio', 'skills', 'availability', 'avatar',
    'links.github', 'links.linkedin', 'preferredRoles'
  ];
  
  let completed = 0;
  fields.forEach(field => {
    const value = field.includes('.') 
      ? field.split('.').reduce((obj, key) => obj?.[key], profile)
      : profile[field as keyof Profile];
    
    if (Array.isArray(value) ? value.length > 0 : Boolean(value)) {
      completed++;
    }
  });
  
  return Math.round((completed / fields.length) * 100);
}