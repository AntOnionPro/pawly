import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { Post, PostPage } from './api';
import { postKeys } from './hooks';

function isPost(data: unknown): data is Post {
  return typeof data === 'object' && data !== null && 'authorId' in data && 'media' in data;
}

function isPostPages(data: unknown): data is InfiniteData<PostPage> {
  return typeof data === 'object' && data !== null && 'pages' in data;
}

/** Applies `change` to the post `postId` wherever it is in a cached detail or list. */
export function mapPostInCache<T>(data: T, postId: string, change: (post: Post) => Post): T {
  if (isPost(data)) {
    return (data.id === postId ? change(data) : data) as T;
  }
  if (isPostPages(data)) {
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((post) => (post.id === postId ? change(post) : post)),
      })),
    } as T;
  }
  return data;
}

/** Updates a post in every cached screen (feed, grids, detail) without refetching. */
export function updateCachedPost(
  queryClient: QueryClient,
  postId: string,
  change: (post: Post) => Post,
): void {
  queryClient.setQueriesData({ queryKey: postKeys.all }, (data: unknown) =>
    mapPostInCache(data, postId, change),
  );
}
