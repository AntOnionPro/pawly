import type { ShareContent, ShareResult } from './share';

export type { ShareContent, ShareResult } from './share';

/** Browser share menu when there is one (phones); otherwise copies the link. */
export async function shareLink({ message, url }: ShareContent): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text: message, url });
    } catch (error) {
      // Closing the menu is not an error.
      if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
    }
    return 'shared';
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}
