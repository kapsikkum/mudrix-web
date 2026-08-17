import {
  ClientEvent,
  Direction,
  KnownMembership,
  type MatrixClient,
  MatrixEvent,
  MatrixEventEvent,
  type Room,
  RoomStateEvent,
} from 'matrix-js-sdk';
import {
  ClientWidgetApi,
  type IWidget,
  type IRoomEvent,
  Widget,
  WidgetApiToWidgetAction,
  type WidgetDriver,
} from 'matrix-widget-api';
import { CallWidgetDriver } from './CallWidgetDriver';
import { CallControl } from './CallControl';
import { CallControlState } from './CallControlState';
import {
  ElementCallIntent,
  type ElementCallThemeKind,
  type ElementMediaStateDetail,
} from './types';
import { ElementWidgetActions } from './types';

export type CallEmbedEvent =
  | 'preparing'
  | 'error:preparing'
  | 'ready'
  | 'capabilitiesNotified'
  | ElementWidgetActions;

export class CallEmbed {
  private readonly mx: MatrixClient;

  public readonly call: ClientWidgetApi;

  public readonly iframe: HTMLIFrameElement;

  public readonly room: Room;

  public joined = false;

  public readonly control: CallControl;

  private readonly container: HTMLElement;

  private readUpToMap: { [roomId: string]: string } = {};

  private eventsToFeed = new WeakSet<MatrixEvent>();

  private fedInitialRoom = false;

  private readonly disposables: Array<() => void> = [];

  static getIntent(dm: boolean, ongoing: boolean, voiceOnly = false): ElementCallIntent {
    if (ongoing) {
      if (dm) {
        return voiceOnly ? ElementCallIntent.JoinExistingDMVoice : ElementCallIntent.JoinExistingDM;
      }
      return voiceOnly ? ElementCallIntent.JoinExistingVoice : ElementCallIntent.JoinExisting;
    }
    if (dm) {
      return voiceOnly ? ElementCallIntent.StartCallDMVoice : ElementCallIntent.StartCallDM;
    }
    return voiceOnly ? ElementCallIntent.StartCallVoice : ElementCallIntent.StartCall;
  }

  static getWidget(
    mx: MatrixClient,
    room: Room,
    intent: ElementCallIntent,
    themeKind: ElementCallThemeKind
  ): Widget {
    const userId = mx.getSafeUserId();
    const deviceId = mx.getDeviceId() ?? '';
    const clientOrigin = window.location.origin;
    const widgetId = `call-embed-${Math.random().toString(36).slice(2, 10)}`;
    const baseUrl = mx.baseUrl ?? mx.getHomeserverUrl();

    const params = new URLSearchParams({
      widgetId,
      parentUrl: clientOrigin,
      baseUrl,
      roomId: room.roomId,
      userId,
      deviceId,
      intent,

      skipLobby: 'true',
      confineToRoom: 'true',
      appPrompt: 'false',
      perParticipantE2EE: room.hasEncryptionStateEvent().toString(),
      lang: 'en',
      theme: themeKind,
    });

    const base = import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    const widgetUrl = new URL(`${base}element-call/index.html`, window.location.origin);
    widgetUrl.search = params.toString();

    const options: IWidget = {
      id: widgetId,
      creatorUserId: userId,
      name: 'Call',
      type: 'm.call',
      url: widgetUrl.href,
      waitForIframeLoad: false,
      data: {},
    };

    return new Widget(options);
  }

  static getIframe(url: string): HTMLIFrameElement {
    const iframe = document.createElement('iframe');

    iframe.title = 'Call';
    iframe.sandbox =
      'allow-forms allow-scripts allow-same-origin allow-popups allow-modals allow-downloads';
    iframe.allow = 'microphone; camera; display-capture; autoplay; clipboard-write;';
    iframe.src = url;

    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';

    return iframe;
  }

