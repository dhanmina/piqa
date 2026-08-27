import { Image, Modal, Pressable } from 'react-native';

export function PhotoViewerModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  return (
    <Modal visible={!!url} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }}
        onPress={onClose}
      >
        {url ? <Image source={{ uri: url }} style={{ width: '100%', height: '70%' }} resizeMode="contain" /> : null}
      </Pressable>
    </Modal>
  );
}
