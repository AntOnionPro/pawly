import { Alert } from 'react-native';

/** Short native message with an OK button. Web: notify.web.ts. */
export function notify(message: string): void {
  Alert.alert(message);
}
