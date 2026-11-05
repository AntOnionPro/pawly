import { createClient } from '@/api/client';
import { appendFile, uploadFetch } from '@/utils/upload';

/** Records what the app sends and answers like the server would. */
class FakeXhr {
  static last: FakeXhr | null = null;
  static reply: { status: number; body: string } | 'error' = { status: 200, body: '{}' };
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: unknown = null;
  status = 0;
  responseText = '';
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
    const reply = FakeXhr.reply;
    setTimeout(() => {
      if (reply === 'error') {
        this.onerror?.();
        return;
      }
      this.status = reply.status;
      this.responseText = reply.body;
      this.onload?.();
    }, 0);
  }
  abort() {
    this.onabort?.();
  }
}

const realXhr = globalThis.XMLHttpRequest;

beforeEach(() => {
  FakeXhr.last = null;
  FakeXhr.reply = { status: 200, body: '{}' };
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
});

afterAll(() => {
  globalThis.XMLHttpRequest = realXhr;
});

describe('uploadFetch', () => {
  it('sends the form with its method and headers, and reads the answer', async () => {
    FakeXhr.reply = { status: 200, body: '{"id":"p1"}' };
    const form = new FormData();
    await appendFile(form, 'photo', {
      uri: 'file:///foto.jpg',
      name: 'foto.jpg',
      type: 'image/jpeg',
    });
    const response = await uploadFetch!('http://pawly.test/api/collections/pets/records', {
      method: 'POST',
      headers: { Authorization: 'token' },
      body: form,
    });
    expect(FakeXhr.last).toMatchObject({
      method: 'POST',
      url: 'http://pawly.test/api/collections/pets/records',
      headers: { Authorization: 'token' },
    });
    expect(FakeXhr.last?.body).toBe(form);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'p1' });
  });

  it('fails like fetch when the server cannot be reached, and when cancelled', async () => {
    FakeXhr.reply = 'error';
    await expect(uploadFetch!('http://pawly.test', { method: 'POST' })).rejects.toThrow(
      'Network request failed',
    );

    const controller = new AbortController();
    FakeXhr.reply = { status: 200, body: '{}' };
    const pending = uploadFetch!('http://pawly.test', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('works with PocketBase: records come back and errors keep their status', async () => {
    const client = createClient('http://pawly.test');
    client.authStore.save('token-de-luna', null);
    FakeXhr.reply = {
      status: 200,
      body: '{"id":"p1","collectionId":"pets","name":"Michi"}',
    };
    const created = await client.collection('pets').create(new FormData(), { fetch: uploadFetch });
    expect(created).toMatchObject({ id: 'p1', name: 'Michi' });
    expect(FakeXhr.last?.headers.Authorization).toBe('token-de-luna');

    FakeXhr.reply = {
      status: 400,
      body: '{"status":400,"message":"x","data":{"photo":{"code":"validation_file_size_limit"}}}',
    };
    await expect(
      client.collection('pets').create(new FormData(), { fetch: uploadFetch }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
