import { MediaApprovalStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class MediaApprovalDto {
  @IsEnum(MediaApprovalStatus)
  approvalStatus: MediaApprovalStatus;

  @IsString()
  @IsOptional()
  approvalNote?: string;
}
