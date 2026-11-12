import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors, type FieldErrors } from '@/api/errors';
import { toIsoDate } from '@/auth/validation';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { DateField } from '@/components/DateField';
import { FieldError } from '@/components/FieldError';
import { HeaderAction } from '@/components/HeaderAction';
import { TextField } from '@/components/TextField';
import { ThemedText } from '@/components/ThemedText';
import { SPECIES, type Species } from '@/features/pets/api';
import { usePets } from '@/features/pets/hooks';
import { mediaKind, mediaUrl } from '@/features/posts/api';
import { pickPostMedia, type ComposerMedia } from '@/features/posts/media';
import { MediaStrip } from '@/features/posts/MediaStrip';
import { spacing } from '@/theme/typography';
import { confirm } from '@/utils/confirm';

import {
  RESCUE_DESCRIPTION_MAX,
  RESCUE_FILES_MAX,
  RESCUE_KINDS,
  RESCUE_PLACE_MAX,
  URGENCIES,
  type RescueKind,
  type RescueReport,
  type RescueValues,
  type Urgency,
} from './api';
import { useDeleteRescueReport, useSaveRescueReport } from './hooks';
import { LocationField } from './LocationField';

/** A file in the form: a stored one (`stored` is its name) or a new one from the gallery. */
type FormMedia = ComposerMedia & { stored?: string };

type FormValues = Omit<RescueValues, 'newMedia' | 'removedMedia'>;

export function validateRescue(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.kind) errors.kind = 'errors.required';
  if (!values.description.trim()) errors.description = 'errors.required';
  if (values.kind === 'help' && !values.urgency) errors.urgency = 'errors.required';
  if (values.kind === 'lost' && !values.lastSeenDate) errors.lastSeenAt = 'errors.dateRequired';
  if (values.latitude === null || values.longitude === null) {
    errors.latitude = 'errors.locationRequired';
  }
  return errors;
}

interface RescueFormProps {
  /** The report to edit, or undefined to create one. */
  report?: RescueReport;
  /** Kind and pet chosen beforehand (for example, "Report as lost" on a pet's profile). */
  kind?: RescueKind;
  petId?: string;
  onSaved: (report: RescueReport) => void;
  onDeleted?: () => void;
}

