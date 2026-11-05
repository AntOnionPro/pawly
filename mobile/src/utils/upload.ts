/** A local file chosen on the device, ready to upload. */
export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

/**
 * Adds a local file to a multipart form. React Native uploads it from `{ uri, name, type }`.
 * The web version (upload.web.ts) reads the file into a real `File`.
 */
export async function appendFile(form: FormData, field: string, file: UploadFile): Promise<void> {
  form.append(field, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
}
