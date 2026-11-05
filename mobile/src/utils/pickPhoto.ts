import * as ImagePicker from 'expo-image-picker';

/** A photo picked on the phone, ready to upload with FormData. */
export interface PickedImage {
  uri: string;
  name: string;
  type: string;
}

/** Opens the gallery to choose one photo cropped to a square (profiles and pets). */
export async function pickSquarePhoto(): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return {
    uri: asset.uri,
    name: asset.fileName ?? 'photo.jpg',
    type: asset.mimeType ?? 'image/jpeg',
  };
}
