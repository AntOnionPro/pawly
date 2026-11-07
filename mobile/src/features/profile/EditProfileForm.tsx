import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors, type FieldErrors } from '@/api/errors';
import { avatarUrl, useAuth, type User } from '@/auth/AuthProvider';
import { BIO_MAX_LENGTH, normalizeUsername, validateUsername } from '@/auth/validation';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { FieldError } from '@/components/FieldError';
import { HeaderAction } from '@/components/HeaderAction';
import { TextField } from '@/components/TextField';
import { spacing } from '@/theme/typography';
import { pickSquarePhoto, type PickedImage } from '@/utils/pickPhoto';

interface EditProfileFormProps {
  user: User;
  onSaved: () => void;
}

/** Photo: undefined = unchanged, null = removed, PickedImage = new one. */
type PhotoChange = PickedImage | null | undefined;

export function EditProfileForm({ user, onSaved }: EditProfileFormProps) {
  const { t } = useTranslation();
  const { client, updateProfile } = useAuth();
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio);
  const [photo, setPhoto] = useState<PhotoChange>(undefined);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preview = photo === undefined ? avatarUrl(client, user) : (photo?.uri ?? null);
  const hasPhoto = preview !== null;
  const message = (field: string) => {
    const key = errors[field];
    return key ? t(key) : null;
  };

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
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  photo: { alignItems: 'center', gap: spacing.sm },
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
