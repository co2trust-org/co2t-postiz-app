import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class PromoTemplateFieldDefDto {
  @IsString()
  key: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  placeholder?: string;
}

export class CreatePromoImageTemplateDto {
  @IsString()
  name: string;

  @IsString()
  promptTemplate: string;

  @IsOptional()
  @IsString()
  styleBlock?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromoTemplateFieldDefDto)
  fieldSchema?: PromoTemplateFieldDefDto[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  defaultTagIds?: string[];
}

export class UpdatePromoImageTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  promptTemplate?: string;

  @IsOptional()
  @IsString()
  styleBlock?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromoTemplateFieldDefDto)
  fieldSchema?: PromoTemplateFieldDefDto[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  defaultTagIds?: string[];
}

export class GeneratePromoImageDto {
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  includeBrandBrain?: boolean;

  @IsOptional()
  @IsString()
  brandBrainContext?: string;
}
