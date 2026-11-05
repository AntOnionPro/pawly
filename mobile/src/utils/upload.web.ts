import type { UploadFile } from './upload';

/** Web: the picked file is a blob or data URL, so it is read into a real `File`. */
export async function appendFile(form: FormData, field: string, file: UploadFile): Promise<void> {
  const blob = await (await fetch(file.uri)).blob();
  form.append(field, new File([blob], file.name, { type: file.type || blob.type }));
}
