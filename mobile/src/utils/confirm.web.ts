import type { ConfirmOptions } from './confirm';

/** Browser confirmation dialog (React Native's Alert does nothing on the web). */
export function confirm({ title, message }: ConfirmOptions): Promise<boolean> {
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}
