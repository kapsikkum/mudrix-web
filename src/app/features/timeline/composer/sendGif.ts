import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { EventType, MsgType } from 'matrix-js-sdk';
import { fetchMediaBlobUrl } from '@/app/components/Avatar/fetchMediaBlobUrl';
import { uploadEncryptedFile, getImageDimensions } from '@/app/features/timeline/encryptedMedia';
import { applyReplyMetadata } from './sendMessageContent';
import { GIF_SOURCE_FIELD } from './gifFavourites';
import { downloadGif, type GifItem } from './gifProviders';

export interface SendGifOptions {
  client: MatrixClient;
  roomId: string;
  threadId?: string | null;
  replyTo?: MatrixEvent | null;
}

/** Sends `item` to the room as a full-size image message (see the notes below). */
export async function sendGif(
  item: GifItem,
  { client, roomId, threadId, replyTo }: SendGifOptions
): Promise<void> {
  // GIFs go out as ordinary images (full size, like an upload), tagged with where they
  // came from so the favourite star knows the GIF is already saved.
  const isEncryptedRoom = Boolean(await client.getCrypto()?.isEncryptionEnabledInRoom(roomId));
  let content: Record<string, unknown>;

  // Favourited straight from a message already on the homeserver: reuse that upload
  // (an encrypted file descriptor is reused as-is). A plain upload is only reused in an
  // unencrypted room; into an encrypted room it is fetched and re-uploaded encrypted.
  if (item.mxcFile || (item.mxcUrl && !isEncryptedRoom)) {
    content = {
      msgtype: MsgType.Image,
      body: item.title || 'GIF',
      info: { ...item.mxcInfo, w: item.width || undefined, h: item.height || undefined },
    };
    if (item.mxcFile) content.file = item.mxcFile;
    else content.url = item.mxcUrl;
  } else {
    let file: File;
    if (item.mxcUrl) {
      const blobUrl = await fetchMediaBlobUrl(item.mxcUrl, client);
      if (!blobUrl) throw new Error('GIF download failed');
      const blob = await (await fetch(blobUrl)).blob();
      file = new File([blob], `${item.id.replace(/[^\w-]/g, '_')}.gif`, {
        type: 'image/gif',
      });
    } else {
      const { blob, fileName } = await downloadGif(item);
      file = new File([blob], fileName, { type: blob.type || 'image/gif' });
    }
    const uploadResult = await uploadEncryptedFile(client, roomId, file);
    const dims = await getImageDimensions(file);
    const info: Record<string, unknown> = {
      mimetype: file.type || 'image/gif',
      size: file.size,
      is_animated: uploadResult.isAnimated ?? undefined,
    };
    if (dims) {
      info.w = dims.w;
      info.h = dims.h;
    }
    content = { msgtype: MsgType.Image, body: item.title || file.name, info };
    if (uploadResult.file) content.file = uploadResult.file;
    else content.url = uploadResult.url;
  }
  content[GIF_SOURCE_FIELD] = { provider: item.provider, id: item.id };

  applyReplyMetadata(content, { replyTo, myId: client.getUserId() ?? '' });
  await client.sendEvent(roomId, threadId ?? null, EventType.RoomMessage, content as never);
}
