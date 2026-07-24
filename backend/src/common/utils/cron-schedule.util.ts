/**
 * Lightweight cron matcher for common 5-field expressions (minute hour dom month dow).
 * Ported from supabase/functions/run-scheduled-data-feeds.
 */
export function shouldRunCronSchedule(schedule: string, lastRunAt: string | null): boolean {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();
  const currentDay = now.getUTCDay();
  const currentDate = now.getUTCDate();

  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [cronMinute, cronHour, cronDayOfMonth, , cronDayOfWeek] = parts;

  if (lastRunAt) {
    const timeSinceLastRun = now.getTime() - new Date(lastRunAt).getTime();
    if (cronMinute !== '*' && cronHour === '*') {
      if (timeSinceLastRun < 55 * 60 * 1000) return false;
    }
    if (cronMinute !== '*' && cronHour !== '*' && cronDayOfMonth === '*') {
      if (timeSinceLastRun < 23 * 60 * 60 * 1000) return false;
    }
  }

  if (cronMinute !== '*') {
    const targetMinutes = cronMinute.split(',').map((m) => parseInt(m.trim(), 10));
    if (!targetMinutes.some((m) => Math.abs(currentMinute - m) <= 2)) return false;
  }

  if (cronHour !== '*') {
    const targetHours = cronHour.split(',').map((h) => parseInt(h.trim(), 10));
    if (!targetHours.includes(currentHour)) return false;
  }

  if (cronDayOfMonth !== '*') {
    const targetDays = cronDayOfMonth.split(',').map((d) => parseInt(d.trim(), 10));
    if (!targetDays.includes(currentDate)) return false;
  }

  if (cronDayOfWeek !== '*') {
    const targetDaysOfWeek = cronDayOfWeek.split(',').map((d) => parseInt(d.trim(), 10));
    if (!targetDaysOfWeek.includes(currentDay)) return false;
  }

  return true;
}
