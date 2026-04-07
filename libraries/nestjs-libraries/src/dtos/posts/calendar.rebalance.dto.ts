import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export type CadencePattern = 'daily' | 'every_other_day' | 'mwf';

export class CalendarRebalanceDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;

  @IsOptional()
  @IsString()
  integrationId?: string;

  @IsOptional()
  @IsIn(['daily', 'every_other_day', 'mwf'])
  cadence?: CadencePattern;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxPerDay?: number;
}
