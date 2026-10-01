import {
  type Capability,
  type IGetMediaConfigResult,
  type IOpenIDUpdate,
  type IReadEventRelationsResult,
  type IRoomEvent,
  type ISearchUserDirectoryResult,
  type ISendDelayedEventDetails,
  type ISendEventDetails,
  type IWidgetApiErrorResponseDataDetails,
  OpenIDRequestState,
  SimpleObservable,
  type ITurnServer,
  WidgetDriver,
} from 'matrix-widget-api';
import {
  Direction,
  EventType,
  MatrixError,
  type IContent,
  type MatrixClient,
  type MatrixEvent,
  type SendDelayedEventResponse,
  type StateEvents,
  type TimelineEvents,
} from 'matrix-js-sdk';
import { getCallCapabilities } from './capabilities';

type SendDelayedEventRequestOpts =
  | { parent_delay_id: string }
  | { delay: number; parent_delay_id?: string };

import { mxcUrlToHttp } from '@/util/matrix/mxcUrl';

export class CallWidgetDriver extends WidgetDriver {
  private allowedCapabilities: Set<Capability>;

  private readonly mx: MatrixClient;

  public readonly pendingDelayedEventIds = new Set<string>();

  constructor(
    mx: MatrixClient,
    private readonly inRoomId: string
  ) {
    super();
    this.mx = mx;

    const deviceId = mx.getDeviceId();
    if (!deviceId) throw new Error('Failed to initialize CallWidgetDriver! Device ID not found.');
    const userId = mx.getUserId();
    if (!userId) throw new Error('Failed to initialize CallWidgetDriver! User ID not found.');

    this.allowedCapabilities = getCallCapabilities(inRoomId, userId, deviceId);
  }

  public async validateCapabilities(requested: Set<Capability>): Promise<Set<Capability>> {
    const allow = Array.from(requested).filter((cap) => this.allowedCapabilities.has(cap));
    return new Set(allow);
  }

  public async sendEvent(
    eventType: string,
    content: IContent,
    stateKey: string | null = null,
    targetRoomId: string | null = null
  ): Promise<ISendEventDetails> {
    const client = this.mx;
    const roomId = targetRoomId || this.inRoomId;

    if (!client || !roomId) throw new Error('Not in a room or not attached to a client');

    let r: { event_id: string } | null;
    if (typeof stateKey === 'string') {
      r = await client.sendStateEvent(
        roomId,
        eventType as keyof StateEvents,
        content as StateEvents[keyof StateEvents],
        stateKey
      );
    } else if (eventType === EventType.RoomRedaction) {
      // special case: extract the `redacts` property and call redact
      r = await client.redactEvent(roomId, content.redacts);
    } else {
      r = await client.sendEvent(
        roomId,
        eventType as keyof TimelineEvents,
        content as TimelineEvents[keyof TimelineEvents]
      );
    }

    return { roomId, eventId: r.event_id };
  }

  public async sendDelayedEvent(
    delay: number | null,
    parentDelayId: string | null,
    eventType: string,
    content: IContent,
    stateKey: string | null = null,
    targetRoomId: string | null = null
  ): Promise<ISendDelayedEventDetails> {
    const client = this.mx;
    const roomId = targetRoomId || this.inRoomId;

    if (!client || !roomId) throw new Error('Not in a room or not attached to a client');

    let delayOpts: SendDelayedEventRequestOpts;
    if (delay !== null && parentDelayId !== null) {
      delayOpts = { delay, parent_delay_id: parentDelayId };
    } else if (delay !== null) {
      delayOpts = { delay };
    } else if (parentDelayId !== null) {
      delayOpts = { parent_delay_id: parentDelayId };
    } else {
      throw new Error('Must provide at least one of delay or parentDelayId');
    }

    let r: SendDelayedEventResponse | null;
    if (stateKey !== null) {
      r = await client._unstable_sendDelayedStateEvent(
        roomId,
        delayOpts,
        eventType as keyof StateEvents,
        content as StateEvents[keyof StateEvents],
        stateKey
      );
    } else {
      r = await client._unstable_sendDelayedEvent(
        roomId,
        delayOpts,
        null,
        eventType as keyof TimelineEvents,
        content as TimelineEvents[keyof TimelineEvents]
      );
    }

    if (r?.delay_id) this.pendingDelayedEventIds.add(r.delay_id);
    return { roomId, delayId: r.delay_id };
  }

