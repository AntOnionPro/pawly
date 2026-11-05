import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { palette } from '@/theme/colors';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

import { formatDuration, type ComposerMedia } from './media';

interface MediaStripProps {
  media: ComposerMedia[];
  onRemove: (index: number) => void;
}

const SIZE = 96;

/** Previews of the photos and videos chosen for a new post, each with a remove button. */
export function MediaStrip({ media, onRemove }: MediaStripProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  if (media.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {media.map((item, index) => (
        <View
          key={`${item.uri}-${index}`}
          style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {item.kind === 'photo' ? (
            <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={styles.video}>
              <Icon name="video" selected size={28} color={colors.text} />
              {item.duration ? (
                <ThemedText variant="caption">{formatDuration(item.duration)}</ThemedText>
              ) : null}
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('posts.removeMedia', { number: index + 1 })}
            hitSlop={8}
            onPress={() => onRemove(index)}
            style={styles.remove}>
            {/* Black and white so the button is visible on any photo. */}
            <View style={styles.removeBackground}>
              <Icon name="remove" selected size={24} color={palette.white} />
            </View>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  tile: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  video: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  remove: { position: 'absolute', top: spacing.xs, right: spacing.xs },
  removeBackground: { backgroundColor: palette.black, borderRadius: 12 },
});
