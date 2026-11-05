/** Browser message (React Native's Alert does nothing on the web). */
export function notify(message: string): void {
  window.alert(message);
}
