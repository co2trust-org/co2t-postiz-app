import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';

/** Latest GPT image model in the official SDK; override with OPENAI_IMAGE_GEN_MODEL. */
const DEFAULT_MODEL =
  (process.env.OPENAI_IMAGE_GEN_MODEL || 'gpt-image-1.5').trim();

function requireOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  return new OpenAI({ apiKey });
}

function isGptImageModel(model: string) {
  return (
    model.startsWith('gpt-image') ||
    model === 'chatgpt-image-latest'
  );
}

export type GenerateImageOptions = {
  size?: string;
  filename?: string;
  saveToPublic?: boolean;
  outputDir?: string;
  model?: string;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  outputFormat?: 'png' | 'jpeg' | 'webp';
};

export type GenerateImageResult = {
  /** Temporary OpenAI URL (DALL·E + `url`) or a `data:` URL for GPT image models. */
  imageUrl: string;
  base64: string;
  buffer: Buffer;
  mimeType: string;
  localPublicPath?: string;
  absolutePath?: string;
  revisedPrompt?: string;
};

/**
 * Resolves the directory for optional saves to the frontend static tree
 * (`apps/frontend/public/generated`).
 */
export function resolveGeneratedImagesDirectory(explicit?: string): string {
  if (explicit) {
    return path.resolve(explicit);
  }
  if (process.env.GENERATED_IMAGE_PUBLIC_DIR) {
    return path.resolve(process.env.GENERATED_IMAGE_PUBLIC_DIR);
  }
  const cwd = process.cwd();
  const fromRoot = path.join(cwd, 'apps', 'frontend', 'public', 'generated');
  const fromBackend = path.join(cwd, '..', 'frontend', 'public', 'generated');
  if (existsSync(path.join(cwd, 'apps', 'frontend', 'public'))) {
    return fromRoot;
  }
  return fromBackend;
}

export async function generateImage(
  prompt: string,
  options: GenerateImageOptions = {}
): Promise<GenerateImageResult> {
  const {
    size = '1024x1024',
    filename,
    saveToPublic = false,
    outputDir,
    model = DEFAULT_MODEL,
    quality = 'high',
    outputFormat = 'png',
  } = options;

  const client = requireOpenAIClient();
  const gpt = isGptImageModel(model);

  const response = await client.images.generate({
    model,
    prompt,
    // Sizes differ by model; callers may pass any supported string from OpenAI docs.
    size: size as never,
    ...(gpt ? { quality, output_format: outputFormat } : {}),
    ...(!gpt ? { response_format: 'url' } : {}),
  });

  const first = response.data?.[0];
  if (!first) {
    throw new Error('OpenAI image generation returned no data');
  }

  const mimeType =
    outputFormat === 'jpeg'
      ? 'image/jpeg'
      : outputFormat === 'webp'
        ? 'image/webp'
        : 'image/png';

  let base64 = first.b64_json;
  const remoteUrl = first.url;

  if (!base64 && remoteUrl) {
    const res = await fetch(remoteUrl);
    if (!res.ok) {
      throw new Error(`Failed to download generated image: ${res.status}`);
    }
    const arrayBuf = await res.arrayBuffer();
    base64 = Buffer.from(arrayBuf).toString('base64');
  }

  if (!base64) {
    throw new Error('OpenAI did not return image bytes or a URL');
  }

  const buffer = Buffer.from(base64, 'base64');
  const imageUrl = remoteUrl ?? `data:${mimeType};base64,${base64}`;

  const ext =
    outputFormat === 'jpeg' ? 'jpg' : outputFormat === 'webp' ? 'webp' : 'png';
  const safeName =
    filename?.replace(/[^a-zA-Z0-9._-]/g, '_') ||
    `generated-${Date.now()}.${ext}`;

  let localPublicPath: string | undefined;
  let absolutePath: string | undefined;

  if (saveToPublic) {
    const dir = resolveGeneratedImagesDirectory(outputDir);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, safeName);
    await fs.writeFile(filePath, buffer);
    absolutePath = filePath;
    localPublicPath = `/generated/${safeName}`;
  }

  return {
    imageUrl,
    base64,
    buffer,
    mimeType,
    localPublicPath,
    absolutePath,
    revisedPrompt: first.revised_prompt,
  };
}
