import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetPublicPortalPostsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) =>
    value === undefined || value === '' ? 0 : parseInt(value, 10)
  )
  page?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Transform(({ value }) =>
    value === undefined || value === '' ? 20 : parseInt(value, 10)
  )
  limit?: number = 20;
}
