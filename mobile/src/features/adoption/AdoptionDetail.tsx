import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { avatarUrl, useAuth } from '@/auth/AuthProvider';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { petPhotoUrl } from '@/features/pets/api';
import { MediaCarousel } from '@/features/posts/MediaCarousel';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

import type { Adoption } from './api';
import { useAgeText } from './useAgeText';

interface AdoptionDetailProps {
  adoption: Adoption;
  onPressPet: (petId: string) => void;
  onPressPublisher: (userId: string) => void;
  /** Shown only to the publisher. */
  onEdit?: () => void;
}

function Fact({ label, value, divider }: { label: string; value: string; divider: boolean }) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.fact,
        divider && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
      ]}>
      <ThemedText color="textSecondary" style={styles.factLabel}>
        {label}
      </ThemedText>
      <ThemedText style={styles.factValue}>{value}</ThemedText>
    </View>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <View style={styles.section}>
      <ThemedText variant="label" color="textSecondary" accessibilityRole="header">
        {title}
      </ThemedText>
      <ThemedText>{text}</ThemedText>
    </View>
  );
}

/** Full adoption listing: photos and videos, the pet's data, requirements and publisher. */
export function AdoptionDetail({
  adoption,
  onPressPet,
  onPressPublisher,
  onEdit,
}: AdoptionDetailProps) {
  const { t } = useTranslation();
  const { client } = useAuth();
  const colors = useThemeColors();
  const pet = adoption.pet;
  const ageText = useAgeText(pet?.birthDate ?? '');
  const petPhoto = pet ? petPhotoUrl(client, pet) : null;
  const publisher = adoption.publisher;
  const name = pet?.name ?? '';
  const yesNo = (value: boolean) => (value ? t('adoption.yes') : t('adoption.no'));

  const facts = [
    pet ? { label: t('adoption.species'), value: t(`pets.speciesNames.${pet.species}`) } : null,
    pet?.breed ? { label: t('adoption.breed'), value: pet.breed } : null,
    ageText ? { label: t('adoption.age'), value: ageText } : null,
    { label: t('adoption.sex'), value: t(`adoption.sexNames.${adoption.sex}`) },
    { label: t('adoption.size'), value: t(`adoption.sizeNames.${adoption.size}`) },
    { label: t('adoption.vaccines'), value: t(`adoption.vaccineNames.${adoption.vaccines}`) },
    { label: t('adoption.sterilized'), value: yesNo(adoption.sterilized) },
  ].filter((fact) => fact !== null);

  return (
    <View style={styles.container}>
      {adoption.media.length > 0 ? (
        <MediaCarousel record={adoption} />
      ) : petPhoto ? (
        <Image
          source={{ uri: petPhoto }}
          style={styles.petPhoto}
          accessibilityLabel={name}
          accessibilityIgnoresInvertColors
        />
      ) : null}

      <View style={styles.titleRow}>
        <ThemedText variant="title" accessibilityRole="header" style={styles.title}>
          {name}
        </ThemedText>
        <View style={[styles.status, { backgroundColor: colors.tabIndicator }]}>
          <ThemedText variant="caption" style={styles.statusText}>
            {adoption.status === 'adopted' ? t('adoption.adopted') : t('adoption.upForAdoption')}
          </ThemedText>
        </View>
      </View>
      <View style={styles.zone}>
        <Icon name="location" size={18} color={colors.textSecondary} />
        <ThemedText color="textSecondary">{adoption.zone}</ThemedText>
      </View>

      <View style={[styles.facts, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {facts.map((fact, index) => (
          <Fact key={fact.label} label={fact.label} value={fact.value} divider={index > 0} />
        ))}
      </View>

      <Section title={t('adoption.healthTitle')} text={adoption.health} />
      <Section title={t('adoption.descriptionTitle', { name })} text={adoption.description} />
      <Section title={t('adoption.requirementsTitle')} text={adoption.requirements} />

      {publisher ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('adoption.publishedBy', { username: publisher.username })}
          onPress={() => onPressPublisher(publisher.id)}
          style={({ pressed }) => [styles.publisher, pressed && styles.pressed]}>
          <Avatar
            uri={avatarUrl(client, publisher, '100x100')}
            username={publisher.username}
            size={40}
          />
          <ThemedText style={styles.publisherText}>
            {t('adoption.publishedBy', { username: publisher.username })}
          </ThemedText>
          <Icon name="chevron" size={16} color={colors.textSecondary} />
        </Pressable>
      ) : null}

      {pet ? (
        <Button
          variant="secondary"
          icon="paw"
          label={t('adoption.openPet', { name })}
          onPress={() => onPressPet(pet.id)}
        />
      ) : null}
      {onEdit ? (
        <Button variant="secondary" icon="edit" label={t('adoption.edit')} onPress={onEdit} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  petPhoto: { width: '100%', aspectRatio: 1, borderRadius: radius.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flexShrink: 1 },
  status: { borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  statusText: { fontWeight: '600' },
  zone: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  facts: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  fact: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  factLabel: { flex: 1 },
  factValue: { flex: 1, textAlign: 'right', fontWeight: '600' },
  section: { gap: spacing.xs },
  publisher: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  publisherText: { flex: 1 },
  pressed: { opacity: 0.6 },
});