  public async cancelScheduledDelayedEvent(delayId: string): Promise<void> {
    const client = this.mx;

    if (!client) throw new Error('Not in a room or not attached to a client');

    await client._unstable_cancelScheduledDelayedEvent(delayId);
    this.pendingDelayedEventIds.delete(delayId);
  }

  public async restartScheduledDelayedEvent(delayId: string): Promise<void> {
    const client = this.mx;

    if (!client) throw new Error('Not in a room or not attached to a client');

    await client._unstable_restartScheduledDelayedEvent(delayId);
  }

  public async sendScheduledDelayedEvent(delayId: string): Promise<void> {
    const client = this.mx;

    if (!client) throw new Error('Not in a room or not attached to a client');

    await client._unstable_sendScheduledDelayedEvent(delayId);
    this.pendingDelayedEventIds.delete(delayId);
  }

  public async sendToDevice(
    eventType: string,
    encrypted: boolean,
    contentMap: { [userId: string]: { [deviceId: string]: object } }
  ): Promise<void> {
    const client = this.mx;

    if (encrypted) {
      const crypto = client.getCrypto();
      if (!crypto) throw new Error('E2EE not enabled');

      // Attempt to re-batch these up into a single request
      const invertedContentMap: { [content: string]: { userId: string; deviceId: string }[] } = {};

      for (const userId of Object.keys(contentMap)) {
        const userContentMap = contentMap[userId];
        for (const deviceId of Object.keys(userContentMap)) {
          const content = userContentMap[deviceId];
          const stringifiedContent = JSON.stringify(content);
          invertedContentMap[stringifiedContent] = invertedContentMap[stringifiedContent] || [];
          invertedContentMap[stringifiedContent].push({ userId, deviceId });
        }
      }

      await Promise.all(
        Object.entries(invertedContentMap).map(async ([stringifiedContent, recipients]) => {
          const batch = await crypto.encryptToDeviceMessages(
            eventType,
            recipients,
            JSON.parse(stringifiedContent)
          );

          await client.queueToDevice(batch);
        })
      );
    } else {
      await client.queueToDevice({
        eventType,
        batch: Object.entries(contentMap).flatMap(([userId, userContentMap]) =>
          Object.entries(userContentMap).map(([deviceId, content]) => ({
            userId,
            deviceId,
            payload: content,
          }))
        ),
      });
    }
  }

