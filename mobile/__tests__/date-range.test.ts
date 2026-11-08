import { rangeStart } from '@/utils/dateRange';

describe('rangeStart', () => {
  const now = new Date(2026, 10, 8, 15, 30);

  it('today starts at midnight on this phone', () => {
    expect(rangeStart('day', now)).toEqual(new Date(2026, 10, 8, 0, 0));
  });

  it('the last 7 and 30 days count back from now', () => {
    expect(now.getTime() - rangeStart('week', now).getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(now.getTime() - rangeStart('month', now).getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
