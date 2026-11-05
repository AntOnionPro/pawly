import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors, type FieldErrors } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { EMPTY_SIGN_UP, validateSignUp, type SignUpValues } from '@/auth/validation';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { DateField } from '@/components/DateField';
import { FieldError } from '@/components/FieldError';
import { TextField } from '@/components/TextField';
import { spacing } from '@/theme/typography';

interface SignUpFormProps {
  onSignedUp: (email: string) => void;
  onSignIn: () => void;
  onOpenLegal: (doc: 'terms' | 'privacy') => void;
}

export function SignUpForm({ onSignedUp, onSignIn, onOpenLegal }: SignUpFormProps) {
  const { t } = useTranslation();
  const { signUp } = useAuth();
  const [values, setValues] = useState<SignUpValues>(EMPTY_SIGN_UP);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof SignUpValues>(field: K, value: SignUpValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  const message = (field: string) => {
    const key = errors[field];
    return key ? t(key) : null;
  };

  async function submit() {
    setFormError(null);
    const found = validateSignUp(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }
    setSubmitting(true);
    try {
      await signUp(values);
      onSignedUp(values.email.trim());
    } catch (error) {
      setErrors(toFieldErrors(error));
      const key = requestErrorKey(requestErrorKind(error));
      setFormError(key ? t(key) : null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      <TextField
        label={t('auth.signUp.username')}
        hint={t('auth.signUp.usernameHint')}
        value={values.username}
        onChangeText={(text) => update('username', text.toLowerCase())}
        error={message('username')}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        maxLength={30}
      />
      <TextField
        label={t('auth.signUp.email')}
        value={values.email}
        onChangeText={(text) => update('email', text)}
        error={message('email')}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={t('auth.signUp.password')}
        hint={t('auth.signUp.passwordHint')}
        value={values.password}
        onChangeText={(text) => update('password', text)}
        error={message('password')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label={t('auth.signUp.passwordConfirm')}
        value={values.passwordConfirm}
        onChangeText={(text) => update('passwordConfirm', text)}
        error={message('passwordConfirm')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <DateField
        label={t('auth.signUp.dateOfBirth')}
        hint={t('auth.signUp.dateOfBirthHint')}
        placeholder={t('auth.signUp.datePlaceholder')}
        value={values.dateOfBirth}
        onChange={(value) => update('dateOfBirth', value)}
        error={message('dateOfBirth')}
      />
      <Checkbox
        label={t('auth.signUp.acceptTerms')}
        checked={values.acceptTerms}
        onChange={(checked) => update('acceptTerms', checked)}
        error={message('acceptTerms')}
      />
      <View style={styles.links}>
        <Button
          variant="link"
          icon="document"
          label={t('auth.signUp.readTerms')}
          onPress={() => onOpenLegal('terms')}
        />
        <Button
          variant="link"
          icon="document"
          label={t('auth.signUp.readPrivacy')}
          onPress={() => onOpenLegal('privacy')}
        />
      </View>
      <FieldError message={formError} />
      <Button label={t('auth.signUp.submit')} onPress={submit} loading={submitting} />
      <Button variant="link" label={t('auth.signUp.haveAccount')} onPress={onSignIn} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  links: { alignItems: 'flex-start' },
});