  public async readRoomTimeline(
    roomId: string,
    eventType: string,
    msgtype: string | undefined,
    stateKey: string | undefined,
    limit: number,
    since: string | undefined
  ): Promise<IRoomEvent[]> {
    const safeLimit =
      limit > 0 ? Math.min(limit, Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;

    const room = this.mx.getRoom(roomId);
    if (room === null) return [];
    const results: MatrixEvent[] = [];
    const events = room.getLiveTimeline().getEvents();

    for (let i = events.length - 1; i >= 0; i -= 1) {
      const ev = events[i];
      if (results.length >= safeLimit) break;
      if (since !== undefined && ev.getId() === since) break;

      if (
        ev.getType() === eventType &&
        !ev.isState() &&
        (eventType !== EventType.RoomMessage || !msgtype || msgtype === ev.getContent().msgtype) &&
        (ev.getStateKey() === undefined || stateKey === undefined || ev.getStateKey() === stateKey)
      ) {
        results.push(ev);
      }
    }

    return results.map((e) => e.getEffectiveEvent() as IRoomEvent);
  }

  public async readRoomState(
    roomId: string,
    eventType: string,
    stateKey: string | undefined
  ): Promise<IRoomEvent[]> {
    const room = this.mx.getRoom(roomId);
    if (room === null) return [];
    const state = room.getLiveTimeline().getState(Direction.Forward);
    if (state === undefined) return [];

    if (stateKey === undefined)
      return state.getStateEvents(eventType).map((e) => e.getEffectiveEvent() as IRoomEvent);
    const event = state.getStateEvents(eventType, stateKey);
    return event === null ? [] : [event.getEffectiveEvent() as IRoomEvent];
  }

  public async readEventRelations(
    eventId: string,
    roomId?: string,
    relationType?: string,
    eventType?: string,
    from?: string,
    to?: string,
    limit?: number,
    direction?: 'f' | 'b'
  ): Promise<IReadEventRelationsResult> {
    const client = this.mx;
    const dir = direction as Direction;
    const targetRoomId = roomId ?? this.inRoomId ?? undefined;

    if (typeof targetRoomId !== 'string') {
      throw new Error('Error while reading the current room');
    }

    const { events, nextBatch, prevBatch } = await client.relations(
      targetRoomId,
      eventId,
      relationType ?? null,
      eventType ?? null,
      { from, to, limit, dir }
    );

    return {
      chunk: events.map((e) => e.getEffectiveEvent() as IRoomEvent),
      nextBatch: nextBatch ?? undefined,
      prevBatch: prevBatch ?? undefined,
    };
  }

  public async searchUserDirectory(
    searchTerm: string,
    limit?: number
  ): Promise<ISearchUserDirectoryResult> {
    const client = this.mx;

    const { limited, results } = await client.searchUserDirectory({ term: searchTerm, limit });

    return {
      limited,
      results: results.map((r) => ({
        userId: r.user_id,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
      })),
    };
  }

  public async getMediaConfig(): Promise<IGetMediaConfigResult> {
    const client = this.mx;

    return client.getMediaConfig();
  }

  public async uploadFile(file: XMLHttpRequestBodyInit): Promise<{ contentUri: string }> {
    const client = this.mx;

    const uploadResult = await client.uploadContent(file);

    return { contentUri: uploadResult.content_uri };
  }

  public async downloadFile(contentUri: string): Promise<{ file: XMLHttpRequestBodyInit }> {
    const httpUrl = mxcUrlToHttp(
      this.mx,
      contentUri,
      undefined,
      undefined,
      undefined,
      true,
      true,
      true
    );
    if (!httpUrl) {
      throw new Error('Call widget failed to download file! No http url!');
    }

    const headers: Record<string, string> = {};
    const accessToken = this.mx.getAccessToken();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const response = await fetch(httpUrl, { headers });
    if (!response.ok) throw new Error(`Call widget failed to download file! ${response.status}`);
    const blob = await response.blob();

    return { file: blob };
  }

  public async askOpenID(observer: SimpleObservable<IOpenIDUpdate>): Promise<void> {
    const token = await this.mx.getOpenIdToken();

    return observer.update({
      state: OpenIDRequestState.Allowed,
      token,
    });
  }

  public async *getTurnServers(): AsyncGenerator<ITurnServer> {
    const servers = this.mx.getTurnServers();
    for (const server of servers) {
      yield {
        uris: server.urls,
        username: server.username ?? '',
        password: server.credential ?? '',
      };
    }
  }

  public getKnownRooms(): string[] {
    return this.mx.getVisibleRooms().map((r) => r.roomId);
  }

  public processError(error: unknown): IWidgetApiErrorResponseDataDetails | undefined {
    return error instanceof MatrixError
      ? { matrix_api_error: error.asWidgetApiErrorData() }
      : undefined;
  }
}