/** Reports an animal that needs help, a lost pet or a found animal, or edits the report. */
export function RescueForm({ report, kind, petId, onSaved, onDeleted }: RescueFormProps) {
  const { t } = useTranslation();
  const { client, user } = useAuth();
  const { data: pets = [] } = usePets(user?.id);
  const save = useSaveRescueReport();
  const remove = useDeleteRescueReport();
  const [values, setValues] = useState<FormValues>({
    kind: report?.kind ?? kind ?? '',
    species: report?.species ?? '',
    description: report?.description ?? '',
    place: report?.place ?? '',
    urgency: report?.urgency ?? '',
    petId: report?.petId ?? petId ?? '',
    lastSeenDate: report?.lastSeenAt.slice(0, 10) || toIsoDate(new Date()),
    latitude: report ? report.latitude : null,
    longitude: report ? report.longitude : null,
  });
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [media, setMedia] = useState<FormMedia[]>(
    (report?.media ?? []).map((name) => ({
      uri: mediaUrl(client, report as RescueReport, name, '300x300'),
      name,
      type: '',
      kind: mediaKind(name),
      stored: name,
    })),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const remaining = RESCUE_FILES_MAX - media.length;

  function update<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    const errorField =
      field === 'lastSeenDate' ? 'lastSeenAt' : field === 'petId' ? 'pet' : String(field);
    setErrors((current) => ({ ...current, [errorField]: undefined }));
  }

  const message = (field: string) => {
    const key = errors[field];
    return key ? t(key) : null;
  };

  function showError(error: unknown) {
    const fieldErrors = toFieldErrors(error);
    setErrors(fieldErrors);
    const shown = [
      'kind',
      'species',
      'description',
      'urgency',
      'pet',
      'lastSeenAt',
      'place',
      'latitude',
    ];
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
    setMedia((current) => [...current, ...picked.media].slice(0, RESCUE_FILES_MAX));
    setFormErrors(picked.errors.map((key) => t(key)));
  }

  async function submit() {
    setFormErrors([]);
    const found = validateRescue(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const kept = new Set(media.flatMap((item) => (item.stored ? [item.stored] : [])));
    try {
      onSaved(
        await save.mutateAsync({
          id: report?.id,
          values: {
            ...values,
            newMedia: media.filter((item) => !item.stored),
            removedMedia: (report?.media ?? []).filter((name) => !kept.has(name)),
          },
        }),
      );
    } catch (error) {
      showError(error);
    }
  }

  async function confirmDelete() {
    if (!report) return;
    const confirmed = await confirm({
      title: t('rescue.deleteConfirmTitle'),
      message: t('rescue.deleteConfirmMessage'),
      confirmLabel: t('rescue.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await remove.mutateAsync(report.id);
      onDeleted?.();
    } catch (error) {
      showError(error);
    }
  }

  const chosenKind = values.kind;

  return (
    <View style={styles.form}>
      <HeaderAction
        label={report ? t('rescue.save') : t('rescue.publish')}
        pendingLabel={report ? undefined : t('rescue.publishing')}
        loading={save.isPending}
        onPress={() => void submit()}
      />
      {formErrors.map((text) => (
        <FieldError key={text} message={text} />
      ))}
      {report ? (
        <ThemedText variant="title" accessibilityRole="header">
          {t(`rescue.kinds.${report.kind}`)}
        </ThemedText>
      ) : (
        <ChipGroup<RescueKind>
          label={t('rescue.kind')}
          chips={RESCUE_KINDS.map((value) => ({ value, label: t(`rescue.kinds.${value}`) }))}
          selected={values.kind}
          onSelect={(value) => update('kind', value)}
          error={message('kind')}
        />
      )}
      {chosenKind === 'lost' && values.petId ? null : (
        // A lost pet's report takes the pet's species (on the server).
        <ChipGroup<Species>
          label={t('rescue.species')}
          chips={SPECIES.map((value) => ({ value, label: t(`pets.speciesNames.${value}`) }))}
          selected={values.species}
          onSelect={(value) => update('species', values.species === value ? '' : value)}
          error={message('species')}
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
      {chosenKind === 'help' ? (
        <ChipGroup<Urgency>
          label={t('rescue.urgency')}
          chips={URGENCIES.map((value) => ({ value, label: t(`rescue.urgencies.${value}`) }))}
          selected={values.urgency}
          onSelect={(value) => update('urgency', value)}
          error={message('urgency')}
        />
      ) : null}
      {chosenKind === 'lost' && pets.length > 0 ? (
        <ChipGroup<string>
          label={t('rescue.pet')}
          chips={pets.map((pet) => ({ value: pet.id, label: pet.name }))}
          selected={values.petId}
          onSelect={(value) => update('petId', values.petId === value ? '' : value)}
          error={message('pet')}
        />
      ) : null}
      {chosenKind === 'lost' ? (
        <DateField
          label={t('rescue.lastSeenDate')}
          placeholder={t('pets.datePlaceholder')}
          value={values.lastSeenDate}
          onChange={(value) => update('lastSeenDate', value)}
          error={message('lastSeenAt')}
        />
      ) : null}
      <TextField
        label={t('rescue.description')}
        placeholder={chosenKind ? t(`rescue.descriptionHint.${chosenKind}`) : undefined}
        hint={t('posts.textCount', {
          used: values.description.length,
          max: RESCUE_DESCRIPTION_MAX,
        })}
        value={values.description}
        onChangeText={(text) => update('description', text)}
        error={message('description')}
        multiline
        maxLength={RESCUE_DESCRIPTION_MAX}
      />
      <LocationField
        label={t('rescue.location')}
        point={
          values.latitude !== null && values.longitude !== null
            ? { latitude: values.latitude, longitude: values.longitude }
            : null
        }
        kind={values.kind}
        accuracy={accuracy}
        error={message('latitude')}
        onLocated={({ latitude, longitude }, meters) => {
          setValues((current) => ({ ...current, latitude, longitude }));
          setAccuracy(meters);
          setErrors((current) => ({ ...current, latitude: undefined }));
        }}
      />
      <TextField
        label={t('rescue.place')}
        hint={t('rescue.placeHint')}
        value={values.place}
        onChangeText={(text) => update('place', text)}
        error={message('place')}
        maxLength={RESCUE_PLACE_MAX}
      />
      {report ? (
        <Button
          variant="secondary"
          icon="delete"
          label={t('rescue.delete')}
          onPress={confirmDelete}
          loading={remove.isPending}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
