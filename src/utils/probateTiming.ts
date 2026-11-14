import type { PropertyStatus } from '../types';

export interface ProbateUrgencyBadge {
  label: string;
  daysSinceFiling: number;
  tone: 'emerald' | 'amber' | 'rose' | 'indigo';
}

export function getProbateUrgencyBadge(
  filingDateStr: string,
  status: PropertyStatus,
  referenceDate: Date = new Date()
): ProbateUrgencyBadge {
  if (status === 'auction') {
    return {
      label: 'Live Auction Scheduled',
      daysSinceFiling: Math.max(0, computeDaysDiff(filingDateStr, referenceDate)),
      tone: 'indigo',
    };
  }

  const days = Math.max(0, computeDaysDiff(filingDateStr, referenceDate));

  if (days <= 14) {
    return {
      label: 'Filed <14 Days Ago',
      daysSinceFiling: days,
      tone: 'emerald',
    };
  }
  if (days >= 21 && days <= 45) {
    return {
      label: 'Prime Outreach Window: 21-45 Days',
      daysSinceFiling: days,
      tone: 'amber',
    };
  }
  if (days >= 90) {
    return {
      label: 'Motivated: 90+ Days',
      daysSinceFiling: days,
      tone: 'rose',
    };
  }

  return {
    label: `Filed ${days} Days Ago`,
    daysSinceFiling: days,
    tone: 'emerald',
  };
}

function computeDaysDiff(dateStr: string, ref: Date): number {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return 0;
  const diffMs = ref.getTime() - parsed.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
