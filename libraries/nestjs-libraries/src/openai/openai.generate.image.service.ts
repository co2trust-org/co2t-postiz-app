import { Injectable } from '@nestjs/common';
import {
  generateImage,
  GenerateImageResult,
} from '@gitroom/nestjs-libraries/lib/openai/generateImage';
import { GenerateImageBodyDto } from '@gitroom/nestjs-libraries/dtos/openai/generate.image.body.dto';

@Injectable()
export class OpenaiGenerateImageService {
  async generate(body: GenerateImageBodyDto): Promise<GenerateImageResult> {
    return generateImage(body.prompt, {
      size: body.size ?? '1024x1024',
      saveToPublic: body.save === true,
    });
  }
}
