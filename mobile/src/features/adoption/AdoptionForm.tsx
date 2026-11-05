import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors, type FieldErrors } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { FieldError } from '@/components/FieldError';
import { Loading } from '@/components/QueryState';
import { SwitchRow } from '@/components/SwitchRow';
import { TextField } from '@/components/TextField';
import { ThemedText } from '@/components/ThemedText';
import { usePets } from '@/features/pets/hooks';
import { mediaKind, mediaUrl } from '@/features/posts/api';
import { pickPostMedia, type ComposerMedia } from '@/features/posts/media';
import { MediaStrip } from '@/features/posts/MediaStrip';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { confirm } from '@/utils/confirm';

import {
  ADOPTION_DESCRIPTION_MAX,
  ADOPTION_FILES_MAX,
  ADOPTION_HEALTH_MAX,
  ADOPTION_REQUIREMENTS_MAX,
  ADOPTION_ZONE_MAX,
  SEXES,
  SIZES,
  VACCINES,
  type Adoption,
  type AdoptionValues,
  type Sex,
  type Size,
  type Vaccines,
} from './api';
import { useDeleteAdoption, useSaveAdoption } from './hooks';

/** A file in the form: a stored one (`stored` is its name) or a new one from the gallery. */
type FormMedia = ComposerMedia & { stored?: string };

type FormValues = Omit<AdoptionValues, 'newMedia' | 'removedMedia'>;

export function validateAdoption(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.petId) errors.pet = 'errors.required';
  if (!values.sex) errors.sex = 'errors.required';
  if (!values.size) errors.size = 'errors.required';
  if (!values.vaccines) errors.vaccines = 'errors.required';
  const zone = values.zone.trim();
  if (!zone) errors.zone = 'errors.required';
  else if (zone.length > ADOPTION_ZONE_MAX) errors.zone = 'errors.tooLong';
  return errors;
}

interface AdoptionFormProps {
  /** The listing to edit, or undefined to create one. */
  adoption?: Adoption;
  /** Pet chosen beforehand (from its profile). */
  petId?: string;
  onSaved: (adoption: Adoption) => void;
  onDeleted?: () => void;
}

