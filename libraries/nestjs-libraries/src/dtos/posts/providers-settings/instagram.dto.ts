import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsIn,
  IsString,
  ValidateNested,
  IsOptional,
} from 'class-validator';

export class Collaborators {
  @IsDefined()
  @IsString()
  label: string;
}
export class InstagramDto {
  /**
   * Feed/Reel vs Story (not Meta's image/video media_type). UI historically allowed "";
   * API clients may omit the key — normalize before @IsIn.
   */
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? 'post' : value
  )
  @IsIn(['post', 'story'])
  post_type: 'post' | 'story';

  @IsOptional()
  is_trial_reel?: boolean;

  @IsIn(['MANUAL', 'SS_PERFORMANCE'])
  @IsOptional()
  graduation_strategy?: 'MANUAL' | 'SS_PERFORMANCE';

  @Type(() => Collaborators)
  @ValidateNested({ each: true })
  @IsArray()
  @IsOptional()
  collaborators: Collaborators[];
}
