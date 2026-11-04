import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { requestErrorKey, requestErrorKind, toFieldErrors, type FieldErrors } from '@/api/errors';
import { useAuth } from '@/auth/AuthProvider';
import { validateSignIn } from '@/auth/validation';
import { Button } from '@/components/Button';
import { FieldError } from '@/components/FieldError';
import { TextField } from '@/components/TextField';
import { ThemedText } from '@/components/ThemedText';
import { spacing } from '@/theme/typography';

interface SignInFormProps {
  onSignedIn: () => void;
  onForgotPassword: () => void;
  onSignUp: () => void;
}

export function SignInForm({ onSignedIn, onForgotPassword, onSignUp }: SignInFormProps) {
  const { t } = useTranslation();
  const { signIn, requestVerification } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const message = (field: string) => {
    const key = errors[field];
    return key ? t(key) : null;
  };

  async function submit() {
    setFormError(null);
    setUnverified(false);
    setResent(false);
    const found = validateSignIn(email, password);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email, password);
      onSignedIn();
    } catch (error) {
      const kind = requestErrorKind(error);
      setErrors(toFieldErrors(error));
      setUnverified(kind === 'unverified');
      const key = requestErrorKey(kind);
      setFormError(key ? t(key) : null);
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    try {
      await requestVerification(email);
      setResent(true);
    } catch (error) {
      const key = requestErrorKey(requestErrorKind(error));
      setFormError(key ? t(key) : null);
    }
  }

  return (
    <View style={styles.form}>
      <TextField
        label={t('auth.signIn.email')}
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setErrors((current) => ({ ...current, email: undefined }));
        }}
        error={message('email')}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={t('auth.signIn.password')}
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          setErrors((current) => ({ ...current, password: undefined }));
        }}
        error={message('password')}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
      />
      <FieldError message={formError} />
      {unverified ? (
        resent ? (
          <ThemedText color="textSecondary">{t('auth.signIn.resent')}</ThemedText>
        ) : (
          <Button
            variant="secondary"
            icon="mail"
            label={t('auth.signIn.resend')}
            onPress={resend}
          />
        )
      ) : null}
      <Button label={t('auth.signIn.submit')} onPress={submit} loading={submitting} />
      <Button variant="link" label={t('auth.signIn.forgot')} onPress={onForgotPassword} />
      <Button variant="link" label={t('auth.signIn.noAccount')} onPress={onSignUp} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});
