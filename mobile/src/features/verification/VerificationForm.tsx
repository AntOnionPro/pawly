import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors, type FieldErrors } from '@/api/errors';
import { ACCOUNT_KINDS, type AccountKind } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { FieldError } from '@/components/FieldError';
import { HeaderAction } from '@/components/HeaderAction';
import { Icon } from '@/components/Icon';
import { IconButton } from '@/components/IconButton';
import { TextField } from '@/components/TextField';
import { ThemedText } from '@/components/ThemedText';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';
import type { UploadFile } from '@/utils/upload';

import {
  ABOUT_MAX,
  DOCUMENTS_MAX,
  LINKS_MAX,
  PUBLIC_NAME_MAX,
  PUBLIC_NAME_MIN,
  type VerificationRequest,
  type VerificationValues,
} from './api';
import { pickDocuments } from './documents';
import { useSendVerification } from './hooks';

export function validateVerification(values: VerificationValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.kind) errors.kind = 'errors.required';
  const name = values.publicName.trim();
  if (!name) errors.publicName = 'errors.required';
  else if (name.length < PUBLIC_NAME_MIN) errors.publicName = 'errors.nameTooShort';
  if (!values.about.trim()) errors.about = 'errors.required';
  if (values.kind === 'shelter' && values.documents.length === 0) {
    errors.documents = 'errors.documentsRequired';
  }
  return errors;
}

interface VerificationFormProps {
  /** An earlier request to start from (for example, a rejected one). */
  previous?: VerificationRequest | null;
  onSent?: () => void;
}

/**
 * Asks Pawly to verify the account as a constituted shelter (with its documents) or as an
 * independent rescuer. "Send" goes in the top bar.
 */
export function VerificationForm({ previous, onSent }: VerificationFormProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const send = useSendVerification();
  const [values, setValues] = useState<VerificationValues>({
    kind: previous?.kind ?? '',
    publicName: previous?.publicName ?? '',
    about: previous?.about ?? '',
    links: previous?.links ?? '',
    // The files of an earlier request are not sent again: they are chosen anew.
    documents: [],
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const remaining = DOCUMENTS_MAX - values.documents.length;

  function update<K extends keyof VerificationValues>(field: K, value: VerificationValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  const message = (field: string) => {
    const key = errors[field];
    return key ? t(key) : null;
  };

  async function addDocuments() {
    const picked = await pickDocuments(remaining);
    setFormErrors(picked.errors.map((key) => t(key)));
    if (picked.files.length > 0) {
      update('documents', [...values.documents, ...picked.files].slice(0, DOCUMENTS_MAX));
    }
  }

  function removeDocument(file: UploadFile) {
    update(
      'documents',
      values.documents.filter((item) => item !== file),
    );
  }

  async function submit() {
    setFormErrors([]);
    const found = validateVerification(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    try {
      await send.mutateAsync(values);
      onSent?.();
    } catch (error) {
      const fieldErrors = toFieldErrors(error);
      setErrors(fieldErrors);
      const shown = ['kind', 'publicName', 'about', 'links', 'documents'];
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
  }

  return (
    <View style={styles.form}>
      <HeaderAction
        label={t('verification.send')}
        pendingLabel={t('verification.sending')}
        loading={send.isPending}
        onPress={() => void submit()}
      />
      {formErrors.map((text) => (
        <FieldError key={text} message={text} />
      ))}
      <ChipGroup<AccountKind>
        label={t('verification.kind')}
        chips={ACCOUNT_KINDS.map((value) => ({ value, label: t(`verification.kinds.${value}`) }))}
        selected={values.kind}
        onSelect={(value) => update('kind', value)}
        error={message('kind')}
      />
      {values.kind ? (
        <ThemedText variant="caption" color="textSecondary">
          {t(`verification.kindHint.${values.kind}`)}
        </ThemedText>
      ) : null}
      <TextField
        label={t('verification.publicName')}
        hint={t('verification.publicNameHint')}
        value={values.publicName}
        onChangeText={(text) => update('publicName', text)}
        error={message('publicName')}
        maxLength={PUBLIC_NAME_MAX}
      />
      <TextField
        label={t('verification.about')}
        placeholder={t('verification.aboutPlaceholder')}
        hint={t('posts.textCount', { used: values.about.length, max: ABOUT_MAX })}
        value={values.about}
        onChangeText={(text) => update('about', text)}
        error={message('about')}
        multiline
        maxLength={ABOUT_MAX}
      />
      <TextField
        label={t('verification.links')}
        hint={t('verification.linksHint')}
        value={values.links}
        onChangeText={(text) => update('links', text)}
        error={message('links')}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        maxLength={LINKS_MAX}
      />
      {values.kind === 'shelter' ? (
        <View style={styles.documents}>
          <ThemedText variant="label" color="textSecondary">
            {t('verification.documents')}
          </ThemedText>
          <ThemedText variant="caption" color="textSecondary">
            {t('verification.documentsHint', { max: DOCUMENTS_MAX })}
          </ThemedText>
          {values.documents.map((file) => (
            <View
              key={file.uri}
              style={[
                styles.document,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
              <Icon name="document" size={20} color={colors.text} />
              <ThemedText numberOfLines={1} style={styles.documentName}>
                {file.name}
              </ThemedText>
              <IconButton
                icon="remove"
                label={t('verification.removeDocument', { name: file.name })}
                onPress={() => removeDocument(file)}
              />
            </View>
          ))}
          {remaining > 0 ? (
            <Button
              variant="secondary"
              icon="document"
              label={t('verification.addDocuments')}
              onPress={() => void addDocuments()}
            />
          ) : null}
          <FieldError message={message('documents')} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  documents: { gap: spacing.sm },
  document: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  documentName: { flex: 1 },
});
