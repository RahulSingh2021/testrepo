export type ScheduleStatus =
  | 'INACTIVE'
  | 'NEVER_DONE'
  | 'LOCKED'
  | 'UPCOMING'
  | 'DUE'
  | 'OVERDUE';

export interface ScheduleState {
  status: ScheduleStatus;
  nextDueDate: Date | null;
  lastDoneDate: Date | null;
  daysUntilDue: number | null;
  percentElapsed: number;
  canStart: boolean;
  lockReason: string | null;
  daysUntilUnlocked: number | null;
  intervalDays: number;
}

function unitToDays(value: number, unit: string): number {
  const u = (unit || '').toLowerCase();
  if (u.startsWith('week')) return value * 7;
  if (u.startsWith('month')) return value * 30;
  if (u.startsWith('fortnight')) return value * 14;
  return value;
}

/**
 * Compute the current schedule status for a piece of equipment.
 *
 * @param frequencyValue  e.g. 15
 * @param frequencyUnit   e.g. "days"
 * @param startDate       Reference start date (ISO string)
 * @param lastCompletionDate  Most recent checklist completion (ISO string or Date, or null)
 * @param isActive        Whether the equipment is enabled
 * @param minimumGapPercent  Fraction of interval that must elapse before checklist can restart (default 0.5)
 * @param rescheduledNextDue  Explicit next-due override set by user via Reschedule (ISO date string)
 */
export function computeScheduleState(
  frequencyValue: number,
  frequencyUnit: string,
  startDate: string | undefined | null,
  lastCompletionDate: string | Date | null,
  isActive: boolean,
  minimumGapPercent = 0.5,
  rescheduledNextDue?: string | null
): ScheduleState {
  const baseIntervalDays = unitToDays(Number(frequencyValue) || 1, frequencyUnit || 'days');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!isActive) {
    return {
      status: 'INACTIVE',
      nextDueDate: null,
      lastDoneDate: null,
      daysUntilDue: null,
      percentElapsed: 0,
      canStart: false,
      lockReason: 'This equipment is inactive. Contact your administrator to enable it.',
      daysUntilUnlocked: null,
      intervalDays: baseIntervalDays,
    };
  }

  const lastDone = lastCompletionDate ? new Date(lastCompletionDate) : null;
  if (lastDone) lastDone.setHours(0, 0, 0, 0);

  if (!lastDone) {
    const nextDueDate = rescheduledNextDue
      ? new Date(rescheduledNextDue)
      : startDate
        ? new Date(startDate)
        : new Date(today);
    return {
      status: 'NEVER_DONE',
      nextDueDate,
      lastDoneDate: null,
      daysUntilDue: null,
      percentElapsed: 0,
      canStart: true,
      lockReason: null,
      daysUntilUnlocked: null,
      intervalDays: baseIntervalDays,
    };
  }

  // Determine effective next due date and interval
  let nextDueDate: Date;
  let intervalDays: number;

  if (rescheduledNextDue) {
    const rescheduled = new Date(rescheduledNextDue);
    rescheduled.setHours(0, 0, 0, 0);
    if (rescheduled > lastDone) {
      // Valid reschedule: use it as anchor
      nextDueDate = rescheduled;
      intervalDays = Math.max(
        Math.ceil((rescheduled.getTime() - lastDone.getTime()) / 86400000),
        1
      );
    } else {
      // Rescheduled date is before last completion — ignore, use default
      nextDueDate = new Date(lastDone);
      nextDueDate.setDate(nextDueDate.getDate() + baseIntervalDays);
      intervalDays = baseIntervalDays;
    }
  } else {
    nextDueDate = new Date(lastDone);
    nextDueDate.setDate(nextDueDate.getDate() + baseIntervalDays);
    intervalDays = baseIntervalDays;
  }

  const daysSinceLastDone = Math.floor((today.getTime() - lastDone.getTime()) / 86400000);
  const daysUntilDue = Math.ceil((nextDueDate.getTime() - today.getTime()) / 86400000);
  const percentElapsed = Math.min(daysSinceLastDone / intervalDays, 2);

  const lockThresholdDays = intervalDays * minimumGapPercent;

  if (daysSinceLastDone < lockThresholdDays) {
    const unlockDate = new Date(lastDone);
    unlockDate.setDate(unlockDate.getDate() + Math.ceil(lockThresholdDays));
    const daysUntilUnlocked = Math.ceil((unlockDate.getTime() - today.getTime()) / 86400000);
    return {
      status: 'LOCKED',
      nextDueDate,
      lastDoneDate: lastDone,
      daysUntilDue,
      percentElapsed,
      canStart: false,
      lockReason: `Minimum ${Math.round(minimumGapPercent * 100)}% of the ${intervalDays}-day interval must pass before this checklist can be run again.`,
      daysUntilUnlocked: Math.max(daysUntilUnlocked, 1),
      intervalDays,
    };
  }

  if (daysSinceLastDone > intervalDays * 1.1) {
    return {
      status: 'OVERDUE',
      nextDueDate,
      lastDoneDate: lastDone,
      daysUntilDue,
      percentElapsed,
      canStart: true,
      lockReason: null,
      daysUntilUnlocked: null,
      intervalDays,
    };
  }

  if (daysSinceLastDone >= intervalDays * 0.9) {
    return {
      status: 'DUE',
      nextDueDate,
      lastDoneDate: lastDone,
      daysUntilDue,
      percentElapsed,
      canStart: true,
      lockReason: null,
      daysUntilUnlocked: null,
      intervalDays,
    };
  }

  return {
    status: 'UPCOMING',
    nextDueDate,
    lastDoneDate: lastDone,
    daysUntilDue,
    percentElapsed,
    canStart: true,
    lockReason: null,
    daysUntilUnlocked: null,
    intervalDays,
  };
}

export function formatRelativeDate(date: Date | null): string {
  if (!date) return 'Never';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `In ${diff} days`;
}

export function formatDateShort(date: Date | null): string {
  if (!date) return 'Never';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
