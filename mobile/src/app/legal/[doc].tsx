import { Redirect, useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/Screen';
import { isLegalDocument, LegalDocument } from '@/features/legal/LegalDocument';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  if (!isLegalDocument(doc)) {
    return <Redirect href="/" />;
  }
  return (
    <Screen edges={['bottom']}>
      <LegalDocument doc={doc} />
    </Screen>
  );
}
