import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors, type FieldErrors } from '@/api/errors';
import {
  avatarUrl,
  HOURS_MAX,
  NEEDS,
  NEEDS_NOTE_MAX,
  useAuth,
  ZONE_MAX,
  type Need,
  type ShelterProfile,
  type User,
} from '@/auth/AuthProvider';
import { BIO_MAX_LENGTH, normalizeUsername, validateUsername } from '@/auth/validation';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { CheckChipGroup } from '@/components/CheckChipGroup';
import { FieldError } from '@/components/FieldError';
import { HeaderAction } from '@/components/HeaderAction';
import { TextField } from '@/components/TextField';
import { ThemedText } from '@/components/ThemedText';
import { LocationField } from '@/features/rescue/LocationField';
import { spacing } from '@/theme/typography';
import { pickSquarePhoto, type PickedImage } from '@/utils/pickPhoto';

interface EditProfileFormProps {
  user: User;
  onSaved: () => void;
}

/** Photo: undefined = unchanged, null = removed, PickedImage = new one. */
type PhotoChange = PickedImage | null | undefined;

const NO_SHELTER: ShelterProfile = {
  zone: '',
  location: null,
  hours: '',
  needs: [],
  needsNote: '',
};

/**
 * Photo, username and bio. A verified shelter or rescuer also says where it is, when it attends
 * and what it needs.
 */
export function EditProfileForm({ user, onSaved }: EditProfileFormProps) {
  const { t } = useTranslation();
  const { client, updateProfile } = useAuth();
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio);
  const [photo, setPhoto] = useState<PhotoChange>(undefined);
  const [shelter, setShelter] = useState<ShelterProfile>(user.shelter ?? NO_SHELTER);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preview = photo === undefined ? avatarUrl(client, user) : (photo?.uri ?? null);
  const hasPhoto = preview !== null;
  const message = (field: string) => {
    const key = errors[field];
    return key ? t(key) : null;
  };

  function updateShelter(changes: Partial<ShelterProfile>) {
    setShelter((current) => ({ ...current, ...changes }));
  }

  async function choosePhoto() {
    const picked = await pickSquarePhoto();
    if (picked) setPhoto(picked);
  }

  async function save() {
    setFormError(null);
    const usernameError = validateUsername(username);
    const found: FieldErrors = usernameError ? { username: usernameError } : {};
    if (bio.trim().length > BIO_MAX_LENGTH) found.bio = 'errors.tooLong';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await updateProfile({
        username: normalizeUsername(username),
        bio,
        ...(photo === undefined ? {} : { avatar: photo }),
        ...(user.accountKind ? { shelter } : {}),
      });
      onSaved();
    } catch (error) {
      setErrors(toFieldErrors(error));
      const key = requestErrorKey(requestErrorKind(error));
      setFormError(key ? t(key) : null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.form}>
      <HeaderAction label={t('profile.edit.save')} loading={saving} onPress={() => void save()} />
      <FieldError message={formError} />
      <View style={styles.photo}>
        <Avatar uri={preview} username={username || user.username} size={120} />
        <View style={styles.photoActions}>
          <Button
            variant="link"
            icon="camera"
            label={hasPhoto ? t('profile.edit.changePhoto') : t('profile.edit.addPhoto')}
            onPress={choosePhoto}
          />
          {hasPhoto ? (
            <Button
              variant="link"
              icon="delete"
              label={t('profile.edit.removePhoto')}
              onPress={() => setPhoto(null)}
            />
          ) : null}
        </View>
      </View>
      <TextField
        label={t('auth.signUp.username')}
        hint={t('auth.signUp.usernameHint')}
        value={username}
        onChangeText={(text) => {
          setUsername(text.toLowerCase());
          setErrors((current) => ({ ...current, username: undefined }));
        }}
        error={message('username')}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={30}
      />
      <TextField
        label={t('profile.edit.bio')}
        hint={t('profile.edit.bioHint', { remaining: BIO_MAX_LENGTH - bio.length })}
        value={bio}
        onChangeText={(text) => {
          setBio(text);
          setErrors((current) => ({ ...current, bio: undefined }));
        }}
        error={message('bio')}
        multiline
        maxLength={BIO_MAX_LENGTH}
      />
      {user.accountKind ? (
        <View style={styles.form}>
          <View style={styles.heading}>
            <ThemedText variant="heading" accessibilityRole="header">
              {t(`shelter.title.${user.accountKind}`)}
            </ThemedText>
            <ThemedText color="textSecondary">{t('shelter.intro')}</ThemedText>
          </View>
          <TextField
            label={t('shelter.zone')}
            hint={t('shelter.zoneHint')}
            value={shelter.zone}
            onChangeText={(zone) => updateShelter({ zone })}
            error={message('zone')}
            maxLength={ZONE_MAX}
          />
          <LocationField
            label={t('shelter.point')}
            point={shelter.location}
            accuracy={accuracy}
            error={message('latitude')}
            onLocated={(location, meters) => {
              updateShelter({ location });
              setAccuracy(meters);
              setErrors((current) => ({ ...current, latitude: undefined }));
            }}
            onClear={() => {
              updateShelter({ location: null });
              setAccuracy(null);
            }}
          />
          <TextField
            label={t('shelter.hours')}
            placeholder={t('shelter.hoursPlaceholder')}
            value={shelter.hours}
            onChangeText={(hours) => updateShelter({ hours })}
            error={message('hours')}
            maxLength={HOURS_MAX}
          />
          <CheckChipGroup<Need>
            label={t('shelter.needs')}
            chips={NEEDS.map((value) => ({ value, label: t(`shelter.needNames.${value}`) }))}
            selected={shelter.needs}
            onChange={(needs) => updateShelter({ needs })}
            error={message('needs')}
          />
          <TextField
            label={t('shelter.needsNote')}
            placeholder={t('shelter.needsNotePlaceholder')}
            hint={t('posts.textCount', { used: shelter.needsNote.length, max: NEEDS_NOTE_MAX })}
            value={shelter.needsNote}
            onChangeText={(needsNote) => updateShelter({ needsNote })}
            error={message('needsNote')}
            multiline
            maxLength={NEEDS_NOTE_MAX}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  heading: { gap: spacing.xs, marginTop: spacing.md },
  photo: { alignItems: 'center', gap: spacing.sm },
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
