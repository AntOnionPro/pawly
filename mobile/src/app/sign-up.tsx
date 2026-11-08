import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { WatercolorPet } from '@/components/WatercolorPet';
import { Wordmark } from '@/components/Wordmark';
import { SignUpForm } from '@/features/auth/SignUpForm';
import { spacing } from '@/theme/typography';

export default function SignUpScreen() {
  const router = useRouter();
  return (
    <Screen edges={['bottom']}>
      <View style={styles.brand}>
        <Wordmark height={56} />
      </View>
      <SignUpForm
        onSignedUp={(email) => router.replace({ pathname: '/check-email', params: { email } })}
        onSignIn={() => router.replace('/sign-in')}
        onOpenLegal={(doc) => router.push({ pathname: '/legal/[doc]', params: { doc } })}
      />
      <WatercolorPet />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The app's name above the fields, with room around it.
  brand: { alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.md },
});
