export const IMAGE_MIMETYPES_MAY_BE_ANIMATED = [
  'image/gif',
  'image/webp',
  'image/apng',
  'image/avif',
];

export function mayBeAnimated(mimetype?: string): boolean {
  return !!mimetype && IMAGE_MIMETYPES_MAY_BE_ANIMATED.includes(mimetype.toLowerCase());
}

function arrayBufferRead(arr: ArrayBuffer, start: number, len: number): Uint8Array {
  return new Uint8Array(arr.slice(start, start + len));
}

function arrayBufferReadInt(arr: ArrayBuffer, start: number): number {
  return new DataView(arr, start, 4).getUint32(0);
}

function arrayBufferReadStr(arr: ArrayBuffer, start: number, len: number): string {
  return String.fromCharCode.apply(null, Array.from(arrayBufferRead(arr, start, len)));
}

// Byte-probes a blob to determine whether it actually contains animation.
export async function blobIsAnimated(mimeType: string | undefined, blob: Blob): Promise<boolean> {
  switch (mimeType) {
    case 'image/webp': {
      // Only the extended file format (VP8X) supports animation.
      const arr = await blob.slice(0, 17).arrayBuffer();
      if (
        arrayBufferReadStr(arr, 0, 4) === 'RIFF' &&
        arrayBufferReadStr(arr, 8, 4) === 'WEBP' &&
        arrayBufferReadStr(arr, 12, 4) === 'VP8X'
      ) {
        const [flags] = arrayBufferRead(arr, 16, 1);
        const animationFlagMask = 1 << 1;
        return (flags & animationFlagMask) !== 0;
      }
      return false;
    }

    case 'image/gif': {
      const dv = new DataView(await blob.arrayBuffer(), 10);
      const globalColorTable = dv.getUint8(0);
      let globalColorTableSize = 0;
      if (globalColorTable & 0x80) {
        globalColorTableSize = 3 * Math.pow(2, (globalColorTable & 0x7) + 1);
      }
      const offset = 3 + globalColorTableSize;
      const extensionIntroducer = dv.getUint8(offset);
      const graphicsControlLabel = dv.getUint8(offset + 1);
      let delayTime = 0;
      if (extensionIntroducer & 0x21 && graphicsControlLabel & 0xf9) {
        delayTime = dv.getUint16(offset + 4);
      }
      return !!delayTime;
    }

    case 'image/png':
    case 'image/apng': {
      const arr = await blob.arrayBuffer();
      const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      const actual = Array.from(arrayBufferRead(arr, 0, 8));
      if (!signature.every((byte, i) => byte === actual[i])) return false;
      for (let i = 8; i < blob.size; ) {
        const length = arrayBufferReadInt(arr, i);
        i += 4;
        const type = arrayBufferReadStr(arr, i, 4);
        i += 4;
        if (type === 'acTL') return true;
        if (type === 'IDAT') return false;
        i += length + 4;
      }
      return false;
    }

    default:
      return false;
  }
}

const ALPHA_FORMATS = ['image/gif', 'image/apng', 'image/png', 'image/webp'];

export function stillExportFormat(mimetype?: string): string {
  return ALPHA_FORMATS.includes(mimetype ?? '') ? 'image/png' : 'image/jpeg';
}

export function firstFrameToBlobUrl(
  img: HTMLImageElement,
  mimetype?: string
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        resolve(null);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        resolve(URL.createObjectURL(blob));
      }, stillExportFormat(mimetype));
    } catch {
      resolve(null);
    }
  });
}
