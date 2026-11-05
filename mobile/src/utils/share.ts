import { Platform, Share } from 'react-native';

export interface ShareContent {
  message: string;
  url: string;
}

/** What happened: shared (or the sheet was closed), or the link was copied instead. */
export type ShareResult = 'shared' | 'copied';

/** Opens the system share sheet with a message and a link. Web: share.web.ts. */
export async function shareLink({ message, url }: ShareContent): Promise<ShareResult> {
  // iOS shares the link on its own; Android only takes a message.
  await Share.share(Platform.OS === 'ios' ? { message, url } : { message: `${message}\n${url}` });
  return 'shared';
}
