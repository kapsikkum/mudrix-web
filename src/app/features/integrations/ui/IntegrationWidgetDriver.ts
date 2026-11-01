import {
  EventDirection,
  MatrixCapabilities,
  WidgetDriver,
  WidgetEventCapability,
} from 'matrix-widget-api';
import type { Capability, IRoomEvent, ISendEventDetails } from 'matrix-widget-api';
import { EventType } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { mxcUrlToHttp } from '@/util/matrix/mxcUrl';
import { resolveCapabilities } from '../widget';

/** The only room event type a widget may send or read. */
const MESSAGE_TYPE = 'm.room.message';
/** The only state event types a widget may read. */
const READABLE_STATE_TYPES: readonly string[] = ['m.room.name', 'm.room.topic'];
const MESSAGE_MSGTYPES: readonly string[] = [
  'm.text',
  'm.notice',
  'm.emote',
  'm.image',
  'm.file',
  'm.audio',
  'm.video',
];
const MAX_TIMELINE_EVENTS = 200;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MXC_URI = /^mxc:\/\/[^/\s]+\/[^/\s]+$/;

const SEND_MESSAGE = WidgetEventCapability.forRoomEvent(EventDirection.Send, MESSAGE_TYPE).raw;
const READ_MESSAGES = WidgetEventCapability.forRoomEvent(EventDirection.Receive, MESSAGE_TYPE).raw;
const readState = (type: string) =>
  WidgetEventCapability.forStateEvent(EventDirection.Receive, type).raw;

const toRaw = (ev: MatrixEvent) => ev.getEffectiveEvent() as unknown as IRoomEvent;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The mxc:// uris an m.room.message event refers to (file, encrypted file and thumbnails). */
function mediaUris(ev: MatrixEvent): string[] {
  const content: unknown = ev.getContent();
  if (!isRecord(content)) return [];
  const out: unknown[] = [content.url];
  if (isRecord(content.file)) out.push(content.file.url);
  if (isRecord(content.info)) {
    out.push(content.info.thumbnail_url);
    if (isRecord(content.info.thumbnail_file)) out.push(content.info.thumbnail_file.url);
  }
  return out.filter((u): u is string => typeof u === 'string');
}

/**
 * The Widget API driver for an integration widget. It implements only what the capability
 * catalogue can grant (send/read m.room.message, read m.room.name and m.room.topic, upload and
 * download files) and every method re-checks that the call is for the one room the widget was
 * opened in and for an allowed event type. Everything else keeps the library default, which
 * refuses or returns nothing (to-device, account data, delayed events, OpenID, navigation...).
 */
export class IntegrationWidgetDriver extends WidgetDriver {
  private granted = new Set<string>();

  constructor(
    private readonly client: MatrixClient,
    private readonly roomId: string,
    /** The catalogue ids the integration declared (and the person approved). */
    private readonly approvedIds: readonly string[]
  ) {
    super();
  }

  async validateCapabilities(requested: Set<Capability>): Promise<Set<Capability>> {
    this.granted = resolveCapabilities(requested, this.approvedIds, this.roomId);
    return new Set(this.granted);
  }

  private requireRoom(roomId: string | null | undefined): void {
    // An empty room id means "the room the user is looking at", which is this one.
    if (roomId && roomId !== this.roomId)
      throw new Error('This widget can only use the room it was opened in');
  }

  private requireGranted(capability: string): void {
    if (!this.granted.has(capability)) throw new Error('This widget is not allowed to do that');
  }

  private getRoom() {
    const room = this.client.getRoom(this.roomId);
    if (!room) throw new Error('Room not found');
    return room;
  }

  async sendEvent(
    eventType: string,
    content: unknown,
    stateKey: string | null = null,
    roomId: string | null = null
  ): Promise<ISendEventDetails> {
    this.requireRoom(roomId);
    if (eventType !== MESSAGE_TYPE || (stateKey !== null && stateKey !== undefined))
      throw new Error('This widget can only send messages');
    this.requireGranted(SEND_MESSAGE);
    if (
      !isRecord(content) ||
      typeof content.body !== 'string' ||
      typeof content.msgtype !== 'string' ||
      !MESSAGE_MSGTYPES.includes(content.msgtype)
    )
      throw new Error('Not a message');
    const res = await this.client.sendEvent(
      this.roomId,
      null,
      EventType.RoomMessage,
      content as unknown as RoomMessageEventContent
    );
    return { roomId: this.roomId, eventId: res.event_id };
  }

  async readRoomTimeline(
    roomId: string,
    eventType: string,
    msgtype: string | undefined,
    stateKey: string | undefined,
    limit: number,
    since: string | undefined
  ): Promise<IRoomEvent[]> {
    this.requireRoom(roomId);
    if (stateKey !== undefined) return this.readRoomState(roomId, eventType, stateKey);
    if (eventType !== MESSAGE_TYPE) throw new Error('This widget can only read messages');
    this.requireGranted(READ_MESSAGES);
    let events = this.getRoom()
      .getLiveTimeline()
      .getEvents()
      .filter(
        (ev) =>
          ev.getType() === MESSAGE_TYPE &&
          !ev.isRedacted() &&
          (msgtype === undefined || ev.getContent().msgtype === msgtype)
      );
    if (since) {
      const at = events.findIndex((ev) => ev.getId() === since);
      if (at >= 0) events = events.slice(at + 1);
    }
    const max = limit > 0 ? Math.min(limit, MAX_TIMELINE_EVENTS) : MAX_TIMELINE_EVENTS;
    return events.slice(-max).map(toRaw);
  }

  async readRoomState(
    roomId: string,
    eventType: string,
    stateKey: string | undefined
  ): Promise<IRoomEvent[]> {
    this.requireRoom(roomId);
    if (!READABLE_STATE_TYPES.includes(eventType))
      throw new Error("This widget can only read the room's name and topic");
    this.requireGranted(readState(eventType));
    if (stateKey !== undefined && stateKey !== '') return [];
    const ev = this.getRoom().currentState.getStateEvents(eventType, '');
    return ev ? [toRaw(ev)] : [];
  }

  async uploadFile(file: XMLHttpRequestBodyInit): Promise<{ contentUri: string }> {
    this.requireGranted(MatrixCapabilities.MSC4039UploadFile);
    if (!(file instanceof Blob)) throw new Error('Not a file');
    if (file.size > MAX_FILE_BYTES) throw new Error('The file is too large');
    const res = await this.client.uploadContent(file, { includeFilename: false });
    return { contentUri: res.content_uri };
  }

  async downloadFile(contentUri: string): Promise<{ file: XMLHttpRequestBodyInit }> {
    this.requireGranted(MatrixCapabilities.MSC4039DownloadFile);
    if (typeof contentUri !== 'string' || !MXC_URI.test(contentUri)) throw new Error('Not a file');
    // Only files that messages in the open room refer to, never arbitrary media on the server.
    const inRoom = this.getRoom()
      .getLiveTimeline()
      .getEvents()
      .some((ev) => ev.getType() === MESSAGE_TYPE && mediaUris(ev).includes(contentUri));
    if (!inRoom) throw new Error('That file is not in this room');
    const url = mxcUrlToHttp(
      this.client,
      contentUri,
      undefined,
      undefined,
      undefined,
      false,
      true,
      true
    );
    if (!url) throw new Error('Could not download the file');
    const token = this.client.getAccessToken();
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!res.ok) throw new Error('Could not download the file');
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_FILE_BYTES)
      throw new Error('The file is too large');
    const blob = await res.blob();
    if (blob.size > MAX_FILE_BYTES) throw new Error('The file is too large');
    return { file: blob };
  }
}