  constructor(
    mx: MatrixClient,
    room: Room,
    widget: Widget,
    container: HTMLElement,
    initialControlState?: CallControlState
  ) {
    const iframe = CallEmbed.getIframe(
      widget.getCompleteUrl({ currentUserId: mx.getSafeUserId() })
    );
    container.append(iframe);

    const callWidgetDriver: WidgetDriver = new CallWidgetDriver(mx, room.roomId);
    const call: ClientWidgetApi = new ClientWidgetApi(widget, iframe, callWidgetDriver);

    this.mx = mx;
    this.call = call;
    this.room = room;
    this.iframe = iframe;
    this.container = container;

    this.iframe.addEventListener('load', () => this.applyStyles());

    const controlState = initialControlState ?? new CallControlState(true, false, true);
    this.control = new CallControl(controlState, call, iframe);

    let initialMediaEvent = true;
    this.disposables.push(
      this.listenAction<ElementMediaStateDetail>(ElementWidgetActions.DeviceMute, (evt) => {
        if (initialMediaEvent) {
          initialMediaEvent = false;
          void this.control.applyState().catch(() => {});
          return;
        }
        this.control.onMediaState(evt);
      })
    );

    this.start();
  }

  get roomId(): string {
    return this.room.roomId;
  }

  get document(): Document | undefined {
    return this.iframe.contentDocument ?? this.iframe.contentWindow?.document;
  }

  public setTheme(theme: ElementCallThemeKind) {
    return this.call.transport
      .send(WidgetApiToWidgetAction.ThemeChange, {
        name: theme,
      })
      .catch(() => {});
  }

  public hangup() {
    return this.call.transport.send(ElementWidgetActions.HangupCall, {}).catch(() => {});
  }

  public onPreparing(callback: () => void) {
    return this.listenEvent('preparing', callback);
  }

  public onPreparingError(callback: (error: unknown) => void) {
    return this.listenEvent('error:preparing', callback);
  }

  public onReady(callback: () => void) {
    return this.listenEvent('ready', callback);
  }

  public onCapabilitiesNotified(callback: () => void) {
    return this.listenEvent('capabilitiesNotified', callback);
  }

  public onCallJoined(callback: () => void) {
    return this.listenAction(ElementWidgetActions.JoinCall, callback);
  }

  public onHangup(callback: () => void) {
    return this.listenAction(ElementWidgetActions.HangupCall, callback);
  }

  public onClose(callback: () => void) {
    return this.listenAction(ElementWidgetActions.Close, callback);
  }

  private start() {
    this.call.setViewedRoomId(this.roomId);
    this.disposables.push(
      this.listenAction(ElementWidgetActions.JoinCall, () => {
        this.joined = true;
        this.applyStyles();
        this.feedInitialRoom();
      })
    );

    this.disposables.push(this.onReady(() => this.applyStyles()));
    this.disposables.push(this.onReady(() => this.feedInitialRoom()));
    this.disposables.push(this.onCapabilitiesNotified(() => this.feedInitialRoom()));

    this.mx.getRooms().forEach((room) => {
      const events = room.getLiveTimeline()?.getEvents() || [];
      const roomEvent = events[events.length - 1];
      if (!roomEvent) return;
      this.readUpToMap[room.roomId] = roomEvent.getId()!;
    });

    this.mx.on(ClientEvent.Event, this.onEvent);
    this.mx.on(MatrixEventEvent.Decrypted, this.onEventDecrypted);
    this.mx.on(RoomStateEvent.Events, this.onStateUpdate);
    this.mx.on(ClientEvent.ToDeviceEvent, this.onToDeviceEvent);
  }

  public dispose(): void {
    this.disposables.forEach((disposable) => {
      disposable();
    });
    this.call.stop();
    if (this.iframe.parentElement === this.container) {
      this.container.removeChild(this.iframe);
    }
    this.control.dispose();

    this.mx.off(ClientEvent.Event, this.onEvent);
    this.mx.off(MatrixEventEvent.Decrypted, this.onEventDecrypted);
    this.mx.off(RoomStateEvent.Events, this.onStateUpdate);
    this.mx.off(ClientEvent.ToDeviceEvent, this.onToDeviceEvent);

    this.readUpToMap = {};
    this.eventsToFeed = new WeakSet<MatrixEvent>();
  }

  private applyStyles(): void {
    const doc = this.document;
    if (!doc) return;

    doc.body.style.setProperty('background', 'none', 'important');

    const existing = doc.getElementById('wizardchat-call-hide-chrome');
    if (!existing) {
      const style = doc.createElement('style');
      style.id = 'wizardchat-call-hide-chrome';
      style.textContent =
        'header:has([data-testid="roomHeader_roomName"]) { display: none !important; }';
      (doc.head ?? doc.documentElement).appendChild(style);
    }
  }

