import { parseIsoDate } from '@/auth/validation';

export type PetAge =
  { unit: 'years'; count: number } | { unit: 'months'; count: number } | { unit: 'newborn' };

/** Age from an approximate birth date: years from one year on, months before that. */
export function petAge(birthDate: string, today: Date = new Date()): PetAge | null {
  const birth = parseIsoDate(birthDate);
  if (!birth || birth > today) return null;
  let months =
    (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
  if (today.getDate() < birth.getDate()) months -= 1;
  if (months >= 12) return { unit: 'years', count: Math.floor(months / 12) };
  if (months >= 1) return { unit: 'months', count: months };
  return { unit: 'newborn' };
}
