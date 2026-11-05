/** A local file chosen on the device, ready to upload. */
export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

/** What PocketBase reads from a response (the `fetch` option of its requests). */
type UploadFetch = (url: RequestInfo | URL, config?: RequestInit) => Promise<Response>;

/**
 * Adds a local file to a multipart form. React Native uploads it from `{ uri, name, type }`.
 * The web version (upload.web.ts) reads the file into a real `File`.
 */
export async function appendFile(form: FormData, field: string, file: UploadFile): Promise<void> {
  form.append(field, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
}

/**
 * Sends a form with files using React Native's XMLHttpRequest, which reads each file from its
 * `uri` and streams it from disk. Expo's global `fetch` (SDK 58) does not accept React Native
 * files in FormData, so uploads go through this instead: pass it as `{ fetch: uploadFetch }`.
 */
export const uploadFetch: UploadFetch | undefined = (url, config = {}) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(config.method ?? 'GET', String(url));
    const headers = (config.headers ?? {}) as Record<string, string>;
    for (const [name, value] of Object.entries(headers)) {
      xhr.setRequestHeader(name, value);
    }
    const signal = config.signal;
    signal?.addEventListener('abort', () => xhr.abort());
    xhr.onload = () => {
      const text = xhr.responseText;
      resolve({
        status: xhr.status,
        ok: xhr.status >= 200 && xhr.status < 300,
        url: String(url),
        json: async () => JSON.parse(text),
        text: async () => text,
      } as Response);
    };
    xhr.onerror = () => reject(new TypeError('Network request failed'));
    xhr.ontimeout = () => reject(new TypeError('Network request timed out'));
    // PocketBase recognizes cancelled requests by this name.
    xhr.onabort = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    xhr.send((config.body ?? null) as XMLHttpRequestBodyInit | null);
  });
