import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { SaveMediaInformationDto } from '@gitroom/nestjs-libraries/dtos/media/save.media.information.dto';
import { MediaApprovalStatus, MediaTier } from '@prisma/client';

@Injectable()
export class MediaRepository {
  constructor(private _media: PrismaRepository<'media'>) {}

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
    return this._media.model.media.create({
      data: {
        organization: {
          connect: {
            id: org,
          },
        },
        name: fileName,
        path: filePath,
        originalName: originalName || null,
        mediaTier: options?.mediaTier || MediaTier.PHOTO_SOURCE,
        approvalStatus: options?.approvalStatus || MediaApprovalStatus.PENDING,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        path: true,
        thumbnail: true,
        alt: true,
        thumbnailTimestamp: true,
        mediaTier: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        approvalNote: true,
      },
    });
  }

  getMediaById(id: string) {
    return this._media.model.media.findUnique({
      where: {
        id,
      },
    });
  }

  getMediaByIdForOrg(org: string, id: string) {
    return this._media.model.media.findUnique({
      where: {
        id,
        organizationId: org,
      },
    });
  }

  updateMediaFile(
    org: string,
    id: string,
    fileName: string,
    filePath: string,
    originalName?: string | null
  ) {
    return this._media.model.media.update({
      where: {
        id,
        organizationId: org,
      },
      data: {
        name: fileName,
        path: filePath,
        ...(originalName !== undefined ? { originalName } : {}),
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        path: true,
        thumbnail: true,
        alt: true,
        thumbnailTimestamp: true,
        mediaTier: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        approvalNote: true,
      },
    });
  }

  async updatePostMediaReferences(
    org: string,
    mediaId: string,
    media: {
      id: string;
      name: string;
      originalName: string | null;
      path: string;
      thumbnail?: string | null;
      alt?: string | null;
      thumbnailTimestamp?: number | null;
    }
  ) {
    const posts = await (this._media.model as any).post.findMany({
      where: {
        organizationId: org,
        deletedAt: null,
        image: {
          contains: mediaId,
        },
      },
      select: {
        id: true,
        image: true,
      },
    });

    await Promise.all(
      posts.map(async (post: { id: string; image: string | null }) => {
        let changed = false;
        const images = JSON.parse(post.image || '[]').map((item: any) => {
          if (item?.id !== mediaId) {
            return item;
          }
          changed = true;
          return {
            ...item,
            path: media.path,
            thumbnail: media.thumbnail ?? item.thumbnail ?? null,
            alt: media.alt ?? item.alt ?? null,
            thumbnailTimestamp:
              media.thumbnailTimestamp ?? item.thumbnailTimestamp ?? null,
          };
        });

        if (!changed) {
          return;
        }

        await (this._media.model as any).post.update({
          where: {
            id: post.id,
            organizationId: org,
          },
          data: {
            image: JSON.stringify(images),
          },
        });
      })
    );
  }

  deleteMedia(org: string, id: string) {
    return this._media.model.media.update({
      where: {
        id,
        organizationId: org,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  saveMediaInformation(org: string, data: SaveMediaInformationDto) {
    return this._media.model.media.update({
      where: {
        id: data.id,
        organizationId: org,
      },
      data: {
        alt: data.alt,
        thumbnail: data.thumbnail,
        thumbnailTimestamp: data.thumbnailTimestamp,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        alt: true,
        thumbnail: true,
        path: true,
        thumbnailTimestamp: true,
        mediaTier: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        approvalNote: true,
      },
    });
  }

  reviewMedia(
    org: string,
    id: string,
    approvalStatus: MediaApprovalStatus,
    userId: string,
    approvalNote?: string
  ) {
    const approved = approvalStatus === MediaApprovalStatus.APPROVED;

    return this._media.model.media.update({
      where: {
        id,
        organizationId: org,
      },
      data: {
        approvalStatus,
        approvalNote: approvalNote || null,
        mediaTier: approved ? MediaTier.READY_FOR_PUBLIC : undefined,
        approvedAt: approved ? new Date() : null,
        approvedByUserId: approved ? userId : null,
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        alt: true,
        thumbnail: true,
        path: true,
        thumbnailTimestamp: true,
        mediaTier: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        approvalNote: true,
      },
    });
  }

  async getMedia(
    org: string,
    page: number,
    search?: string,
    mediaTier?: MediaTier,
    approvalStatus?: MediaApprovalStatus
  ) {
    const pageNum = (page || 1) - 1;
    const trimmedSearch = search?.trim();
    const searchFilter = trimmedSearch
      ? {
          originalName: {
            contains: trimmedSearch,
            mode: 'insensitive' as const,
          },
        }
      : {};
    const tierFilter = mediaTier ? { mediaTier } : {};
    const approvalFilter = approvalStatus ? { approvalStatus } : {};
    const query = {
      where: {
        organization: {
          id: org,
        },
        deletedAt: null,
        ...searchFilter,
        ...tierFilter,
        ...approvalFilter,
      },
    };
    const pages = Math.ceil((await this._media.model.media.count(query)) / 18);
    const results = await this._media.model.media.findMany({
      where: {
        organizationId: org,
        deletedAt: null,
        ...searchFilter,
        ...tierFilter,
        ...approvalFilter,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        path: true,
        thumbnail: true,
        alt: true,
        thumbnailTimestamp: true,
        mediaTier: true,
        approvalStatus: true,
        approvedAt: true,
        approvedByUserId: true,
        approvalNote: true,
      },
      skip: pageNum * 18,
      take: 18,
    });

    return {
      pages,
      results,
    };
  }
}
