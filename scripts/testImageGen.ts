import { generateImage } from '../libraries/nestjs-libraries/src/lib/openai/generateImage';

async function main() {
  const result = await generateImage(
    'Minimal social post graphic: sustainable brand, soft daylight, clean layout, no text in image',
    { saveToPublic: true, size: '1024x1024' }
  );

  console.log('imageUrl (truncated):', result.imageUrl.slice(0, 96) + '…');
  console.log('localPath:', result.localPublicPath);
  console.log('absolutePath:', result.absolutePath);
  console.log('bytes:', result.buffer.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
