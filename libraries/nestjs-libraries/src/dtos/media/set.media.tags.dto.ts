import { IsArray, IsUUID } from 'class-validator';

export class SetMediaTagsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds: string[];
}
