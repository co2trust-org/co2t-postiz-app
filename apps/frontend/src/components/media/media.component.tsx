'use client';

import React, {
  ChangeEvent,
  ClipboardEvent,
  FC,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '@gitroom/react/form/button';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Media } from '@prisma/client';
import { useMediaDirectory } from '@gitroom/react/helpers/use.media.directory';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import EventEmitter from 'events';
import { useToaster } from '@gitroom/react/toaster/toaster';
import clsx from 'clsx';
import { VideoFrame } from '@gitroom/react/helpers/video.frame';
import { useUppyUploader } from '@gitroom/frontend/components/media/new.uploader';
import dynamic from 'next/dynamic';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { AiImage } from '@gitroom/frontend/components/launches/ai.image';
import { DropFiles } from '@gitroom/frontend/components/layout/drop.files';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { ThirdPartyMedia } from '@gitroom/frontend/components/third-parties/third-party.media';
import { ReactSortable } from 'react-sortablejs';
import { MediaComponentInner } from '@gitroom/frontend/components/launches/helpers/media.settings.component';
import { AiVideo } from '@gitroom/frontend/components/launches/ai.video';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { ThirdPartyMediaLibrary } from '@gitroom/frontend/components/third-parties/third-party.media-library';
import { MediaTagsEditor } from '@gitroom/frontend/components/media/media.tags.editor';
import { Dashboard } from '@uppy/react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  DeleteCircleIcon,
  CloseCircleIcon,
  DragHandleIcon,
  MediaSettingsIcon,
  InsertMediaIcon,
  DesignMediaIcon,
  VerticalDividerIcon,
  NoMediaIcon,
} from '@gitroom/frontend/components/ui/icons';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useShallow } from 'zustand/react/shallow';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useDebounce } from 'use-debounce';
const Polonto = dynamic(
  () => import('@gitroom/frontend/components/launches/polonto')
);
const showModalEmitter = new EventEmitter();
export const Pagination: FC<{
  current: number;
  totalPages: number;
  setPage: (num: number) => void;
}> = (props) => {
  const t = useT();

  const { current, totalPages, setPage } = props;

  const paginationItems = useMemo(() => {
    // Convert to 1-based for algorithm (current is 0-based)
    const c = current + 1;
    const m = totalPages;

    // If total pages <= 10, show all pages
    if (m <= 10) {
      return Array.from({ length: m }, (_, i) => i + 1);
    }

    const delta = 3;
    const left = c - delta;
    const right = c + delta + 1;
    const range: number[] = [];
    const rangeWithDots: (number | '...')[] = [];
    let l: number | undefined;

    // Build the range of pages to show
    for (let i = 1; i <= m; i++) {
      if (i === 1 || i === m || (i >= left && i < right)) {
        range.push(i);
      }
    }

    // Add dots where there are gaps
    for (const i of range) {
      if (l !== undefined) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    // Limit to maximum 10 items by trimming pages near edges if needed
    while (rangeWithDots.length > 10) {
      const currentIndex = rangeWithDots.findIndex((item) => item === c);
      if (currentIndex !== -1 && currentIndex > rangeWithDots.length / 2) {
        // Current is in second half, remove one item from start side
        rangeWithDots.splice(2, 1);
      } else {
        // Current is in first half, remove one item from end side
        rangeWithDots.splice(-3, 1);
      }
    }

    return rangeWithDots;
  }, [current, totalPages]);

  return (
    <ul className="flex flex-row items-center gap-1 justify-center mt-[15px]">
      <li className={clsx(current === 0 && 'opacity-20 pointer-events-none')}>
        <div
          className="cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 px-4 py-2 gap-1 ps-2.5 text-gray-400 hover:text-white border-[#1F1F1F] hover:bg-forth"
          aria-label="Go to previous page"
          onClick={() => setPage(current - 1)}
        >
          <ChevronLeftIcon className="lucide lucide-chevron-left h-4 w-4" />
          <span>{t('previous', 'Previous')}</span>
        </div>
      </li>
      {paginationItems.map((item, index) => (
        <li key={index}>
          {item === '...' ? (
            <span className="inline-flex items-center justify-center h-10 w-10 text-textColor select-none">
              ...
            </span>
          ) : (
            <div
              aria-current="page"
              onClick={() => setPage(item - 1)}
              className={clsx(
                'cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border hover:bg-forth h-10 w-10 hover:text-white border-newBorder',
                current === item - 1
                  ? 'bg-forth !text-white'
                  : 'text-textColor hover:text-white'
              )}
            >
              {item}
            </div>
          )}
        </li>
      ))}
      <li
        className={clsx(
          current + 1 === totalPages && 'opacity-20 pointer-events-none'
        )}
      >
        <a
          className="text-textColor hover:text-white group cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-10 px-4 py-2 gap-1 pe-2.5 text-gray-400 border-[#1F1F1F] hover:bg-forth"
          aria-label="Go to next page"
          onClick={() => setPage(current + 1)}
        >
          <span>{t('next', 'Next')}</span>
          <ChevronRightIcon className="lucide lucide-chevron-right h-4 w-4" />
        </a>
      </li>
    </ul>
  );
};
export const ShowMediaBoxModal: FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [callBack, setCallBack] =
    useState<(params: { id: string; path: string }[]) => void | undefined>();
  const closeModal = useCallback(() => {
    setShowModal(false);
    setCallBack(undefined);
  }, []);
  useEffect(() => {
    showModalEmitter.on('show-modal', (cCallback) => {
      setShowModal(true);
      setCallBack(() => cCallback);
    });
    return () => {
      showModalEmitter.removeAllListeners('show-modal');
    };
  }, []);
  if (!showModal) return null;
  return (
    <div className="text-textColor">
      <MediaBox setMedia={callBack!} closeModal={closeModal} />
    </div>
  );
};
export const showMediaBox = (
  callback: (params: { id: string; path: string }) => void
) => {
  showModalEmitter.emit('show-modal', callback);
};
const CHUNK_SIZE = 1024 * 1024;
const MAX_UPLOAD_SIZE = 1024 * 1024 * 1024; // 1 GB
type MediaTierValue = 'PHOTO_SOURCE' | 'AI_SOURCE' | 'READY_FOR_PUBLIC';
type MediaApprovalStatusValue = 'PENDING' | 'APPROVED' | 'REJECTED';
type MediaWithWorkflow = Media & {
  mediaTier?: MediaTierValue;
  approvalStatus?: MediaApprovalStatusValue;
  approvedAt?: string | null;
  approvedByUserId?: string | null;
  approvalNote?: string | null;
};
const READY_FOR_PUBLIC: MediaTierValue = 'READY_FOR_PUBLIC';
const PHOTO_SOURCE: MediaTierValue = 'PHOTO_SOURCE';
const AI_SOURCE: MediaTierValue = 'AI_SOURCE';
const MEDIA_TIER_OPTIONS: Array<{
  value: MediaTierValue;
  label: string;
  description: string;
}> = [
  {
    value: READY_FOR_PUBLIC,
    label: 'Ready for Public',
    description: 'Approved assets for publishing',
  },
  {
    value: PHOTO_SOURCE,
    label: 'Photo Sources',
    description: 'Uploaded source photos',
  },
  {
    value: AI_SOURCE,
    label: 'AI Sources',
    description: 'AI-generated images',
  },
];
const MEDIA_STATUS_LABELS: Record<MediaApprovalStatusValue, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};
export const MediaBox: FC<{
  setMedia: (params: { id: string; path: string }[]) => void;
  standalone?: boolean;
  type?: 'image' | 'video';
  closeModal: () => void;
}> = ({ type, standalone, setMedia }) => {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);
  const [filterTagId, setFilterTagId] = useState('');
  const fetch = useFetch();
  const modals = useModals();
  const toaster = useToaster();
  const user = useUser();
  const canReviewMedia = ['ADMIN', 'SUPERADMIN'].includes(user?.role || '');
  const availableTiers = useMemo(
    () =>
      canReviewMedia
        ? MEDIA_TIER_OPTIONS
        : MEDIA_TIER_OPTIONS.filter((tier) => tier.value === READY_FOR_PUBLIC),
    [canReviewMedia]
  );
  const [activeTier, setActiveTier] =
    useState<MediaTierValue>(READY_FOR_PUBLIC);
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, activeTier, filterTagId]);

  const loadFilterTagOptions = useCallback(async () => {
    const r = await fetch('/posts/tags');
    const j = await r.json();
    return Array.isArray(j) ? j : j?.tags ?? [];
  }, [fetch]);
  const { data: filterTagOptions } = useSWR(
    'media-library-tag-filter-options',
    loadFilterTagOptions
  );
  useEffect(() => {
    if (!availableTiers.some((tier) => tier.value === activeTier)) {
      setActiveTier(READY_FOR_PUBLIC);
    }
  }, [activeTier, availableTiers]);
  const loadMedia = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page + 1) });
    params.set('mediaTier', activeTier);
    if (activeTier === READY_FOR_PUBLIC) {
      params.set('approvalStatus', 'APPROVED');
    }
    if (debouncedSearch.trim()) {
      params.set('search', debouncedSearch.trim());
    }
    if (filterTagId) {
      params.set('tagId', filterTagId);
    }
    return (await fetch(`/media?${params.toString()}`)).json();
  }, [page, debouncedSearch, activeTier, filterTagId]);
  const { data, mutate, isLoading } = useSWR(
    `get-media-${page}-${debouncedSearch}-${activeTier}-${filterTagId}`,
    loadMedia
  );
  const [selected, setSelected] = useState([]);
  const t = useT();
  const uploaderRef = useRef<any>(null);
  const mediaDirectory = useMediaDirectory();
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [converting, setConverting] = useState<Record<string, boolean>>({});

  const uppy = useUppyUploader({
    allowedFileTypes:
      type == 'image'
        ? 'image/*'
        : type == 'video'
        ? 'video/mp4'
        : 'image/*,video/mp4',
    mediaTier: PHOTO_SOURCE,
    onUploadSuccess: async (arr) => {
      await mutate();
      if (activeTier !== PHOTO_SOURCE) {
        toaster.show(
          t(
            'uploaded_to_photo_sources',
            'Uploaded media was added to Photo Sources for review.'
          ),
          'success'
        );
      }
      if (standalone) {
        return;
      }
      setSelected((prevSelected) => {
        return [...prevSelected, ...arr];
      });
    },
    onStart: () => setLoading(true),
    onEnd: () => setLoading(false),
  });

  const addRemoveSelected = useCallback(
    (media: any) => () => {
      if (standalone) {
        return;
      }
      const exists = selected.find((p: any) => p.id === media.id);
      if (exists) {
        setSelected(selected.filter((f: any) => f.id !== media.id));
        return;
      }
      setSelected([...selected, media]);
    },
    [selected]
  );

  const addMedia = useCallback(async () => {
    if (standalone) {
      return;
    }
    // @ts-ignore
    setMedia(selected);
    modals.closeCurrent();
  }, [selected]);

  const addToUpload = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const totalSize = files.reduce((acc, file) => acc + file.size, 0);

      if (totalSize > MAX_UPLOAD_SIZE) {
        toaster.show(
          t(
            'upload_size_limit_exceeded',
            'Upload size limit exceeded. Maximum 1 GB per upload session.'
          ),
          'warning'
        );
        return;
      }

      setLoading(true);

      // @ts-ignore
      uppy.addFiles(files);
    },
    [toaster, t]
  );

  const dragAndDrop = useCallback(
    async (event: ClipboardEvent<HTMLDivElement> | File[]) => {
      // @ts-ignore
      const clipboardItems = event.map((p) => ({
        kind: 'file',
        getAsFile: () => p,
      }));
      if (!clipboardItems) {
        return;
      }

      const files: File[] = [];
      // @ts-ignore
      for (const item of clipboardItems) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      const totalSize = files.reduce((acc, file) => acc + file.size, 0);

      if (totalSize > MAX_UPLOAD_SIZE) {
        toaster.show(
          t(
            'upload_size_limit_exceeded',
            'Upload size limit exceeded. Maximum 1 GB per upload session.'
          ),
          'warning'
        );
        return;
      }

      setLoading(true);

      for (const file of files) {
        uppy.addFile(file);
      }
    },
    [toaster, t]
  );

  const openTagsModal = useCallback(
    (media: { id: string; tags?: { id: string }[] }) => (e: any) => {
      e.stopPropagation();
      modals.openModal({
        title: t('media_tags', 'Media tags'),
        children: (close) => (
          <MediaTagsEditor
            mediaId={media.id}
            initialSelectedIds={(media.tags || []).map((x) => x.id)}
            onClose={close}
            onSaved={() => mutate()}
          />
        ),
      });
    },
    [modals, mutate, t]
  );

  const maximize = useCallback(
    (media: Media) => async (e: any) => {
      e.stopPropagation();
      modals.openModal({
        title: '',
        top: 10,
        children: (
          <div className="w-full h-full p-[50px]">
            {media.path.indexOf('mp4') > -1 ? (
              <VideoFrame
                autoplay={true}
                url={mediaDirectory.set(media.path)}
              />
            ) : (
              <img
                width="100%"
                height="100%"
                className="w-full h-full max-h-[100%] max-w-[100%] object-cover"
                src={mediaDirectory.set(media.path)}
                alt="media"
              />
            )}
          </div>
        ),
      });
    },
    []
  );

  const deleteImage = useCallback(
    (media: Media) => async (e: any) => {
      e.stopPropagation();
      if (
        !(await deleteDialog(
          t(
            'are_you_sure_you_want_to_delete_the_image',
            'Are you sure you want to delete the image?'
          )
        ))
      ) {
        return;
      }
      await fetch(`/media/${media.id}`, {
        method: 'DELETE',
      });
      mutate();
    },
    [mutate]
  );

  const convertToJpg = useCallback(
    (media: Media) => async (e: any) => {
      e.stopPropagation();
      if (media.path.indexOf('mp4') > -1) {
        toaster.show(
          t('only_images_can_be_converted', 'Only images can be converted.'),
          'warning'
        );
        return;
      }

      setConverting((current) => ({ ...current, [media.id]: true }));
      try {
        const response = await fetch(`/media/${media.id}/convert-to-jpg`, {
          method: 'POST',
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.message || 'Could not convert media');
        }

        toaster.show(
          t('media_converted_to_jpg', 'Media converted to JPG.'),
          'success'
        );
        await mutate();
      } catch (err: any) {
        toaster.show(
          err?.message ||
            t('could_not_convert_media', 'Could not convert media.'),
          'warning'
        );
      } finally {
        setConverting((current) => {
          const next = { ...current };
          delete next[media.id];
          return next;
        });
      }
    },
    [mutate, toaster, t]
  );

  const convertSelectedToJpg = useCallback(async () => {
    const images = selected.filter(
      (media: any) => media?.path?.indexOf('mp4') === -1
    );

    if (!images.length) {
      toaster.show(
        t('select_images_to_convert', 'Select one or more images to convert.'),
        'warning'
      );
      return;
    }

    setConverting((current) => ({
      ...current,
      ...Object.fromEntries(images.map((media: any) => [media.id, true])),
    }));

    try {
      const converted = await Promise.all(
        images.map(async (media: any) => {
          const response = await fetch(`/media/${media.id}/convert-to-jpg`, {
            method: 'POST',
          });
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body?.message || 'Could not convert media');
          }
          return response.json();
        })
      );

      const convertedById = new Map(
        converted.map((media: any) => [media.id, media])
      );
      setSelected((current: any[]) =>
        current.map((media: any) => convertedById.get(media.id) || media)
      );

      toaster.show(
        t('selected_media_converted_to_jpg', 'Selected media converted to JPG.'),
        'success'
      );
      await mutate();
    } catch (err: any) {
      toaster.show(
        err?.message ||
          t('could_not_convert_media', 'Could not convert media.'),
        'warning'
      );
    } finally {
      setConverting((current) => {
        const next = { ...current };
        for (const media of images as any[]) {
          delete next[media.id];
        }
        return next;
      });
    }
  }, [selected, mutate, toaster, t]);

  const reviewMedia = useCallback(
    (media: MediaWithWorkflow, approvalStatus: MediaApprovalStatusValue) =>
      async (e: any) => {
        e.stopPropagation();
        const response = await fetch(`/media/${media.id}/approval`, {
          method: 'POST',
          body: JSON.stringify({ approvalStatus }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          toaster.show(
            body?.message || t('could_not_update_media', 'Could not update media.'),
            'warning'
          );
          return;
        }

        toaster.show(
          approvalStatus === 'APPROVED'
            ? t('media_approved', 'Media approved for public use.')
            : t('media_rejected', 'Media rejected.'),
          'success'
        );
        await mutate();
      },
    [fetch, mutate, toaster, t]
  );

  const renderStatusBadge = useCallback(
    (media: MediaWithWorkflow) => {
      const status = media.approvalStatus || 'PENDING';
      return (
        <span
          className={clsx(
            'inline-flex h-[24px] items-center rounded-full px-[9px] text-[11px] font-[600]',
            status === 'APPROVED' && 'bg-green-500/10 text-green-300',
            status === 'REJECTED' && 'bg-red-500/10 text-red-300',
            status === 'PENDING' && 'bg-yellow-500/10 text-yellow-200'
          )}
        >
          {t(
            `media_status_${status.toLowerCase()}`,
            MEDIA_STATUS_LABELS[status]
          )}
        </span>
      );
    },
    [t]
  );

  const btn = useMemo(() => {
    return (
      <button
        disabled={loading}
        onClick={() => uploaderRef?.current?.click()}
        className="relative cursor-pointer bg-btnSimple changeColor flex gap-[8px] h-[44px] px-[18px] justify-center items-center rounded-[8px]"
      >
        {loading ? (
          <div className="absolute left-[50%] top-[50%] -translate-y-[50%] -translate-x-[50%]">
            <div className="animate-spin h-[20px] w-[20px] border-4 border-white border-t-transparent rounded-full" />
          </div>
        ) : (
          <PlusIcon size={14} />
        )}
        <div className={loading ? 'invisible' : undefined}>{t('upload', 'Upload')}</div>
      </button>
    );
  }, [t, loading]);

  return (
    <DropFiles disabled={loading} className="flex flex-col flex-1" onDrop={dragAndDrop}>
      <div className="flex flex-col flex-1">
        {availableTiers.length > 1 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[10px] mb-[12px]">
            {availableTiers.map((tier) => (
              <button
                key={tier.value}
                type="button"
                onClick={() => setActiveTier(tier.value)}
                className={clsx(
                  'text-left rounded-[12px] border px-[14px] py-[12px] transition-colors',
                  activeTier === tier.value
                    ? 'border-[#612BD3] bg-[#612BD3]/10 text-white'
                    : 'border-newColColor bg-newBgColorInner text-newTextColor hover:text-white'
                )}
              >
                <div className="text-[14px] font-[700]">
                  {t(`media_tier_${tier.value.toLowerCase()}`, tier.label)}
                </div>
                <div className="text-[12px] text-newTextColor/60 mt-[4px]">
                  {t(
                    `media_tier_${tier.value.toLowerCase()}_description`,
                    tier.description
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        <div
          className={clsx(
            'flex items-center gap-[12px]',
            !isLoading &&
              !data?.results?.length &&
              !debouncedSearch &&
              'hidden'
          )}
        >
          <div className="flex-1 flex flex-wrap gap-[8px] items-center">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search_media_by_name', 'Search by file name')}
              className="flex-1 min-w-[200px] h-[44px] px-[14px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px] outline-none focus:border-[#612BD3]"
            />
            <select
              value={filterTagId}
              onChange={(e) => setFilterTagId(e.target.value)}
              className="h-[44px] px-[12px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px] outline-none focus:border-[#612BD3]"
              aria-label={t('filter_by_tag', 'Filter by tag')}
            >
              <option value="">{t('all_tags', 'All tags')}</option>
              {(filterTagOptions || []).map((tag: { id: string; name: string }) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </div>
          <input
            type="file"
            ref={uploaderRef}
            onChange={addToUpload}
            className="hidden"
            multiple={true}
          />
          <div className="flex gap-[8px]">
            {selected.some((media: any) => media?.path?.indexOf('mp4') === -1) && (
              <button
                type="button"
                onClick={convertSelectedToJpg}
                className="cursor-pointer bg-[#612BD3] text-white flex h-[44px] px-[14px] justify-center items-center rounded-[8px] text-[13px] font-[600]"
              >
                {t('convert_selected_to_jpg', 'Convert selected to JPG')}
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                setViewMode((current) =>
                  current === 'grid' ? 'list' : 'grid'
                )
              }
              className="cursor-pointer bg-btnSimple changeColor flex h-[44px] px-[14px] justify-center items-center rounded-[8px] text-[13px] font-[600]"
            >
              {viewMode === 'grid'
                ? t('list_view', 'List view')
                : t('grid_view', 'Grid view')}
            </button>
            {btn}
            <ThirdPartyMediaLibrary onImported={() => mutate()} />
          </div>
        </div>
        <div className="w-full pointer-events-none relative mt-[5px] mb-[5px]">
          <div className="w-full h-[46px] overflow-hidden absolute left-0 bg-newBgColorInner uppyChange">
            <Dashboard
              height={46}
              uppy={uppy}
              id={`uploader`}
              showProgressDetails={true}
              hideUploadButton={true}
              hideRetryButton={true}
              hidePauseResumeButton={true}
              hideCancelButton={true}
              hideProgressAfterFinish={true}
            />
          </div>
          <div className="w-full h-[46px] uppyChange" />
        </div>
        <div
          className={clsx(
            'flex-1 relative',
            !isLoading &&
              !data?.results?.length &&
              'bg-newTextColor/[0.02] rounded-[12px]'
          )}
        >
          <div
            className={clsx(
              'absolute -left-[3px] -top-[3px] withp3 h-full overflow-x-hidden overflow-y-auto scrollbar scrollbar-thumb-newColColor scrollbar-track-newBgColorInner',
              !isLoading &&
                !data?.results?.length &&
                'flex justify-center items-center gap-[20px] flex-col'
            )}
          >
            {!isLoading && !data?.results?.length && (
              <>
                <NoMediaIcon />
                <div className="text-[20px] font-[600]">
                  {debouncedSearch
                    ? t(
                        'no_media_match_search',
                        'No media matches your search'
                      )
                    : t(
                        'you_dont_have_any_media_yet',
                        "You don't have any media yet"
                      )}
                </div>
                <div className="whitespace-pre-line text-newTextColor/[0.6] text-center">
                  {t(
                    'select_or_upload_pictures_max_1gb',
                    'Select or upload pictures (maximum 1 GB per upload).'
                  )}{' '}
                  {'\n'}
                  {t(
                    'you_can_drag_drop_pictures',
                    'You can also drag & drop pictures.'
                  )}
                </div>
                <div className="forceChange flex gap-[8px]">
                  {btn}
                  <ThirdPartyMediaLibrary onImported={() => mutate()} />
                </div>
              </>
            )}
            {isLoading && (
              <>
                {[...new Array(16)].map((_, i) => (
                  <div
                    className={clsx(
                      'px-[3px] py-[3px] float-left rounded-[6px] cursor-pointer w8-max aspect-square'
                    )}
                    key={i}
                  >
                    <div className="w-full h-full bg-newSep rounded-[6px] animate-pulse" />
                  </div>
                ))}
              </>
            )}
            {viewMode === 'list' && !!data?.results?.length && (
              <div className="w-full flex flex-col gap-[8px] px-[3px] py-[3px]">
                {data?.results
                  ?.filter((f: any) => {
                    if (type === 'video') {
                      return f.path.indexOf('mp4') > -1;
                    } else if (type === 'image') {
                      return f.path.indexOf('mp4') === -1;
                    }
                    return true;
                  })
                  .map((media: any) => {
                    const selectedIndex = selected.findIndex(
                      (p: any) => p.id === media.id
                    );
                    const isVideo = media.path.indexOf('mp4') > -1;
                    const isJpg = /\.(jpe?g)(\?|#|$)/i.test(media.path);
                    return (
                      <div
                        key={media.id}
                        onClick={addRemoveSelected(media)}
                        className={clsx(
                          'group flex items-center gap-[12px] rounded-[10px] border p-[10px] bg-newBgColorInner',
                          !standalone && 'cursor-pointer',
                          selectedIndex > -1
                            ? 'border-[#612BD3]'
                            : 'border-newColColor'
                        )}
                      >
                        <div className="w-[58px] h-[58px] rounded-[8px] overflow-hidden bg-black/20 shrink-0">
                          {isVideo ? (
                            <VideoFrame url={mediaDirectory.set(media.path)} />
                          ) : (
                            <img
                              className="w-full h-full object-cover"
                              src={mediaDirectory.set(media.path)}
                              alt="media"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-[600] truncate">
                            {media.name || media.originalName}
                          </div>
                          <div className="text-[12px] text-newTextColor/60 truncate">
                            {media.path}
                          </div>
                          <div className="text-[12px] text-newTextColor/60 mt-[2px]">
                            {isVideo
                              ? t('video', 'Video')
                              : isJpg
                              ? t('jpg_image', 'JPG image')
                              : t('image_needs_jpg', 'Image can be converted')}
                          </div>
                          <div className="mt-[6px]">
                            {renderStatusBadge(media)}
                          </div>
                        </div>
                        {selectedIndex > -1 && (
                          <div className="text-white flex justify-center items-center text-[13px] font-[600] w-[24px] h-[24px] rounded-full bg-[#612BD3] shrink-0">
                            {selectedIndex + 1}
                          </div>
                        )}
                        {!isVideo && (
                          <button
                            type="button"
                            disabled={!!converting[media.id]}
                            onClick={convertToJpg(media)}
                            className="cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed h-[34px] px-[12px] rounded-[8px] bg-[#612BD3] text-white text-[12px] font-[600] shrink-0"
                          >
                            {converting[media.id]
                              ? t('converting', 'Converting...')
                              : isJpg
                              ? t('reconvert_jpg', 'Reconvert JPG')
                              : t('convert_to_jpg', 'Convert to JPG')}
                          </button>
                        )}
                        {standalone && (
                          <button
                            type="button"
                            onClick={openTagsModal(media)}
                            className="cursor-pointer h-[34px] px-[12px] rounded-[8px] bg-[#612BD3]/30 text-white text-[12px] font-[600] shrink-0"
                          >
                            {t('tags', 'Tags')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={maximize(media)}
                          className="cursor-pointer h-[34px] px-[12px] rounded-[8px] bg-newColColor text-[12px] font-[600] shrink-0"
                        >
                          {t('preview', 'Preview')}
                        </button>
                        {standalone && canReviewMedia && (
                          <>
                            {media.approvalStatus !== 'APPROVED' && (
                              <button
                                type="button"
                                onClick={reviewMedia(media, 'APPROVED')}
                                className="cursor-pointer h-[34px] px-[12px] rounded-[8px] bg-green-500/10 text-green-300 text-[12px] font-[600] shrink-0"
                              >
                                {t('approve', 'Approve')}
                              </button>
                            )}
                            {media.approvalStatus !== 'REJECTED' && (
                              <button
                                type="button"
                                onClick={reviewMedia(media, 'REJECTED')}
                                className="cursor-pointer h-[34px] px-[12px] rounded-[8px] bg-yellow-500/10 text-yellow-200 text-[12px] font-[600] shrink-0"
                              >
                                {t('reject', 'Reject')}
                              </button>
                            )}
                          </>
                        )}
                        <button
                          type="button"
                          onClick={deleteImage(media)}
                          className="cursor-pointer h-[34px] px-[12px] rounded-[8px] bg-red-500/10 text-red-300 text-[12px] font-[600] shrink-0"
                        >
                          {t('delete', 'Delete')}
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
            {viewMode === 'grid' &&
              data?.results
              ?.filter((f: any) => {
                if (type === 'video') {
                  return f.path.indexOf('mp4') > -1;
                } else if (type === 'image') {
                  return f.path.indexOf('mp4') === -1;
                }
                return true;
              })
              .map((media: any) => (
                <div
                  className={clsx(
                    'group px-[3px] py-[3px] float-left rounded-[6px] w8-max aspect-square',
                    !standalone && 'cursor-pointer'
                  )}
                  key={media.id}
                >
                  <div
                    className={clsx(
                      'w-full h-full rounded-[6px] border-[4px] relative',
                      !!selected.find((p) => p.id === media.id)
                        ? 'border-[#612BD3]'
                        : 'border-transparent'
                    )}
                    onClick={addRemoveSelected(media)}
                  >
                    <div className="absolute top-[8px] left-[8px] z-[100]">
                      {renderStatusBadge(media)}
                    </div>
                    {!!selected.find((p: any) => p.id === media.id) ? (
                      <div className="text-white flex z-[101] justify-center items-center text-[14px] font-[500] w-[24px] h-[24px] rounded-full bg-[#612BD3] absolute -bottom-[10px] -end-[10px]">
                        {selected.findIndex((z: any) => z.id === media.id) + 1}
                      </div>
                    ) : (
                      <DeleteCircleIcon
                        className="cursor-pointer hidden z-[100] group-hover:block absolute -top-[5px] -end-[5px]"
                        onClick={deleteImage(media)}
                      />
                    )}
                    {standalone && (
                      <div className="absolute left-[8px] bottom-[8px] z-[100] hidden group-hover:flex flex-wrap gap-[6px] max-w-[90%]">
                        <button
                          type="button"
                          onClick={openTagsModal(media)}
                          className="cursor-pointer h-[30px] px-[10px] rounded-[7px] bg-[#612BD3]/40 text-white text-[11px] font-[700]"
                        >
                          {t('tags', 'Tags')}
                        </button>
                        {canReviewMedia && media.approvalStatus !== 'APPROVED' && (
                          <button
                            type="button"
                            onClick={reviewMedia(media, 'APPROVED')}
                            className="cursor-pointer h-[30px] px-[10px] rounded-[7px] bg-green-500/20 text-green-200 text-[11px] font-[700]"
                          >
                            {t('approve', 'Approve')}
                          </button>
                        )}
                        {canReviewMedia && media.approvalStatus !== 'REJECTED' && (
                          <button
                            type="button"
                            onClick={reviewMedia(media, 'REJECTED')}
                            className="cursor-pointer h-[30px] px-[10px] rounded-[7px] bg-yellow-500/20 text-yellow-100 text-[11px] font-[700]"
                          >
                            {t('reject', 'Reject')}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="absolute bottom-[10px] end-[10px] z-[100]">
                      {media.name || media.originalName}
                    </div>
                    <div className="w-full h-full rounded-[6px] overflow-hidden relative">
                      <div className="absolute z-[20] left-[50%] top-[50%] -translate-x-[50%] -translate-y-[50%]">
                        <div
                          onClick={maximize(media)}
                          className="cursor-pointer p-[4px] bg-black/40 hidden group-hover:block hover:scale-150 transition-all"
                        >
                          <svg
                            width="30"
                            height="30"
                            viewBox="0 0 14 14"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M2 9H0V14H5V12H2V9ZM0 5H2V2H5V0H0V5ZM12 12H9V14H14V9H12V12ZM9 0V2H12V5H14V0H9Z"
                              fill="#F1F5F9"
                            />
                          </svg>
                        </div>
                      </div>
                      {media.path.indexOf('mp4') > -1 ? (
                        <VideoFrame url={mediaDirectory.set(media.path)} />
                      ) : (
                        <img
                          width="100%"
                          height="100%"
                          className="w-full h-full object-cover"
                          src={mediaDirectory.set(media.path)}
                          alt="media"
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
        {(data?.pages || 0) > 1 && (
          <Pagination
            current={page}
            totalPages={data?.pages}
            setPage={setPage}
          />
        )}
        {!standalone && (
          <div className="flex justify-end mt-[32px] gap-[8px]">
            <button
              onClick={() => modals.closeCurrent()}
              className="cursor-pointer h-[52px] px-[20px] items-center justify-center border border-newTextColor/10 flex rounded-[10px]"
            >
              {t('cancel', 'Cancel')}
            </button>
            {!isLoading && !!data?.results?.length && (
              <button
                onClick={standalone ? () => {} : addMedia}
                disabled={selected.length === 0}
                className="cursor-pointer text-white disabled:opacity-80 disabled:cursor-not-allowed h-[52px] px-[20px] items-center justify-center bg-[#612BD3] flex rounded-[10px]"
              >
                {t('add_selected_media', 'Add selected media')}
              </button>
            )}
          </div>
        )}
      </div>
    </DropFiles>
  );
};
export const MultiMediaComponent: FC<{
  label: string;
  description: string;
  mediaNotAvailable?: boolean;
  dummy: boolean;
  allData: {
    content: string;
    id?: string;
    image?: Array<{
      id: string;
      path: string;
    }>;
  }[];
  value?: Array<{
    path: string;
    id: string;
  }>;
  text: string;
  name: string;
  error?: any;
  onOpen?: () => void;
  onClose?: () => void;
  toolBar?: React.ReactNode;
  information?: React.ReactNode;
  onChange: (event: {
    target: {
      name: string;
      value?: Array<{
        id: string;
        path: string;
        alt?: string;
        thumbnail?: string;
        thumbnailTimestamp?: number;
      }>;
    };
  }) => void;
}> = (props) => {
  const {
    name,
    error,
    text,
    onChange,
    value,
    allData,
    dummy,
    toolBar,
    information,
    mediaNotAvailable,
  } = props;
  const user = useUser();
  const modals = useModals();
  const t = useT();
  useEffect(() => {
    if (value) {
      setCurrentMedia(value);
    }
  }, [value]);

  const [currentMedia, setCurrentMedia] = useState(value);
  const mediaDirectory = useMediaDirectory();
  const changeMedia = useCallback(
    (
      m:
        | {
            path: string;
            id: string;
          }
        | {
            path: string;
            id: string;
          }[]
    ) => {
      const mediaArray = Array.isArray(m) ? m : [m];
      const newMedia = [...(currentMedia || []), ...mediaArray];
      setCurrentMedia(newMedia);
      onChange({
        target: {
          name,
          value: newMedia,
        },
      });
    },
    [currentMedia]
  );
  const showModal = useCallback(() => {
    modals.openModal({
      title: t('media_library', 'Media Library'),
      askClose: false,
      closeOnEscape: true,
      fullScreen: true,
      size: 'calc(100% - 80px)',
      height: 'calc(100% - 80px)',
      children: (close) => (
        <MediaBox setMedia={changeMedia} closeModal={close} />
      ),
    });
  }, [changeMedia, t]);

  const clearMedia = useCallback(
    (topIndex: number) => () => {
      const newMedia = currentMedia?.filter((f, index) => index !== topIndex);
      setCurrentMedia(newMedia);
      onChange({
        target: {
          name,
          value: newMedia,
        },
      });
    },
    [currentMedia]
  );

  const designMedia = useCallback(() => {
    if (!!user?.tier?.ai && !dummy) {
      modals.openModal({
        askClose: false,
        title: t('design_media', 'Design Media'),
        size: '80%',
        children: (close) => (
          <Polonto setMedia={changeMedia} closeModal={close} />
        ),
      });
    }
  }, [changeMedia, t]);

  return (
    <>
      <div className="b1 flex flex-col gap-[8px] rounded-bl-[8px] select-none w-full">
        <div className="flex gap-[10px] px-[12px]">
          {!!currentMedia && (
            <ReactSortable
              list={currentMedia}
              setList={(value) =>
                onChange({ target: { name: 'upload', value } })
              }
              className="flex gap-[10px] sortable-container"
              animation={200}
              swap={true}
              handle=".dragging"
            >
              {currentMedia.map((media, index) => (
                  <div key={media.id} className="cursor-pointer rounded-[5px] w-[40px] h-[40px] border-2 border-tableBorder relative flex transition-all">
                    <DragHandleIcon className="z-[20] dragging absolute pe-[1px] pb-[3px] -start-[4px] -top-[4px] cursor-move" />

                    <div className="w-full h-full relative group">
                      <div
                        onClick={async () => {
                          modals.openModal({
                            title: t('media_settings', 'Media Settings'),
                            children: (close) => (
                              <MediaComponentInner
                                media={media as any}
                                onClose={close}
                                onSelect={(value: any) => {
                                  onChange({
                                    target: {
                                      name: 'upload',
                                      value: currentMedia.map((p) => {
                                        if (p.id === media.id) {
                                          return {
                                            ...p,
                                            ...value,
                                          };
                                        }
                                        return p;
                                      }),
                                    },
                                  });
                                }}
                              />
                            ),
                          });
                        }}
                        className="absolute top-[50%] left-[50%] -translate-x-[50%] -translate-y-[50%] bg-black/80 rounded-[10px] opacity-0 group-hover:opacity-100 transition-opacity z-[9]"
                      >
                        <MediaSettingsIcon className="cursor-pointer relative z-[200]" />
                      </div>
                      {media?.path?.indexOf('mp4') > -1 ? (
                        <VideoFrame url={mediaDirectory.set(media?.path)} />
                      ) : (
                        <img
                          className="w-full h-full object-cover rounded-[4px]"
                          src={mediaDirectory.set(media?.path)}
                        />
                      )}
                    </div>

                    <CloseCircleIcon
                      onClick={clearMedia(index)}
                      className="absolute -end-[4px] -top-[4px] z-[20] rounded-full bg-white"
                    />
                  </div>
              ))}
            </ReactSortable>
          )}
        </div>
        <div className="flex gap-[8px] px-[12px] border-t border-newColColor w-full b1 text-textColor">
          {!mediaNotAvailable && (
            <div className="flex py-[10px] b2 items-center gap-[4px]">
              <div
                onClick={showModal}
                className="cursor-pointer h-[30px] rounded-[6px] justify-center items-center flex bg-newColColor px-[8px]"
              >
                <div className="flex gap-[8px] items-center">
                  <div>
                    <InsertMediaIcon />
                  </div>
                  <div className="text-[10px] font-[600] maxMedia:hidden block">
                    {t('insert_media', 'Insert Media')}
                  </div>
                </div>
              </div>
              <div
                onClick={designMedia}
                className="cursor-pointer h-[30px] rounded-[6px] justify-center items-center flex bg-newColColor px-[8px]"
              >
                <div className="flex gap-[5px] items-center">
                  <div>
                    <DesignMediaIcon />
                  </div>
                  <div className="text-[10px] font-[600] iconBreak:hidden block">
                    {t('design_media', 'Design Media')}
                  </div>
                </div>
              </div>

              <ThirdPartyMedia allData={allData} onChange={changeMedia} />

              {!!user?.tier?.ai && (
                <>
                  <AiImage value={text} onChange={changeMedia} />
                  <AiVideo value={text} onChange={changeMedia} />
                </>
              )}
            </div>
          )}
          {!mediaNotAvailable && (
            <div className="text-newColColor h-full flex items-center">
              <VerticalDividerIcon />
            </div>
          )}
          {!!toolBar && (
            <div className="flex py-[10px] b2 items-center gap-[4px]">
              {toolBar}
            </div>
          )}
          {information && (
            <div className="flex-1 justify-end flex py-[10px] b2 items-center gap-[4px]">
              {information}
            </div>
          )}
        </div>
      </div>
      <div className="text-[12px] text-red-400">{error}</div>
    </>
  );
};
export const MediaComponent: FC<{
  label: string;
  description: string;
  value?: {
    path: string;
    id: string;
  };
  name: string;
  onChange: (event: {
    target: {
      name: string;
      value?: {
        id: string;
        path: string;
      };
    };
  }) => void;
  type?: 'image' | 'video';
  width?: number;
  height?: number;
}> = (props) => {
  const t = useT();

  const { name, type, label, description, onChange, value, width, height } =
    props;
  const { getValues } = useSettings();
  const user = useUser();
  useEffect(() => {
    const settings = getValues()[props.name];
    if (settings) {
      setCurrentMedia(settings);
    }
  }, []);
  const [currentMedia, setCurrentMedia] = useState(value);
  const modals = useModals();
  const mediaDirectory = useMediaDirectory();

  const showDesignModal = useCallback(() => {
    modals.openModal({
      title: t('media_editor', 'Media Editor'),
      askClose: false,
      closeOnEscape: true,
      fullScreen: true,
      size: 'calc(100% - 80px)',
      height: 'calc(100% - 80px)',
      children: (close) => (
        <Polonto
          width={width}
          height={height}
          setMedia={changeMedia}
          closeModal={close}
        />
      ),
    });
  }, [t]);
  const changeMedia = useCallback((m: { path: string; id: string }[]) => {
    setCurrentMedia(m[0]);
    onChange({
      target: {
        name,
        value: m[0],
      },
    });
  }, []);
  const showModal = useCallback(() => {
    modals.openModal({
      title: t('media_library', 'Media Library'),
      askClose: false,
      closeOnEscape: true,
      fullScreen: true,
      size: 'calc(100% - 80px)',
      height: 'calc(100% - 80px)',
      children: (close) => (
        <MediaBox setMedia={changeMedia} closeModal={close} type={type} />
      ),
    });
  }, [t]);
  const clearMedia = useCallback(() => {
    setCurrentMedia(undefined);
    onChange({
      target: {
        name,
        value: undefined,
      },
    });
  }, [value]);
  return (
    <div className="flex flex-col gap-[8px]">
      <div className="text-[14px]">{label}</div>
      <div className="text-[12px]">{description}</div>
      {!!currentMedia && (
        <div className="my-[20px] cursor-pointer w-[200px] h-[200px] border-2 border-tableBorder">
          <img
            className="w-full h-full object-cover"
            src={currentMedia.path}
            onClick={() => window.open(mediaDirectory.set(currentMedia.path))}
          />
        </div>
      )}
      <div className="flex gap-[5px]">
        <Button onClick={showModal}>{t('select', 'Select')}</Button>
        <Button onClick={showDesignModal} className="!bg-customColor45">
          {t('editor', 'Editor')}
        </Button>
        <Button secondary={true} onClick={clearMedia}>
          {t('clear', 'Clear')}
        </Button>
      </div>
    </div>
  );
};
