import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors, type FieldErrors } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { DateField } from '@/components/DateField';
import { FieldError } from '@/components/FieldError';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/TextField';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import { confirm } from '@/utils/confirm';
import { pickSquarePhoto } from '@/utils/pickPhoto';

import {
  PET_BREED_MAX,
  PET_NAME_MAX,
  petPhotoUrl,
  SPECIES,
  type Pet,
  type PetValues,
  type Species,
} from './api';
import { useDeletePet, useSavePet } from './hooks';

interface PetFormProps {
  /** The pet to edit, or undefined to create one. */
  pet?: Pet;
  onSaved: (pet: Pet) => void;
  onDeleted?: () => void;
}

export function validatePet(values: PetValues): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = 'errors.required';
  else if (name.length > PET_NAME_MAX) errors.name = 'errors.tooLong';
  if (!values.species) errors.species = 'errors.required';
  if (values.breed.trim().length > PET_BREED_MAX) errors.breed = 'errors.tooLong';
  return errors;
}

export function PetForm({ pet, onSaved, onDeleted }: PetFormProps) {
  const { t } = useTranslation();
  const { client } = useAuth();
  const colors = useThemeColors();
  const save = useSavePet();
  const remove = useDeletePet();
  const [values, setValues] = useState<PetValues>({
    name: pet?.name ?? '',
    species: pet?.species ?? '',
    breed: pet?.breed ?? '',
    birthDate: pet?.birthDate ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const preview =
    values.photo === undefined
      ? pet
        ? petPhotoUrl(client, pet)
        : null
      : (values.photo?.uri ?? null);

  function update<K extends keyof PetValues>(field: K, value: PetValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  const message = (field: string) => {
    const key = errors[field];
    return key ? t(key) : null;
  };

  function showError(error: unknown) {
    setErrors(toFieldErrors(error));
    const key = requestErrorKey(requestErrorKind(error));
    setFormError(key ? t(key) : null);
  }

  async function submit() {
    setFormError(null);
    const found = validatePet(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      onSaved(await save.mutateAsync({ id: pet?.id, values }));
    } catch (error) {
      showError(error);
    }
  }

  async function confirmDelete() {
    if (!pet) return;
    const confirmed = await confirm({
      title: t('pets.deleteConfirmTitle', { name: pet.name }),
      message: t('pets.deleteConfirmMessage'),
      confirmLabel: t('pets.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await remove.mutateAsync(pet.id);
      onDeleted?.();
    } catch (error) {
      showError(error);
    }
  }

  return (
    <View style={styles.form}>
      <View style={styles.photoArea}>
        <View
          style={[styles.photo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {preview ? (
            <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} />
          ) : (
            <Icon name="paw" selected size={48} color={colors.textSecondary} />
          )}
        </View>
        <View style={styles.photoActions}>
          <Button
            variant="link"
            icon="camera"
            label={preview ? t('pets.changePhoto') : t('pets.addPhoto')}
            onPress={async () => {
              const picked = await pickSquarePhoto();
              if (picked) update('photo', picked);
            }}
          />
          {preview ? (
            <Button
              variant="link"
              icon="delete"
              label={t('pets.removePhoto')}
              onPress={() => update('photo', null)}
            />
          ) : null}
        </View>
      </View>
      <TextField
        label={t('pets.name')}
        value={values.name}
        onChangeText={(text) => update('name', text)}
        error={message('name')}
        maxLength={PET_NAME_MAX}
      />
      <ChipGroup<Species>
        label={t('pets.species')}
        chips={SPECIES.map((value) => ({ value, label: t(`pets.speciesNames.${value}`) }))}
        selected={values.species}
        onSelect={(value) => update('species', value)}
        error={message('species')}
      />
      <TextField
        label={t('pets.breed')}
        value={values.breed}
        onChangeText={(text) => update('breed', text)}
        error={message('breed')}
        maxLength={PET_BREED_MAX}
      />
      <DateField
        label={t('pets.birthDate')}
        hint={t('pets.birthDateHint')}
        placeholder={t('pets.datePlaceholder')}
        value={values.birthDate}
        onChange={(value) => update('birthDate', value)}
        error={message('birthDate')}
      />
      <FieldError message={formError} />
      <Button label={t('pets.save')} onPress={submit} loading={save.isPending} />
      {pet ? (
        <Button
          variant="secondary"
          icon="delete"
          label={t('pets.delete')}
          onPress={confirmDelete}
          loading={remove.isPending}
        />
      ) : null}
    </View>
  );
}

const PHOTO = 140;

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  photoArea: { alignItems: 'center', gap: spacing.sm },
  photo: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: radius.md * 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
