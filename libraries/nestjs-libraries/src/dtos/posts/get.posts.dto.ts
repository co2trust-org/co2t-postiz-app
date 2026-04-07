import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';

export class GetPostsDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  customer: string;

  @IsOptional()
  @IsString()
  integrationId?: string;

  @IsOptional()
  @IsArray()
  @IsIn(['QUEUE', 'DRAFT', 'PUBLISHED', 'ERROR'], { each: true })
  state?: ('QUEUE' | 'DRAFT' | 'PUBLISHED' | 'ERROR')[];
}
