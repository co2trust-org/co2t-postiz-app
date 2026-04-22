import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class GenerateImageBodyDto {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsBoolean()
  save?: boolean;
}
