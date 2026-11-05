import { useVideoPlayer, VideoView } from 'expo-video';
import { StyleSheet } from 'react-native';

/** A post video with the platform's own playback controls. It does not autoplay. */
export function VideoItem({ uri, label }: { uri: string; label: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      accessibilityLabel={label}
      style={StyleSheet.absoluteFill}
    />
  );
}
