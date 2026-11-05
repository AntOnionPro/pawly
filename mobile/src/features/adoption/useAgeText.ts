import { useTranslation } from 'react-i18next';

import { petAge } from '@/features/pets/age';

/** "2 years old", "5 months old"… from an approximate birth date, or '' when unknown. */
export function useAgeText(birthDate: string): string {
  const { t } = useTranslation();
  const age = petAge(birthDate);
  if (!age) return '';
  return age.unit === 'newborn'
    ? t('pets.age.newborn')
    : t(`pets.age.${age.unit}`, { count: age.count });
}
