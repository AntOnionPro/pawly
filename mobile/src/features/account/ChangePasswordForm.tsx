import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors, type FieldErrors } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { validatePassword, validatePasswordConfirm } from '@/auth/validation';
import { FieldError } from '@/components/FieldError';
import { HeaderAction } from '@/components/HeaderAction';
import { TextField } from '@/components/TextField';
import { spacing } from '@/theme/typography';

export function ChangePasswordForm({ onChanged }: { onChanged: () => void }) {
  const { t } = useTranslation();
  const { changePassword } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const message = (field: string) => {
    const key = errors[field];
    return key ? t(key) : null;
  };

  async function save() {
    setFormError(null);
    const found: FieldErrors = {};
    if (!oldPassword) found.oldPassword = 'errors.required';
    const newError = validatePassword(password);
    if (newError) found.password = newError;
    const confirmError = validatePasswordConfirm(password, passwordConfirm);
    if (confirmError) found.passwordConfirm = confirmError;
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await changePassword(oldPassword, password, passwordConfirm);
      onChanged();
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
      <HeaderAction
        label={t('account.password.save')}
        loading={saving}
        onPress={() => void save()}
      />
      <FieldError message={formError} />
      <TextField
        label={t('account.password.current')}
        value={oldPassword}
        onChangeText={setOldPassword}
        error={message('oldPassword')}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />
      <TextField
        label={t('account.password.new')}
        hint={t('auth.signUp.passwordHint')}
        value={password}
        onChangeText={setPassword}
        error={message('password')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label={t('account.password.confirm')}
        value={passwordConfirm}
        onChangeText={setPasswordConfirm}
        error={message('passwordConfirm')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
