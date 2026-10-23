import type { MatrixEvent } from 'matrix-js-sdk';

/**
 * Content key Mudrix puts on each image of a multi-image send so the timeline can show them as one
 * gallery. Other clients ignore it and show the images one by one.
 */
export const GALLERY_CONTENT_KEY = 'org.mudrix.gallery';

export interface GalleryTag {
  /** Shared by every image sent together. */
  id: string;
  index: number;
  count: number;
}

export function getGalleryTag(event: MatrixEvent): GalleryTag | null {
  const raw = (event.getContent() as Record<string, unknown> | null)?.[GALLERY_CONTENT_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const { id, index, count } = raw as Record<string, unknown>;
  if (typeof id !== 'string' || id.length === 0 || id.length > 64) return null;
  if (typeof index !== 'number' || typeof count !== 'number') return null;
  return { id, index, count };
}
