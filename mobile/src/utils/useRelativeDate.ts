import { useTranslation } from 'react-i18next';

import { parseServerDate, relativeTime } from './time';

/** "2 h", "3 d"… or the date after a week, in the app language. */
export function useRelativeDate(value: string): string {
  const { t, i18n } = useTranslation();
  const date = parseServerDate(value);
  if (!date) return '';
  const relative = relativeTime(date);
  switch (relative.unit) {
    case 'now':
      return t('time.now');
    case 'minutes':
    case 'hours':
    case 'days':
      return t(`time.${relative.unit}`, { count: relative.count });
    default:
      return relative.date.toLocaleDateString(i18n.language, { dateStyle: 'medium' });
  }
}
