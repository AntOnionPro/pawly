import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { spacing } from '@/theme/typography';

export type LegalDocumentName = 'terms' | 'privacy';

const SECTIONS = {
  terms: ['use', 'content', 'moderation', 'deletion', 'changes'],
  privacy: ['controller', 'data', 'purposes', 'sharing', 'rights', 'changes'],
} as const;

export function isLegalDocument(value: unknown): value is LegalDocumentName {
  return value === 'terms' || value === 'privacy';
}

/** Terms of service or privacy notice. Drafts until stage 9. */
export function LegalDocument({ doc }: { doc: LegalDocumentName }) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <ThemedText variant="title" accessibilityRole="header">
        {t(`legal.${doc}.title`)}
      </ThemedText>
      <ThemedText variant="label" color="textSecondary">
        {t('legal.draft')}
      </ThemedText>
      {SECTIONS[doc].map((section) => (
        <View key={section} style={styles.section}>
          <ThemedText variant="heading" accessibilityRole="header">
            {t(`legal.${doc}.${section}Title` as `legal.terms.useTitle`)}
          </ThemedText>
          <ThemedText>{t(`legal.${doc}.${section}Body` as `legal.terms.useBody`)}</ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  section: { gap: spacing.xs },
});
