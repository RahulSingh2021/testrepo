import { compressImage } from '@/utils/imageCompression';

export const handlePasteImages = async (
  e: React.ClipboardEvent,
  onImage: (compressed: string) => void,
) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (!file) continue;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const compressed = await compressImage(ev.target?.result as string);
          onImage(compressed);
        } catch {
          const raw = ev.target?.result as string;
          if (raw) onImage(raw);
        }
      };
      reader.readAsDataURL(file);
    }
  }
};

export const pasteFromClipboard = async (onImage: (compressed: string) => void) => {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find(t => t.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const compressed = await compressImage(ev.target?.result as string);
            onImage(compressed);
          } catch {
            const raw = ev.target?.result as string;
            if (raw) onImage(raw);
          }
        };
        reader.readAsDataURL(blob);
      }
    }
  } catch {
    console.warn('[paste] Clipboard read not supported or denied');
  }
};
