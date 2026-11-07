import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { ThemedText } from '@/components/ThemedText';
import { palette } from '@/theme/colors';
import { useThemeColors } from '@/preferences/PreferencesProvider';
import { radius, spacing } from '@/theme/typography';

import { formatDuration, type ComposerMedia } from './media';

/** What a tile shows: a chosen file, or one already saved (`uri` is then its thumbnail). */
export type MediaTile = Pick<ComposerMedia, 'uri' | 'kind' | 'duration'>;

interface MediaStripProps {
  media: MediaTile[];
  onRemove: (index: number) => void;
  /** Shows a last "+" tile that adds more files. */
  onAdd?: () => void;
  /** Read by screen readers on the "+" tile (for example, how many files are left). */
  addHint?: string;
}

const SIZE = 96;

/** Previews of the photos and videos of a post, each with a remove button, and "+" to add. */
export function MediaStrip({ media, onRemove, onAdd, addHint }: MediaStripProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  if (media.length === 0 && !onAdd) return null;
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
      {onAdd ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('posts.addMedia')}
          accessibilityHint={addHint}
          onPress={onAdd}
          style={({ pressed }) => [
            styles.tile,
            styles.add,
            { borderColor: colors.textSecondary },
            pressed && styles.pressed,
          ]}>
          <Icon name="add" size={32} color={colors.text} />
        </Pressable>
      ) : null}
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
  add: { borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
