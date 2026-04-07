import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePostDto } from '@gitroom/nestjs-libraries/dtos/posts/create.post.dto';
import { PatchPostDto } from '@gitroom/nestjs-libraries/dtos/posts/patch.post.dto';

export class BulkCreatePostsDto {
  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePostDto)
  items: CreatePostDto[];
}

export class BulkPatchPostItemDto {
  @IsDefined()
  @IsString()
  postId: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => PatchPostDto)
  patch: PatchPostDto;
}

export class BulkPatchPostsDto {
  @IsDefined()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkPatchPostItemDto)
  items: BulkPatchPostItemDto[];
}
