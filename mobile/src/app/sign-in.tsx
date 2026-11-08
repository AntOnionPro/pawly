import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { WatercolorCat } from '@/components/WatercolorCat';
import { Wordmark } from '@/components/Wordmark';
import { SignInForm } from '@/features/auth/SignInForm';
import { spacing } from '@/theme/typography';

export default function SignInScreen() {
  const router = useRouter();
  return (
    <Screen edges={['bottom']}>
      <View style={styles.brand}>
        <Wordmark height={56} />
      </View>
      <SignInForm
        onSignedIn={() => (router.canDismiss() ? router.dismissAll() : router.replace('/'))}
        onForgotPassword={() => router.push('/forgot-password')}
        onSignUp={() => router.replace('/sign-up')}
      />
      <WatercolorCat />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The app's name above the fields, with room around it.
  brand: { alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.md },
});
