import * as ImagePicker from 'expo-image-picker';

import type { ErrorKey } from '@/api/errors';

/** Limits shared with the server, plus the video length that only the app can check. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;

/** A photo or video chosen in the composer, ready to upload. */
export interface ComposerMedia {
  uri: string;
  name: string;
  type: string;
  kind: 'photo' | 'video';
  /** Seconds, for videos. */
  duration?: number;
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

/** What a picked asset becomes: a file to upload, or the reason it was left out. */
export type CheckedAsset = { ok: true; media: ComposerMedia } | { ok: false; error: ErrorKey };

export function checkAsset(asset: ImagePicker.ImagePickerAsset, index: number): CheckedAsset {
  const kind = asset.type === 'video' ? 'video' : 'photo';
  const type = asset.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg');
  const size = asset.fileSize ?? 0;
  const seconds = (asset.duration ?? 0) / 1000;

  if (kind === 'video' && seconds > MAX_VIDEO_SECONDS)
    return { ok: false, error: 'errors.videoTooLong' };
  if (kind === 'video' && size > MAX_VIDEO_BYTES)
    return { ok: false, error: 'errors.videoTooLarge' };
  if (kind === 'photo' && size > MAX_PHOTO_BYTES)
    return { ok: false, error: 'errors.photoTooLarge' };

  const extension = EXTENSIONS[type] ?? (kind === 'video' ? 'mp4' : 'jpg');
  const name = asset.fileName?.includes('.')
    ? asset.fileName
    : `${kind}-${Date.now()}-${index}.${extension}`;
  return {
    ok: true,
    media: { uri: asset.uri, name, type, kind, duration: kind === 'video' ? seconds : undefined },
  };
}

export interface PickResult {
  media: ComposerMedia[];
  /** Reasons some items were left out, without repeats. */
  errors: ErrorKey[];
}

/** Opens the gallery to choose up to `limit` photos and videos. */
export async function pickPostMedia(limit: number): Promise<PickResult> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    orderedSelection: true,
    quality: 0.8,
    // iOS: JPEG instead of HEIC, and videos compressed to 720p before uploading.
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
    videoMaxDuration: MAX_VIDEO_SECONDS,
  });
  if (result.canceled) return { media: [], errors: [] };
  const checked = result.assets.slice(0, limit).map(checkAsset);
  return {
    media: checked.flatMap((item) => (item.ok ? [item.media] : [])),
    errors: [...new Set(checked.flatMap((item) => (item.ok ? [] : [item.error])))],
  };
}

/** "0:42" for a duration in seconds. */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
