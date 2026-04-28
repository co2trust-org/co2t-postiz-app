import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { MediaRepository } from '@gitroom/nestjs-libraries/database/prisma/media/media.repository';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { MediaApprovalStatus, MediaTier, Organization } from '@prisma/client';
import { SaveMediaInformationDto } from '@gitroom/nestjs-libraries/dtos/media/save.media.information.dto';
import { VideoManager } from '@gitroom/nestjs-libraries/videos/video.manager';
import { VideoDto } from '@gitroom/nestjs-libraries/dtos/videos/video.dto';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import {
  AuthorizationActions,
  Sections,
  SubscriptionException,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';

@Injectable()
export class MediaService {
  private storage = UploadFactory.createStorage();

  constructor(
    private _mediaRepository: MediaRepository,
    private _openAi: OpenaiService,
    private _subscriptionService: SubscriptionService,
    private _videoManager: VideoManager
  ) {}

  async deleteMedia(org: string, id: string) {
    return this._mediaRepository.deleteMedia(org, id);
  }

  async convertMediaToJpg(org: string, id: string) {
    const media = await this._mediaRepository.getMediaByIdForOrg(org, id);
    if (!media || media.deletedAt) {
      throw new BadRequestException('Media not found');
    }

    if (media.path.toLowerCase().includes('.mp4')) {
      throw new BadRequestException('Only image media can be converted to JPG');
    }

    const response = await fetch(media.path);
    if (!response.ok) {
      throw new BadRequestException('Could not fetch media file');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const uploaded = await this.storage.uploadFile({
      buffer,
      mimetype: response.headers.get('content-type') || 'application/octet-stream',
      size: buffer.length,
      path: '',
      fieldname: 'file',
      destination: '',
      stream: buffer as any,
      filename: media.name,
      originalname: media.originalName || media.name,
      encoding: '',
    });

    if (uploaded.mimetype !== 'image/jpeg') {
      throw new BadRequestException('Only image media can be converted to JPG');
    }

    const updatedMedia = await this._mediaRepository.updateMediaFile(
      org,
      id,
      uploaded.originalname,
      uploaded.path,
      uploaded.originalname
    );

    await this._mediaRepository.updatePostMediaReferences(
      org,
      id,
      updatedMedia
    );

    return updatedMedia;
  }

  getMediaById(id: string) {
    return this._mediaRepository.getMediaById(id);
  }

  async generateImage(
    prompt: string,
    org: Organization,
    generatePromptFirst?: boolean
  ) {
    const generating = await this._subscriptionService.useCredit(
      org,
      'ai_images',
      async () => {
        if (generatePromptFirst) {
          prompt = await this._openAi.generatePromptForPicture(prompt);
          console.log('Prompt:', prompt);
        }
        return this._openAi.generateImage(prompt, !!generatePromptFirst);
      }
    );

    return generating;
  }

  /**
   * Expand prompt with generatePromptForPicture, render image, upload, and persist as AI_SOURCE media.
   * @returns Saved media row or false when Stripe-gated credits are exhausted.
   */
  async generateImageWithPromptUploadAndSave(
    org: Organization,
    prompt: string
  ) {
    const total = await this._subscriptionService.checkCredits(org);
    if (process.env.STRIPE_PUBLISHABLE_KEY && total.credits <= 0) {
      return false;
    }

    const raw = await this.generateImage(prompt, org, true);
    const payload =
      typeof raw === 'string' && raw.startsWith('data:')
        ? raw
        : `data:image/png;base64,${raw}`;

    const file = await this.storage.uploadSimple(payload);

    return this.saveFile(
      org.id,
      file.split('/').pop()!,
      file,
      undefined,
      { mediaTier: MediaTier.AI_SOURCE }
    );
  }

  saveFile(
    org: string,
    fileName: string,
    filePath: string,
    originalName?: string,
    options?: {
      mediaTier?: MediaTier;
      approvalStatus?: MediaApprovalStatus;
    }
  ) {
    if (
      options?.mediaTier &&
      !Object.values(MediaTier).includes(options.mediaTier)
    ) {
      throw new BadRequestException('Invalid media tier');
    }

    if (
      options?.approvalStatus &&
      !Object.values(MediaApprovalStatus).includes(options.approvalStatus)
    ) {
      throw new BadRequestException('Invalid media approval status');
    }

    return this._mediaRepository.saveFile(
      org,
      fileName,
      filePath,
      originalName,
      options
    );
  }

  getMedia(
    org: string,
    page: number,
    search?: string,
    mediaTier?: MediaTier,
    approvalStatus?: MediaApprovalStatus,
    tagId?: string
  ) {
    if (mediaTier && !Object.values(MediaTier).includes(mediaTier)) {
      throw new BadRequestException('Invalid media tier');
    }

    if (
      approvalStatus &&
      !Object.values(MediaApprovalStatus).includes(approvalStatus)
    ) {
      throw new BadRequestException('Invalid media approval status');
    }

    return this._mediaRepository.getMedia(
      org,
      page,
      search,
      mediaTier,
      approvalStatus,
      tagId
    );
  }

  async setMediaTags(orgId: string, mediaId: string, tagIds: string[]) {
    const result = await this._mediaRepository.setMediaTags(
      orgId,
      mediaId,
      tagIds
    );
    if (!result.ok) {
      if (result.reason === 'not_found') {
        throw new BadRequestException('Media not found');
      }
      throw new BadRequestException('One or more tags are invalid');
    }
    const row = await this._mediaRepository.getMediaItemWithTagsForOrg(
      orgId,
      mediaId
    );
    if (!row) {
      throw new BadRequestException('Media not found');
    }
    const { tags, ...rest } = row;
    return {
      ...rest,
      tags: tags.map((t) => t.tag),
    };
  }

  saveMediaInformation(org: string, data: SaveMediaInformationDto) {
    return this._mediaRepository.saveMediaInformation(org, data);
  }

  reviewMedia(
    org: string,
    id: string,
    approvalStatus: MediaApprovalStatus,
    userId: string,
    approvalNote?: string
  ) {
    return this._mediaRepository.reviewMedia(
      org,
      id,
      approvalStatus,
      userId,
      approvalNote
    );
  }

  getVideoOptions() {
    return this._videoManager.getAllVideos();
  }

  async generateVideoAllowed(org: Organization, type: string) {
    const video = this._videoManager.getVideoByName(type);
    if (!video) {
      throw new Error(`Video type ${type} not found`);
    }

    if (!video.trial && org.isTrailing) {
      throw new HttpException('This video is not available in trial mode', 406);
    }

    return true;
  }

  async generateVideo(org: Organization, body: VideoDto) {
    const totalCredits = await this._subscriptionService.checkCredits(
      org,
      'ai_videos'
    );

    if (totalCredits.credits <= 0) {
      throw new SubscriptionException({
        action: AuthorizationActions.Create,
        section: Sections.VIDEOS_PER_MONTH,
      });
    }

    const video = this._videoManager.getVideoByName(body.type);
    if (!video) {
      throw new Error(`Video type ${body.type} not found`);
    }

    if (!video.trial && org.isTrailing) {
      throw new HttpException('This video is not available in trial mode', 406);
    }

    console.log(body.customParams);
    await video.instance.processAndValidate(body.customParams);
    console.log('no err');

    return await this._subscriptionService.useCredit(
      org,
      'ai_videos',
      async () => {
        const loadedData = await video.instance.process(
          body.output,
          body.customParams
        );

        const file = await this.storage.uploadSimple(loadedData);
        return this.saveFile(org.id, file.split('/').pop(), file, undefined, {
          mediaTier: MediaTier.AI_SOURCE,
        });
      }
    );
  }

  async videoFunction(identifier: string, functionName: string, body: any) {
    const video = this._videoManager.getVideoByName(identifier);
    if (!video) {
      throw new Error(`Video with identifier ${identifier} not found`);
    }

    // @ts-ignore
    const functionToCall = video.instance[functionName];
    if (
      typeof functionToCall !== 'function' ||
      this._videoManager.checkAvailableVideoFunction(functionToCall)
    ) {
      throw new HttpException(
        `Function ${functionName} not found on video instance`,
        400
      );
    }

    return functionToCall(body);
  }
}
