import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { spacing } from '@/theme/typography';

import { AddPetCard, PetCard } from './PetCard';
import { usePets } from './hooks';

interface PetListProps {
  ownerId: string;
  /** Shows the "Add pet" card (own profile). */
  canAdd?: boolean;
}

/** Horizontal row of a user's pets. */
export function PetList({ ownerId, canAdd = false }: PetListProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: pets = [], isPending } = usePets(ownerId);

  if (!canAdd && !isPending && pets.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <ThemedText variant="label" color="textSecondary">
        {canAdd ? t('pets.mine') : t('pets.title')}
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {pets.map((pet) => (
          <PetCard
            key={pet.id}
            pet={pet}
            onPress={() => router.push({ pathname: '/pet/[id]', params: { id: pet.id } })}
          />
        ))}
        {canAdd ? <AddPetCard onPress={() => router.push('/pet/new')} /> : null}
      </ScrollView>
      {canAdd && !isPending && pets.length === 0 ? (
        <ThemedText color="textSecondary">{t('pets.empty')}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { gap: spacing.md, paddingVertical: spacing.xs },
});