/** Puts one of your pets up for adoption, or edits or deletes its listing. */
export function AdoptionForm({ adoption, petId, onSaved, onDeleted }: AdoptionFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { client, user } = useAuth();
  const colors = useThemeColors();
  const { data: pets, isPending: loadingPets } = usePets(adoption ? undefined : user?.id);
  const save = useSaveAdoption();
  const remove = useDeleteAdoption();
  const [values, setValues] = useState<FormValues>({
    petId: adoption?.petId ?? petId ?? '',
    sex: adoption?.sex ?? '',
    size: adoption?.size ?? '',
    vaccines: adoption?.vaccines ?? '',
    sterilized: adoption?.sterilized ?? false,
    health: adoption?.health ?? '',
    zone: adoption?.zone ?? '',
    requirements: adoption?.requirements ?? '',
    description: adoption?.description ?? '',
  });
  const [media, setMedia] = useState<FormMedia[]>(
    (adoption?.media ?? []).map((name) => ({
      uri: mediaUrl(client, adoption as Adoption, name, '300x300'),
      name,
      type: '',
      kind: mediaKind(name),
      stored: name,
    })),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const remaining = ADOPTION_FILES_MAX - media.length;

  function update<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field === 'petId' ? 'pet' : field]: undefined }));
  }

  const message = (field: string) => {
    const key = errors[field];
    return key ? t(key) : null;
  };

  function showError(error: unknown) {
    const fieldErrors = toFieldErrors(error);
    setErrors(fieldErrors);
    // Errors of fields without their own message (such as the files) go above the button.
    const shown = ['pet', 'sex', 'size', 'vaccines', 'zone', 'health', 'requirements'];
    const other = Object.entries(fieldErrors).flatMap(([field, key]) =>
      key && !shown.includes(field) ? [t(key)] : [],
    );
    const general = requestErrorKey(requestErrorKind(error));
    setFormErrors(
      other.length > 0
        ? other
        : Object.keys(fieldErrors).length === 0 && general
          ? [t(general)]
          : [],
    );
  }

  async function addMedia() {
    const picked = await pickPostMedia(remaining);
    setMedia((current) => [...current, ...picked.media].slice(0, ADOPTION_FILES_MAX));
    setFormErrors(picked.errors.map((key) => t(key)));
  }

  async function submit() {
    setFormErrors([]);
    const found = validateAdoption(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const kept = new Set(media.flatMap((item) => (item.stored ? [item.stored] : [])));
    try {
      const saved = await save.mutateAsync({
        id: adoption?.id,
        values: {
          ...values,
          newMedia: media.filter((item) => !item.stored),
          removedMedia: (adoption?.media ?? []).filter((name) => !kept.has(name)),
        },
      });
      onSaved(saved);
    } catch (error) {
      showError(error);
    }
  }

  async function confirmDelete() {
    if (!adoption) return;
    const confirmed = await confirm({
      title: t('adoption.deleteConfirmTitle'),
      message: t('adoption.deleteConfirmMessage'),
      confirmLabel: t('adoption.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await remove.mutateAsync(adoption.id);
      onDeleted?.();
    } catch (error) {
      showError(error);
    }
  }

  if (!adoption && loadingPets) {
    return <Loading />;
  }
  if (!adoption && pets?.length === 0) {
    return (
      <View style={styles.form}>
        <ThemedText color="textSecondary">{t('adoption.noPets')}</ThemedText>
        <Button icon="add" label={t('adoption.addPet')} onPress={() => router.push('/pet/new')} />
      </View>
    );
  }

  return (
    <View style={styles.form}>
      {adoption ? (
        <ThemedText variant="title" accessibilityRole="header">
          {adoption.pet?.name}
        </ThemedText>
      ) : (
        <ChipGroup<string>
          label={t('adoption.pet')}
          chips={(pets ?? []).map((pet) => ({ value: pet.id, label: pet.name }))}
          selected={values.petId}
          onSelect={(value) => update('petId', value)}
          error={message('pet')}
        />
      )}
      <MediaStrip
        media={media}
        onRemove={(index) => setMedia((current) => current.filter((_, i) => i !== index))}
      />
      {remaining > 0 ? (
        <Button
          variant="secondary"
          icon="gallery"
          label={t('posts.addMedia')}
          accessibilityHint={t('posts.mediaHint', { count: remaining })}
          onPress={addMedia}
        />
      ) : null}
      <ThemedText variant="caption" color="textSecondary">
        {t('posts.limits')}
      </ThemedText>
      <ChipGroup<Sex>
        label={t('adoption.sex')}
        chips={SEXES.map((value) => ({ value, label: t(`adoption.sexNames.${value}`) }))}
        selected={values.sex}
        onSelect={(value) => update('sex', value)}
        error={message('sex')}
      />
      <ChipGroup<Size>
        label={t('adoption.size')}
        chips={SIZES.map((value) => ({ value, label: t(`adoption.sizeNames.${value}`) }))}
        selected={values.size}
        onSelect={(value) => update('size', value)}
        error={message('size')}
      />
      <ChipGroup<Vaccines>
        label={t('adoption.vaccines')}
        chips={VACCINES.map((value) => ({ value, label: t(`adoption.vaccineNames.${value}`) }))}
        selected={values.vaccines}
        onSelect={(value) => update('vaccines', value)}
        error={message('vaccines')}
      />
      <View
        style={[styles.switch, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SwitchRow
          label={t('adoption.sterilized')}
          value={values.sterilized}
          onValueChange={(value) => update('sterilized', value)}
        />
      </View>
      <TextField
        label={t('adoption.zone')}
        hint={t('adoption.zoneHint')}
        value={values.zone}
        onChangeText={(text) => update('zone', text)}
        error={message('zone')}
        maxLength={ADOPTION_ZONE_MAX}
      />
      <TextField
        label={t('adoption.health')}
        value={values.health}
        onChangeText={(text) => update('health', text)}
        error={message('health')}
        multiline
        maxLength={ADOPTION_HEALTH_MAX}
      />
      <TextField
        label={t('adoption.requirements')}
        value={values.requirements}
        onChangeText={(text) => update('requirements', text)}
        error={message('requirements')}
        multiline
        maxLength={ADOPTION_REQUIREMENTS_MAX}
      />
      <TextField
        label={t('adoption.description')}
        hint={t('posts.textCount', {
          used: values.description.length,
          max: ADOPTION_DESCRIPTION_MAX,
        })}
        value={values.description}
        onChangeText={(text) => update('description', text)}
        error={message('description')}
        multiline
        maxLength={ADOPTION_DESCRIPTION_MAX}
      />
      {formErrors.map((text) => (
        <FieldError key={text} message={text} />
      ))}
      <Button
        label={
          adoption
            ? t('adoption.save')
            : save.isPending
              ? t('adoption.publishing')
              : t('adoption.publish')
        }
        onPress={submit}
        loading={save.isPending}
      />
      {adoption ? (
        <Button
          variant="secondary"
          icon="delete"
          label={t('adoption.delete')}
          onPress={confirmDelete}
          loading={remove.isPending}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  switch: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
