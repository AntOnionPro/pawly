import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

import type { ErrorKey } from '@/api/errors';
import type { UploadFile } from '@/utils/upload';

import { DOCUMENT_MAX_BYTES, DOCUMENT_TYPES } from './api';

const TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

export interface PickedDocuments {
  files: UploadFile[];
  /** Why some of the chosen files were left out. */
  errors: ErrorKey[];
}

/** The type the picker reports, or else the one the file name suggests. */
function documentType(name: string, mimeType: string | undefined): string {
  if (mimeType && mimeType !== 'application/octet-stream') return mimeType;
  return TYPE_BY_EXTENSION[name.split('.').pop()?.toLowerCase() ?? ''] ?? '';
}

/**
 * Opens the phone's file picker for up to `remaining` documents (PDF or photo). Files of
 * another type or over 10 MB are left out, with the reason.
 */
export async function pickDocuments(remaining: number): Promise<PickedDocuments> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [...DOCUMENT_TYPES],
    multiple: true,
    // On the web, a link to the file is enough: it is read when it is sent.
    base64: Platform.OS === 'web' ? false : undefined,
  });
  if (result.canceled) return { files: [], errors: [] };

  const files: UploadFile[] = [];
  const errors = new Set<ErrorKey>();
  for (const asset of result.assets) {
    const type = documentType(asset.name, asset.mimeType);
    if (!DOCUMENT_TYPES.some((allowed) => allowed === type)) {
      errors.add('errors.documentType');
    } else if ((asset.size ?? 0) > DOCUMENT_MAX_BYTES) {
      errors.add('errors.documentTooLarge');
    } else if (files.length < remaining) {
      files.push({ uri: asset.uri, name: asset.name, type });
    }
  }
  return { files, errors: [...errors] };
}
