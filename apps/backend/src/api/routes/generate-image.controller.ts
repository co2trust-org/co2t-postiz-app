import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { GenerateImageBodyDto } from '@gitroom/nestjs-libraries/dtos/openai/generate.image.body.dto';
import { OpenaiGenerateImageService } from '@gitroom/nestjs-libraries/openai/openai.generate.image.service';

@ApiTags('AI')
@Controller('/generate-image')
export class GenerateImageController {
  constructor(private readonly _openaiGenerateImage: OpenaiGenerateImageService) {}

  @Post('/')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async generateImage(@Body() body: GenerateImageBodyDto) {
    const result = await this._openaiGenerateImage.generate(body);
    return {
      imageUrl: result.imageUrl,
      localPath: result.localPublicPath,
      revisedPrompt: result.revisedPrompt,
    };
  }
}