  private feedInitialRoom(): void {
    if (this.fedInitialRoom) return;
    this.fedInitialRoom = true;

    const stateEvents: MatrixEvent[] = [];
    const liveState = this.room.getLiveTimeline()?.getState(Direction.Forward);
    liveState?.events.forEach((byStateKey) => {
      byStateKey.forEach((ev) => stateEvents.push(ev));
    });
    for (const ev of stateEvents) {
      void this.call.feedStateUpdate(ev.getEffectiveEvent() as IRoomEvent).catch((e) => {
        console.error('Error feeding initial state to widget: ', e);
      });
    }

    const timeline = this.room.getLiveTimeline()?.getEvents() ?? [];
    const recent = timeline.length > 1000 ? timeline.slice(-1000) : timeline;
    for (const ev of recent) {
      void this.call.feedEvent(ev.getEffectiveEvent() as IRoomEvent).catch((e) => {
        console.error('Error feeding initial event to widget: ', e);
      });
    }
  }

  private onEvent = (ev: MatrixEvent): void => {
    this.mx.decryptEventIfNeeded(ev);
    this.feedEvent(ev);
  };

  private onEventDecrypted = (ev: MatrixEvent): void => {
    this.feedEvent(ev);
  };

  private onStateUpdate = (ev: MatrixEvent): void => {
    if (!this.call) return;
    const raw = ev.getEffectiveEvent();
    this.call.feedStateUpdate(raw as IRoomEvent).catch((e) => {
      console.error('Error sending state update to widget: ', e);
    });
  };

  private onToDeviceEvent = async (ev: MatrixEvent): Promise<void> => {
    await this.mx.decryptEventIfNeeded(ev);
    if (ev.isDecryptionFailure()) return;
    await this.call?.feedToDevice(ev.getEffectiveEvent() as IRoomEvent, ev.isEncrypted());
  };

  private relatesToUnknown(ev: MatrixEvent): boolean {
    // Replies to unknown events don't count
    if (!ev.relationEventId || ev.replyEventId) return false;
    const room = this.mx.getRoom(ev.getRoomId());
    return room === null || !room.findEventById(ev.relationEventId);
  }

  private advanceReadUpToMarker(ev: MatrixEvent): boolean {
    const evId = ev.getId();
    if (evId === undefined) return false;
    const roomId = ev.getRoomId();
    if (roomId === undefined) return false;
    const room = this.mx.getRoom(roomId);
    if (room === null) return false;

    const upToEventId = this.readUpToMap[roomId];
    if (!upToEventId) {
      this.readUpToMap[roomId] = evId;
      return true;
    }

    if (upToEventId === evId) return false;

    const timeline = room.getLiveTimeline();
    const events = [...timeline.getEvents()].reverse().slice(0, 100);
    const isRelevantTimelineEvent = (timelineEvent: MatrixEvent): boolean =>
      timelineEvent.getId() === upToEventId || timelineEvent.getId() === evId;
    const possibleMarkerEv = events.find(isRelevantTimelineEvent);
    if (possibleMarkerEv?.getId() === upToEventId) {
      return false;
    }
    if (possibleMarkerEv?.getId() === evId) {
      this.readUpToMap[roomId] = evId;
      return true;
    }

    return false;
  }

  private isFromInvite(ev: MatrixEvent): boolean {
    const room = this.mx.getRoom(ev.getRoomId());
    return room?.getMyMembership() === KnownMembership.Invite;
  }

  private feedEvent(ev: MatrixEvent): void {
    if (!this.call) return;
    if (
      this.eventsToFeed.delete(ev) ||
      this.relatesToUnknown(ev) ||
      this.isFromInvite(ev) ||
      this.advanceReadUpToMarker(ev)
    ) {
      if (ev.isBeingDecrypted() || ev.isDecryptionFailure()) {
        this.eventsToFeed.add(ev);
      } else {
        const raw = ev.getEffectiveEvent();
        this.call.feedEvent(raw as IRoomEvent).catch((e) => {
          console.error('Error sending event to widget: ', e);
        });
      }
    }
  }

  public listenAction<T>(type: string, callback: (event: CustomEvent<T>) => void) {
    return this.listenEvent(`action:${type}`, callback);
  }

  public listenEvent<T>(type: string, callback: (event: T) => void) {
    this.call.on(type, callback);
    return () => {
      this.call.off(type, callback);
    };
  }
}
