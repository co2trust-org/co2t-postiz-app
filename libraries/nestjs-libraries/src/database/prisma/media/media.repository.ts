import {
  PrismaRepository,
  PrismaService,
} from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { SaveMediaInformationDto } from '@gitroom/nestjs-libraries/dtos/media/save.media.information.dto';
import { MediaApprovalStatus, MediaTier, Prisma } from '@prisma/client';

@Injectable()
export class MediaRepository {
  constructor(
    private _media: PrismaRepository<'media'>,
    private _prisma: PrismaService
  ) {}

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

  async setMediaTags(orgId: string, mediaId: string, tagIds: string[]) {
    const media = await this._media.model.media.findFirst({
      where: { id: mediaId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!media) {
      return { ok: false as const, reason: 'not_found' as const };
    }
    if (tagIds.length) {
      const validTags = await this._prisma.tags.findMany({
        where: {
          id: { in: tagIds },
          orgId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (validTags.length !== tagIds.length) {
        return { ok: false as const, reason: 'invalid_tags' as const };
      }
    }
    await this._prisma.$transaction([
      this._prisma.tagsMedia.deleteMany({ where: { mediaId } }),
      ...(tagIds.length
        ? [
            this._prisma.tagsMedia.createMany({
              data: tagIds.map((tagId) => ({ mediaId, tagId })),
            }),
          ]
        : []),
    ]);
    return { ok: true as const };
  }

  getMediaItemWithTagsForOrg(orgId: string, mediaId: string) {
    return this._media.model.media.findFirst({
      where: {
        id: mediaId,
        organizationId: orgId,
        deletedAt: null,
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
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });
  }

  async getMedia(
    org: string,
    page: number,
    search?: string,
    mediaTier?: MediaTier,
    approvalStatus?: MediaApprovalStatus,
    tagId?: string
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
    const tagFilter: Prisma.MediaWhereInput = tagId
      ? {
          tags: {
            some: {
              tagId,
              tag: { orgId: org, deletedAt: null },
            },
          },
        }
      : {};
    const baseWhere = {
      organizationId: org,
      deletedAt: null,
      ...searchFilter,
      ...tierFilter,
      ...approvalFilter,
      ...tagFilter,
    };
    const query = {
      where: baseWhere,
    };
    const pages = Math.ceil((await this._media.model.media.count(query)) / 18);
    const results = await this._media.model.media.findMany({
      where: baseWhere,
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
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
      skip: pageNum * 18,
      take: 18,
    });

    const resultsFlat = results.map(
      (row: (typeof results)[number]) => {
        const { tags, ...rest } = row;
        return {
          ...rest,
          tags: tags.map((t) => t.tag),
        };
      }
    );

    return {
      pages,
      results: resultsFlat,
    };
  }
}
