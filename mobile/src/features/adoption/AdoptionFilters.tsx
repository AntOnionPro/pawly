import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { SPECIES, type Species } from '@/features/pets/api';
import { spacing } from '@/theme/typography';

import { SEXES, SIZES, type AdoptionFilter, type Sex, type Size } from './api';

const ANY = 'any';
type Any = typeof ANY;

interface AdoptionFiltersProps {
  filter: AdoptionFilter;
  onChange: (filter: AdoptionFilter) => void;
}

/** "Filters" button that shows species, size and sex choices, and clears them. */
export function AdoptionFilters({ filter, onChange }: AdoptionFiltersProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const count = Object.values(filter).filter(Boolean).length;
  const any = { value: ANY, label: t('adoption.any') } as const;

  function set<K extends keyof AdoptionFilter>(key: K, value: AdoptionFilter[K] | Any) {
    onChange({ ...filter, [key]: value === ANY ? undefined : value });
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Button
          variant="link"
          icon="filter"
          label={count > 0 ? t('adoption.filtersCount', { count }) : t('adoption.filters')}
          onPress={() => setOpen((current) => !current)}
        />
        {count > 0 ? (
          <Button variant="link" label={t('adoption.clearFilters')} onPress={() => onChange({})} />
        ) : null}
      </View>
      {open ? (
        <View style={styles.groups}>
          <ChipGroup<Species | Any>
            label={t('adoption.species')}
            chips={[
              any,
              ...SPECIES.map((value) => ({ value, label: t(`pets.speciesNames.${value}`) })),
            ]}
            selected={filter.species ?? ANY}
            onSelect={(value) => set('species', value)}
          />
          <ChipGroup<Size | Any>
            label={t('adoption.size')}
            chips={[
              any,
              ...SIZES.map((value) => ({ value, label: t(`adoption.sizeNames.${value}`) })),
            ]}
            selected={filter.size ?? ANY}
            onSelect={(value) => set('size', value)}
          />
          <ChipGroup<Sex | Any>
            label={t('adoption.sex')}
            chips={[
              any,
              ...SEXES.map((value) => ({ value, label: t(`adoption.sexNames.${value}`) })),
            ]}
            selected={filter.sex ?? ANY}
            onSelect={(value) => set('sex', value)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'center' },
  groups: { gap: spacing.md },
});
