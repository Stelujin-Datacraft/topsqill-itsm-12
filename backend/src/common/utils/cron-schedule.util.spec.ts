import { shouldRunCronSchedule } from './cron-schedule.util';

describe('shouldRunCronSchedule', () => {
  it('returns false for invalid cron expressions', () => {
    expect(shouldRunCronSchedule('invalid', null)).toBe(false);
    expect(shouldRunCronSchedule('* * *', null)).toBe(false);
  });

  it('returns true for wildcard minute/hour when no recent run', () => {
    expect(shouldRunCronSchedule('* * * * *', null)).toBe(true);
  });

  it('skips hourly schedule if ran within 55 minutes', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(shouldRunCronSchedule('0 * * * *', fiveMinutesAgo)).toBe(false);
  });

  it('allows hourly schedule if last run was over 55 minutes ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const now = new Date();
    const schedule = `${now.getUTCMinutes()} * * * *`;
    expect(shouldRunCronSchedule(schedule, twoHoursAgo)).toBe(true);
  });
});
