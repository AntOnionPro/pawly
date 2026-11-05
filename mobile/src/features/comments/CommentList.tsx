import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Loading, LoadError } from '@/components/QueryState';
import { ThemedText } from '@/components/ThemedText';
import { spacing } from '@/theme/typography';

import { flattenComments } from './api';
import { CommentItem } from './CommentItem';
import { useComments } from './hooks';

interface CommentListProps {
  postId: string;
  postAuthorId: string;
  onPressAuthor?: (authorId: string) => void;
}

/** The comments of a post, oldest first, with "show more" at the end. */
export function CommentList({ postId, postAuthorId, onPressAuthor }: CommentListProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data, error, isPending, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useComments(postId);
  const comments = flattenComments(data?.pages ?? []);

  return (
    <View style={styles.section}>
      <ThemedText variant="heading" accessibilityRole="header">
        {t('comments.title')}
      </ThemedText>
      {isPending ? <Loading /> : null}
      {error && !data ? <LoadError error={error} onRetry={() => void refetch()} /> : null}
      {data && comments.length === 0 ? (
        <ThemedText color="textSecondary">{t('comments.empty')}</ThemedText>
      ) : null}
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          isMine={Boolean(user && comment.authorId === user.id)}
          isPostAuthor={Boolean(user && postAuthorId === user.id)}
          onPressAuthor={onPressAuthor}
        />
      ))}
      {hasNextPage ? (
        <Button
          variant="link"
          label={t('comments.loadMore')}
          loading={isFetchingNextPage}
          onPress={() => void fetchNextPage()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
});
