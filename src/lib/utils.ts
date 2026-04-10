import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function getCategoryColor(category: string, emotiveSubcategory?: string | null): string {
  if (category === 'emotive') {
    if (emotiveSubcategory === 'positive') return '#eab308';
    if (emotiveSubcategory === 'neutral') return '#f97316';
    return '#f43f5e'; // negative or unset
  }
  const colors: Record<string, string> = {
    location: '#22c55e',
    person: '#3b82f6',
    symbolic: '#a855f7',
    custom: '#f59e0b',
  };
  return colors[category] || colors.custom;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}
