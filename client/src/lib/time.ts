import { formatDistanceToNowStrict } from 'date-fns';

export function getTimeAgo(timestamp: string | Date): string {
  return formatDistanceToNowStrict(new Date(timestamp), { addSuffix: true });
}