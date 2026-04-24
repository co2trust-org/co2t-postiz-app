import sharp from 'sharp';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fromBuffer } = require('file-type');

export const ALLOWED_UPLOAD_MIME_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/bmp',
  'image/tiff',
  'video/mp4',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
]);

export async function normalizeUploadBuffer(buffer: Buffer) {
  const detected = await fromBuffer(buffer);
  if (!detected || !ALLOWED_UPLOAD_MIME_TYPES.has(detected.mime)) {
    throw new Error('Unsupported file type.');
  }

  if (detected.mime.startsWith('image/') && detected.mime !== 'image/jpeg') {
    const converted = await sharp(buffer)
      .rotate()
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 95, progressive: false })
      .toBuffer();

    return {
      buffer: converted,
      ext: 'jpg',
      mime: 'image/jpeg',
      size: converted.length,
    };
  }

  return {
    buffer,
    ext: detected.mime === 'image/jpeg' ? 'jpg' : detected.ext,
    mime: detected.mime,
    size: buffer.length,
  };
}
