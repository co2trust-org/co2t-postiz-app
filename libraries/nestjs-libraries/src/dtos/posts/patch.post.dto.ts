import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsDefined,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MediaDto } from '@gitroom/nestjs-libraries/dtos/media/media.dto';
import {
  allProviders,
  type AllProvidersSettings,
  EmptySettings,
} from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/all.providers.settings';
import { ValidContent } from '@gitroom/helpers/utils/valid.images';

export class PatchPostSegmentDto {
  @IsDefined()
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  @Validate(ValidContent)
  content?: string;

  @IsOptional()
  @IsNumber()
  delay?: number;

  @IsOptional()
  @IsArray()
  @Type(() => MediaDto)
  @ValidateNested({ each: true })
  image?: MediaDto[];
}

export class PatchPostDto {
  @IsOptional()
  @IsDateString()
  publishDate?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmptySettings, {
    keepDiscriminatorProperty: true,
    discriminator: {
      property: '__type',
      subTypes: allProviders(EmptySettings),
    },
  })
  settings?: AllProvidersSettings;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PatchPostSegmentDto)
  segments?: PatchPostSegmentDto[];

  /** When true, reschedule linked Temporal workflow (same as PUT .../date with action schedule). */
  @IsOptional()
  rescheduleWorkflow?: boolean;

  @IsOptional()
  @IsIn(['schedule', 'update'])
  dateAction?: 'schedule' | 'update';
}
