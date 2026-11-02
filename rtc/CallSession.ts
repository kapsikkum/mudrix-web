import {
  type AudioCaptureOptions,
  ConnectionState,
  type ScreenShareCaptureOptions,
  type LocalAudioTrack,
  type LocalParticipant,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  Room as LivekitRoom,
  RoomEvent as LivekitRoomEvent,
  Track,
} from 'livekit-client';
import {
  EventType,
  type MatrixClient,
  type MatrixEvent,
  MatrixEventEvent,
  RelationType,
  type Room,
  RoomEvent,
  RoomStateEvent,
} from 'matrix-js-sdk';
import {
  type CallMembership,
  type LivekitTransportConfig,
  MatrixRTCSession,
  MatrixRTCSessionEvent,
  isLivekitTransport,
  isLivekitTransportConfig,
} from 'matrix-js-sdk/lib/matrixrtc';
import { getLivekitTransport, isTrustedRemoteServiceUrl, normalizeServiceUrl } from './discovery';
import { createE2EEWorker } from './e2eeWorker';
import { getSfuConfig, type MemberIdentity } from './jwt';
import { MatrixKeyProvider, type ConnectionKeyProvider } from './keyProvider';
import { roomOptions } from './options';
import { GainProcessor } from './gainProcessor';
import type {
  AudioProcessing,
  CallConnectionStats,
  CallStatsEntry,
  CallDataListener,
  CallErrorKind,
  CallParticipant,
  CallSnapshot,
  DeviceKind,
  JoinOptions,
  MediaTrackHandle,
  PreferredDevices,
} from './types';

const DEFAULT_AUDIO_PROCESSING: AudioProcessing = {
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
};

// Tells a screen sharer who is watching their share. Same topic as upstream WizardChat, so the two
// clients see each other's viewers.
const STREAM_WATCH_TOPIC = 'org.wizardchat.stream-watch';
const DELAYED_LEAVE_DELAY_MS = 18000;
const DELAYED_LEAVE_RESTART_MS = 4000;
const LEAVE_TIMEOUT_MS = 1000;
const REACTION_VISIBLE_MS = 3000;
const SCREEN_SHARE_OPTIONS: ScreenShareCaptureOptions = {
  audio: { restrictOwnAudio: true } as AudioCaptureOptions,
  systemAudio: 'include',
};

const RECONNECT_GIVE_UP_MS = 120_000;
const NETWORK_RETRY_MS = 3000;
const SUBSCRIBE_RETRY_MS = 5000;

// Same lifetime the SDK uses for call notifications
const RING_LIFETIME_MS = 30000;

const CALL_REACTION_EVENT = 'io.element.call.reaction';
const RAISED_HAND_KEY = '🖐️';

interface Connection {
  serviceUrl: string;
  room: LivekitRoom;
  publisher: boolean;
  worker?: Worker;
  keyProvider?: ConnectionKeyProvider;
  sfuUrl: string;
  livekitAlias: string;
}

export class CallError extends Error {
  constructor(
    readonly kind: CallErrorKind,
    message: string
  ) {
    super(message);
    this.name = 'CallError';
  }
}

const INITIAL: CallSnapshot = {
  phase: 'idle',
  error: null,
  roomId: null,
  encrypted: false,
  local: { microphone: false, camera: false, sound: true, screenshare: false },
  participants: [],
  ring: null,
  reconnecting: false,
  awaitingMembership: false,
};

function clampVolume(volume: number, max: number): number {
  return Math.min(Math.max(volume, 0), max);
}

export function listMediaDevices(kind: DeviceKind): Promise<MediaDeviceInfo[]> {
  return LivekitRoom.getLocalDevices(kind, true);
}

function waitForNetwork(): Promise<void> {
  if (navigator.onLine) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener('online', done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 5000);
    window.addEventListener('online', done);
  });
}

const NEW_JOINER_MIC_WINDOW_MS = 2000;

// The SDK can keep a stale member list when two recalculations finish out of order, so the list
// is also re-read on every call member event and on this timer.
const MEMBERSHIP_RECHECK_MS = 5000;

// How long someone who is on the member list but not on the call server stays on the stage
const ABSENT_HIDE_MS = 10_000;

export class CallSession {
  private snapshot: CallSnapshot = INITIAL;
  private listeners = new Set<() => void>();
  private updateQueued = false;

  private readonly client: MatrixClient;
  private readonly room: Room;
  private rtcSession?: MatrixRTCSession;
  private checkedMemberships?: CallMembership[];
  private membershipCheck = 0;
  private membershipTimer?: ReturnType<typeof setInterval>;
  private identity?: MemberIdentity;
  private ownTransport?: LivekitTransportConfig;
  private keyProvider?: MatrixKeyProvider;
  private connections = new Map<string, Connection>();
  private sameRoomServices = new Set<string>();
  private pendingServices = new Set<string>();
  private audioElements = new Map<RemoteTrack, HTMLMediaElement[]>();
  private audioOwners = new Map<RemoteTrack, string>();
  private userVolumes = new Map<string, number>();
  private mutedUsers = new Set<string>();
  private keyIssues = new Set<string>();
  private streamVolumes = new Map<string, number>();
  private audioContainer?: HTMLDivElement;
  private deafened = false;
  private devices: PreferredDevices = {};
  private audioProcessing: AudioProcessing = DEFAULT_AUDIO_PROCESSING;
  private micWanted = false;
  private pushToTalk = false;
  private transmitting = false;
  private cameraWanted = false;
  private reconnecting = false;
  private subscribeRetry?: ReturnType<typeof setTimeout>;
  private watchedStreams = new Set<string>();
  /** Participant ids of those watching our own screen share. */
  private streamWatchers = new Set<string>();
  private hiddenCameras = new Set<string>();
  private joinedAfterUs = new Map<string, number>();
  private micGraceTimer?: ReturnType<typeof setTimeout>;
  private absentSince = new Map<string, number>();
  private absentTimer?: ReturnType<typeof setTimeout>;
  private callIntent?: string;
  private ringNotificationId?: string;
  private ringTimer?: ReturnType<typeof setTimeout>;
  private inputVolume = 1;
  private outputVolume = 1;
  private gainProcessor?: GainProcessor;
  private audioContext?: AudioContext;
  private encrypted = false;
  private disposed = false;

  private raisedHands = new Map<string, string>();
  private ownHandEventId: string | null = null;
  private reactions = new Map<string, string>();
  private reactionTimers = new Set<ReturnType<typeof setTimeout>>();
  private dataListeners = new Set<CallDataListener>();

  constructor(client: MatrixClient, room: Room) {
    this.client = client;
    this.room = room;
    this.snapshot = { ...INITIAL, roomId: room.roomId };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): CallSnapshot => this.snapshot;

  get matrixRoom(): Room {
    return this.room;
  }

  async join(options: JoinOptions): Promise<void> {
    const { client, room } = this;
    const userId = client.getUserId();
    const deviceId = client.getDeviceId();
    if (!userId || !deviceId) throw new CallError('unknown', 'Client is not logged in');

    this.deafened = options.deafened;
    this.micWanted = options.micEnabled && !options.deafened;
    this.pushToTalk = !!options.pushToTalk;
    this.callIntent = options.callIntent;
    this.devices = { ...options.devices };
    this.audioProcessing = { ...DEFAULT_AUDIO_PROCESSING, ...options.audioProcessing };
    this.inputVolume = clampVolume(options.inputVolume ?? 1, 2);
    this.outputVolume = clampVolume(options.outputVolume ?? 1, 1);
    this.encrypted = options.encrypt ?? room.hasEncryptionStateEvent();
    this.patch({
      phase: 'joining',
      roomId: room.roomId,
      encrypted: this.encrypted,
      local: { microphone: false, camera: false, sound: !options.deafened, screenshare: false },
    });

    try {
      const transport = await getLivekitTransport(client);
      // Hung up while connecting: nothing has been joined yet, so there is nothing to undo
      if (this.disposed) return;
      if (!transport) throw new CallError('no-sfu', 'This homeserver has no call server (LiveKit)');
      this.ownTransport = transport;
      this.identity = { userId, deviceId, memberId: crypto.randomUUID() };

      const rtcSession = client.matrixRTC.getRoomSession(room);
      this.rtcSession = rtcSession;
      if (this.encrypted) {
        this.keyProvider = new MatrixKeyProvider();
        this.keyProvider.onKey = this.onMediaKey;
        this.keyProvider.setRTCSession(rtcSession);
      }
      rtcSession.on(MatrixRTCSessionEvent.MembershipsChanged, this.onSdkMembershipsChanged);
      room.on(RoomStateEvent.Events, this.onCallMemberEvent);
      this.membershipTimer = setInterval(this.checkMemberships, MEMBERSHIP_RECHECK_MS);
      rtcSession.on(MatrixRTCSessionEvent.MembershipManagerError, this.onMembershipError);
      rtcSession.on(MatrixRTCSessionEvent.DidSendCallNotification, this.onNotificationSent);
      client.on(RoomEvent.Timeline, this.onTimelineEvent);
      client.on(MatrixEventEvent.Decrypted, this.onDecrypted);
      window.addEventListener('online', this.onOnline);
      client.on(RoomEvent.Redaction, this.onRedaction);

      rtcSession.joinRTCSession(
        this.identity,
        [],
        { ...transport, livekit_alias: room.roomId } as LivekitTransportConfig,
        {
          callIntent: options.callIntent,
          notificationType: options.notificationType,
          manageMediaKeys: this.encrypted,
          delayedLeaveEventDelayMs: DELAYED_LEAVE_DELAY_MS,
          delayedLeaveEventRestartMs: DELAYED_LEAVE_RESTART_MS,
          networkErrorRetryMs: NETWORK_RETRY_MS,
          maximumNetworkErrorRetryCount: Math.ceil(RECONNECT_GIVE_UP_MS / NETWORK_RETRY_MS),
        }
      );

      const publisher = await this.connect(transport.livekit_service_url, true);
      if (this.disposed) return;
      const lp = publisher.room.localParticipant;
      if (options.micEnabled && !options.deafened) {
        await lp.setMicrophoneEnabled(true);
        if (this.disposed) return;
        await this.applyInputVolume();
        if (this.disposed) return;
      }
      this.applyGate();
      if (this.disposed) return;
      this.patch({
        phase: 'joined',
        local: this.readLocal(),
        participants: this.readParticipants(),
        awaitingMembership: !this.ownMembership,
      });
      if (this.disposed) return;
      this.syncRemoteConnections();
    } catch (err) {
      // Left (or already failed) while this was still going: whatever it threw is not news
      if (this.disposed) return;
      const kind = err instanceof CallError ? err.kind : 'connection';
      this.fail(kind, err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async leave(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    try {
      await this.rtcSession?.leaveRoomSession(LEAVE_TIMEOUT_MS);
    } catch {
      // The delayed leave event cleans up the membership anyway
    }
    this.teardown();
    this.patch({ phase: 'left' });
  }

  async setMicrophone(enabled: boolean): Promise<void> {
    this.micWanted = enabled;
    if (enabled && this.deafened) this.applyDeafened(false);
    const lp = this.localParticipant;
    if (!lp) return;
    await lp.setMicrophoneEnabled(enabled);
    if (enabled) await this.applyInputVolume();
    this.applyGate();
    this.scheduleUpdate();
  }

  setPushToTalk(enabled: boolean): void {
    this.pushToTalk = enabled;
    this.transmitting = false;
    this.applyGate();
    this.scheduleUpdate();
  }

  setTransmitting(transmitting: boolean): void {
    if (!this.pushToTalk) return;
    this.transmitting = transmitting;
    this.applyGate();
    this.scheduleUpdate();
  }

  private applyGate(): void {
    const track = this.localParticipant?.getTrackPublication(Track.Source.Microphone)?.track;
    if (track) track.mediaStreamTrack.enabled = !this.pushToTalk || this.transmitting;
  }

  async setInputVolume(volume: number): Promise<void> {
    this.inputVolume = clampVolume(volume, 2);
    await this.applyInputVolume();
  }

  setOutputVolume(volume: number): void {
    this.outputVolume = clampVolume(volume, 1);
    this.applyAudio();
  }

  private async applyInputVolume(): Promise<void> {
    const track = this.localParticipant?.getTrackPublication(Track.Source.Microphone)
      ?.audioTrack as LocalAudioTrack | undefined;
    if (!track) return;
    const attached = !!this.gainProcessor && track.getProcessor() === this.gainProcessor;
    if (attached) {
      this.gainProcessor!.setGain(this.inputVolume);
      return;
    }
    if (this.inputVolume === 1) return;
    this.audioContext ??= new AudioContext();
    this.gainProcessor = new GainProcessor(this.inputVolume);
    await track.setAudioContext(this.audioContext);
    await track.setProcessor(this.gainProcessor);
    this.applyGate(); // the processed track is what gets sent now
  }

  async setCamera(enabled: boolean): Promise<void> {
    this.cameraWanted = enabled;
    await this.localParticipant?.setCameraEnabled(enabled);
    this.scheduleUpdate();
  }

  async setScreenShare(enabled: boolean): Promise<void> {
    try {
      await this.localParticipant?.setScreenShareEnabled(enabled, SCREEN_SHARE_OPTIONS);
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name !== 'NotAllowedError' && name !== 'AbortError') throw err;
    }
    this.scheduleUpdate();
  }

  async setDeafened(deafened: boolean): Promise<void> {
    this.applyDeafened(deafened);
    if (deafened) {
      this.micWanted = false;
      await this.localParticipant?.setMicrophoneEnabled(false);
    }
    this.scheduleUpdate();
  }

  async listDevices(kind: DeviceKind): Promise<MediaDeviceInfo[]> {
    return listMediaDevices(kind);
  }

  getActiveDevice(kind: DeviceKind): string | undefined {
    return this.publisher?.room.getActiveDevice(kind) ?? this.devices[kind];
  }

  async switchDevice(kind: DeviceKind, deviceId: string): Promise<void> {
    this.devices = { ...this.devices, [kind]: deviceId };
    await Promise.all(
      [...this.connections.values()].map((c) =>
        kind === 'audiooutput' || c.publisher ? c.room.switchActiveDevice(kind, deviceId) : null
      )
    );
    if (kind === 'audioinput') {
      await this.applyInputVolume();
    }
    this.applyGate(); // a new device means a new track
    this.scheduleUpdate();
  }

  async startAudio(): Promise<void> {
    await Promise.all([...this.connections.values()].map((c) => c.room.startAudio()));
  }

  setUserVolume(userId: string, volume: number): void {
    const clamped = clampVolume(volume, 1);
    if (clamped === 1) this.userVolumes.delete(userId);
    else this.userVolumes.set(userId, clamped);
    this.applyAudio();
    this.scheduleUpdate();
  }

  setStreamVolume(userId: string, volume: number): void {
    const clamped = clampVolume(volume, 1);
    if (clamped === 1) this.streamVolumes.delete(userId);
    else this.streamVolumes.set(userId, clamped);
    this.applyAudio();
    this.scheduleUpdate();
  }

  setUserMuted(userId: string, muted: boolean): void {
    if (muted) this.mutedUsers.add(userId);
    else this.mutedUsers.delete(userId);
    this.applyAudio();
    this.scheduleUpdate();
  }

  async sendReaction(emoji: string, name: string): Promise<void> {
    const membershipEventId = this.ownMembership?.eventId;
    if (!this.client || !this.room || !membershipEventId) return;
    await this.client.sendEvent(
      this.room.roomId,
      CALL_REACTION_EVENT as never,
      {
        'm.relates_to': { rel_type: 'm.reference', event_id: membershipEventId },
        emoji,
        name,
      } as never
    );
  }

  async setHandRaised(raised: boolean): Promise<void> {
    const own = this.ownMembership;
    if (!this.client || !this.room || !own?.eventId) return;
    if (raised && !this.ownHandEventId) {
      const res = await this.client.sendEvent(
        this.room.roomId,
        'm.reaction' as never,
        {
          'm.relates_to': { rel_type: 'm.annotation', event_id: own.eventId, key: RAISED_HAND_KEY },
        } as never
      );
      this.ownHandEventId = res.event_id;
      this.raisedHands.set(own.eventId, res.event_id);
    } else if (!raised && this.ownHandEventId) {
      const eventId = this.ownHandEventId;
      this.ownHandEventId = null;
      this.raisedHands.delete(own.eventId);
      await this.client.redactEvent(this.room.roomId, eventId);
    }
    this.scheduleUpdate();
  }

  async sendData(topic: string, payload: unknown): Promise<void> {
    const local = this.localParticipant;
    if (!local) return;
    await local.publishData(new TextEncoder().encode(JSON.stringify(payload)), {
      reliable: true,
      topic,
    });
  }

  onData(listener: CallDataListener): () => void {
    this.dataListeners.add(listener);
    return () => {
      this.dataListeners.delete(listener);
    };
  }

  private get publisher(): Connection | undefined {
    return [...this.connections.values()].find((c) => c.publisher);
  }

  private get localParticipant(): LocalParticipant | undefined {
    return this.publisher?.room.localParticipant;
  }

  private get ownMembership(): CallMembership | undefined {
    const id = this.identity;
    return this.members.find((m) => m.userId === id?.userId && m.deviceId === id?.deviceId);
  }

  /** Who is in the call: the SDK's list, replaced by our own re-read once we have one. */
  private get members(): CallMembership[] {
    return this.checkedMemberships ?? this.rtcSession?.memberships ?? [];
  }

  private checkMemberships = (): void => {
    const session = this.rtcSession;
    if (!session || this.disposed) return;
    const check = ++this.membershipCheck;
    void MatrixRTCSession.sessionMembershipsForSlot(this.room, session.slotDescription)
      .then((members) => {
        // A newer read supersedes this one, so a slow reply can never bring back someone who left
        if (this.disposed || check !== this.membershipCheck) return;
        const fresh = members.filter((m) => !m.isExpired());
        const prev = this.members;
        this.checkedMemberships = fresh;
        if (fresh.length !== prev.length || fresh.some((m, i) => m.eventId !== prev[i]?.eventId)) {
          this.onMembershipsChanged();
        }
      })
      .catch(() => {});
  };

  private onCallMemberEvent = (event: MatrixEvent): void => {
    if (event.getType() === EventType.GroupCallMemberPrefix) this.checkMemberships();
  };

  private async connect(serviceUrl: string, publisher: boolean): Promise<Connection> {
    const client = this.client;
    const delayId = publisher ? this.rtcSession?.delayId : undefined;
    const sfu = await getSfuConfig(client, serviceUrl, this.room.roomId, this.identity!, {
      legacyOnly: publisher,
      delay: delayId
        ? { delayId, delayTimeoutMs: DELAYED_LEAVE_DELAY_MS, homeserverBaseUrl: client.baseUrl }
        : undefined,
    }).catch((err: unknown) => {
      throw new CallError('auth', err instanceof Error ? err.message : String(err));
    });

    // Left while the token was being fetched: leave() has already torn everything down, so
    // opening a connection now would outlive the call (and play its audio into the page)
    if (this.disposed) throw new CallError('connection', 'The call was left before it connected');

    const own = this.publisher;
    if (
      !publisher &&
      own &&
      normalizeServiceUrl(own.sfuUrl) === normalizeServiceUrl(sfu.url) &&
      own.livekitAlias === sfu.livekitAlias
    ) {
      this.sameRoomServices.add(serviceUrl);
      return own;
    }

    const keyProvider = this.keyProvider
      ? this.keyProvider.createConnectionKeyProvider()
      : undefined;
    const worker = keyProvider ? createE2EEWorker() : undefined;
    const room = new LivekitRoom(
      roomOptions(
        this.devices,
        this.audioProcessing,
        keyProvider && worker ? { keyProvider, worker } : undefined
      )
    );
    const connection: Connection = {
      serviceUrl,
      room,
      publisher,
      worker,
      keyProvider,
      sfuUrl: sfu.url,
      livekitAlias: sfu.livekitAlias,
    };
    this.connections.set(serviceUrl, connection);
    this.listen(room);

    try {
      await room.connect(sfu.url, sfu.jwt, { autoSubscribe: false });
      if (this.disposed) {
        this.closeConnection(connection);
        throw new CallError('connection', 'The call was left before it connected');
      }
      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.trackPublications.values()) {
          this.applySubscription(publication, participant);
        }
      }
      if (keyProvider) {
        await room.setE2EEEnabled(true);
        if (this.disposed) {
          this.closeConnection(connection);
          throw new CallError('connection', 'The call was left before it connected');
        }
      }
      this.scheduleUpdate();
      return connection;
    } catch (err) {
      this.closeConnection(connection);
      throw err;
    }
  }

  private listen(room: LivekitRoom): void {
    const update = () => this.scheduleUpdate();
    room
      .on(LivekitRoomEvent.ParticipantConnected, (participant) => {
        this.joinedAfterUs.set(participant.identity, Date.now());
        update();
      })
      .on(LivekitRoomEvent.ParticipantDisconnected, (participant) => {
        this.joinedAfterUs.delete(participant.identity);
        this.streamWatchers.delete(participant.identity);
        update();
      })
      .on(LivekitRoomEvent.TrackPublished, (publication, participant) => {
        this.applySubscription(publication, participant);
        update();
      })
      .on(LivekitRoomEvent.TrackUnpublished, (publication, participant) => {
        if (publication.source === Track.Source.ScreenShare) {
          this.watchedStreams.delete(participant.identity);
        }
        update();
      })
      .on(LivekitRoomEvent.DataReceived, (data, participant, _kind, topic, _enc, identity) => {
        const from = participant?.identity ?? identity;
        if (!topic || !from) return;
        let payload: unknown;
        try {
          payload = JSON.parse(new TextDecoder().decode(data));
        } catch {
          return;
        }
        if (topic === STREAM_WATCH_TOPIC) {
          this.onStreamWatch(payload, from);
          return;
        }
        for (const listener of this.dataListeners) listener(topic, payload, from);
      })
      .on(LivekitRoomEvent.TrackMuted, update)
      .on(LivekitRoomEvent.TrackUnmuted, update)
      .on(LivekitRoomEvent.LocalTrackPublished, update)
      .on(LivekitRoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.source === Track.Source.ScreenShare) this.streamWatchers.clear();
        update();
      })
      .on(LivekitRoomEvent.ActiveSpeakersChanged, update)
      .on(LivekitRoomEvent.EncryptionError, this.onEncryptionError)
      .on(LivekitRoomEvent.TrackSubscribed, (track, _publication, participant) => {
        if (track.kind === Track.Kind.Audio) this.playAudio(track, participant.identity);
        update();
      })
      .on(LivekitRoomEvent.TrackUnsubscribed, (track) => {
        this.stopAudio(track);
        update();
      })
      .on(LivekitRoomEvent.ConnectionStateChanged, (state) => {
        const own = [...this.connections.values()].find((c) => c.room === room)?.publisher;
        if (own && state === ConnectionState.Connected && !this.reconnecting) {
          this.setReconnecting(false);
        } else if (
          own &&
          (state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting)
        ) {
          this.setReconnecting(true);
        }
        if (state === ConnectionState.Disconnected && !this.disposed) {
          const lost = [...this.connections.values()].find((c) => c.room === room);
          if (lost) this.onConnectionLost(lost);
        }
        update();
      });
  }

  private applySubscription(
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ): void {
    const isStream =
      publication.source === Track.Source.ScreenShare ||
      publication.source === Track.Source.ScreenShareAudio;
    if (isStream) {
      publication.setSubscribed(this.watchedStreams.has(participant.identity));
    } else if (publication.source === Track.Source.Camera) {
      publication.setSubscribed(!this.hiddenCameras.has(participant.identity));
    } else {
      publication.setSubscribed(true);
    }
  }

  private resubscribe(participantId: string): void {
    for (const connection of this.connections.values()) {
      const participant = connection.room.remoteParticipants.get(participantId);
      if (!participant) continue;
      for (const publication of participant.trackPublications.values()) {
        this.applySubscription(publication, participant);
      }
    }
    this.scheduleUpdate();
  }

  setCameraHidden(participantId: string, hidden: boolean): void {
    if (hidden) this.hiddenCameras.add(participantId);
    else this.hiddenCameras.delete(participantId);
    this.resubscribe(participantId);
  }

  setWatchingStream(participantId: string, watch: boolean): void {
    if (watch) this.watchedStreams.add(participantId);
    else this.watchedStreams.delete(participantId);
    this.resubscribe(participantId);
    void this.sendData(STREAM_WATCH_TOPIC, { owner: participantId, watching: watch }).catch(
      () => {}
    );
  }

  private onStreamWatch(payload: unknown, from: string): void {
    const msg = payload as { owner?: unknown; watching?: unknown } | null;
    if (!msg || msg.owner !== this.localParticipant?.identity) return;
    if (msg.watching === true) this.streamWatchers.add(from);
    else this.streamWatchers.delete(from);
    this.scheduleUpdate();
  }

  private playAudio(track: RemoteTrack, identity: string): void {
    if (!this.audioContainer) {
      this.audioContainer = document.createElement('div');
      this.audioContainer.hidden = true;
      this.audioContainer.dataset.mudrixRtc = 'audio';
      document.body.appendChild(this.audioContainer);
    }
    const element = track.attach();
    this.audioContainer.appendChild(element);
    this.audioElements.set(track, [...(this.audioElements.get(track) ?? []), element]);
    this.audioOwners.set(track, identity);
    this.applyAudio();
  }

  private userOfIdentity(identity: string): string | undefined {
    return this.members.find((m) => m.rtcBackendIdentity === identity)?.userId;
  }

  private applyAudio(): void {
    for (const [track, elements] of this.audioElements) {
      const identity = this.audioOwners.get(track);
      const userId = identity ? this.userOfIdentity(identity) : undefined;
      const isStream = track.source === Track.Source.ScreenShareAudio;
      const muted = this.deafened || (!isStream && !!userId && this.mutedUsers.has(userId));
      const volumes = isStream ? this.streamVolumes : this.userVolumes;
      const volume = userId ? (volumes.get(userId) ?? 1) : 1;
      for (const element of elements) {
        element.muted = muted;
        element.volume = volume * this.outputVolume;
      }
    }
  }

  private stopAudio(track: RemoteTrack): void {
    for (const element of this.audioElements.get(track) ?? []) {
      track.detach(element);
      element.remove();
    }
    this.audioElements.delete(track);
    this.audioOwners.delete(track);
  }

  private applyDeafened(deafened: boolean): void {
    this.deafened = deafened;
    this.applyAudio();
  }

  private syncRemoteConnections(): void {
    const session = this.rtcSession;
    const own = this.ownTransport?.livekit_service_url;
    if (!session || !own || this.disposed) return;
    const oldest = session.getOldestMembership();
    const wanted = new Set<string>();
    for (const membership of session.memberships) {
      if (!oldest) break;
      const transport = membership.getTransport(oldest);
      const url =
        transport && (isLivekitTransport(transport) || isLivekitTransportConfig(transport))
          ? normalizeServiceUrl(transport.livekit_service_url)
          : undefined;
      if (url && url !== own && !this.sameRoomServices.has(url)) {
        if (isTrustedRemoteServiceUrl(url)) wanted.add(url);
        else console.warn('[mudrix-rtc] ignoring a call server that is not public https:', url);
      }
    }
    for (const url of wanted) {
      if (!this.connections.has(url) && !this.pendingServices.has(url)) {
        this.pendingServices.add(url);
        void this.connect(url, false)
          .catch((err) => {
            console.warn('[mudrix-rtc] could not subscribe on', url, err);
            this.retrySubscribeSoon();
          })
          .finally(() => this.pendingServices.delete(url));
      }
    }
    for (const [url, connection] of this.connections) {
      if (!connection.publisher && !wanted.has(url)) this.closeConnection(connection);
    }
  }

  private closeConnection(connection: Connection): void {
    this.connections.delete(connection.serviceUrl);
    connection.keyProvider?.dispose();
    void connection.room.disconnect();
    connection.worker?.terminate();
  }

  private onConnectionLost(connection: Connection): void {
    this.closeConnection(connection);
    if (connection.publisher) void this.reconnectPublisher();
    else this.retrySubscribeSoon();
  }

  private async reconnectPublisher(): Promise<void> {
    if (this.reconnecting || this.disposed || !this.ownTransport) return;
    this.reconnecting = true;
    this.setReconnecting(true);
    const giveUpAt = Date.now() + RECONNECT_GIVE_UP_MS;
    let backoff = 1000;
    while (!this.disposed) {
      await waitForNetwork();
      try {
        const connection = await this.connect(this.ownTransport.livekit_service_url, true);
        if (this.disposed) {
          this.closeConnection(connection);
          return;
        }
        const lp = connection.room.localParticipant;
        if (this.micWanted && !this.deafened) {
          await lp.setMicrophoneEnabled(true);
          await this.applyInputVolume();
        }
        if (this.cameraWanted) await lp.setCameraEnabled(true);
        this.applyGate();
        this.reconnecting = false;
        this.setReconnecting(false);
        this.syncRemoteConnections();
        this.scheduleUpdate();
        return;
      } catch (err) {
        if (Date.now() + backoff > giveUpAt) {
          this.reconnecting = false;
          this.setReconnecting(false);
          this.fail('connection', 'Lost the connection to the call server');
          return;
        }
        console.warn('[mudrix-rtc] reconnecting failed, retrying', err);
        await new Promise((r) => setTimeout(r, backoff));
        backoff = Math.min(backoff * 2, 10_000);
      }
    }
  }

  private retrySubscribeSoon(): void {
    if (this.disposed || this.subscribeRetry) return;
    this.subscribeRetry = setTimeout(() => {
      this.subscribeRetry = undefined;
      this.syncRemoteConnections();
    }, SUBSCRIBE_RETRY_MS);
  }

  private onOnline = (): void => {
    if (this.disposed) return;
    this.syncRemoteConnections();
  };

  private onSdkMembershipsChanged = (): void => {
    this.checkMemberships();
    this.onMembershipsChanged();
  };

  private onMembershipsChanged = (): void => {
    const current = new Set(this.members.map((m) => m.eventId));
    for (const membershipId of this.raisedHands.keys()) {
      if (!current.has(membershipId)) this.raisedHands.delete(membershipId);
    }
    this.syncRemoteConnections();
    this.applyAudio();
    if (this.snapshot.ring && this.someoneElseJoined()) this.setRing(null);
    this.scheduleUpdate();
  };

  private someoneElseJoined(): boolean {
    const me = this.identity?.userId;
    return this.members.some((m) => m.userId !== me);
  }

  private onNotificationSent = (notification: {
    event_id?: string;
    notification_type?: string;
    lifetime?: number;
  }): void => {
    if (notification.notification_type !== 'ring' || !notification.event_id) return;
    if (this.someoneElseJoined()) return;
    this.startRing(notification.event_id, notification.lifetime ?? RING_LIFETIME_MS);
  };

  private startRing(notificationId: string, lifetime: number): void {
    this.ringNotificationId = notificationId;
    this.setRing('ringing');
    this.ringTimer = setTimeout(() => {
      if (this.snapshot.ring === 'ringing') this.setRing('unanswered');
    }, lifetime);
  }

  private setRing(ring: CallSnapshot['ring']): void {
    if (this.ringTimer) clearTimeout(this.ringTimer);
    this.ringTimer = undefined;
    this.patch({ ring });
  }

  /** The WebRTC stats of each call-server connection, for the connection info panel. */
  async getStats(): Promise<CallConnectionStats[]> {
    const toEntries = async (
      transport: { getStats(): Promise<RTCStatsReport> | undefined } | undefined
    ) => {
      const report = await transport?.getStats();
      return report ? ([...report.values()] as CallStatsEntry[]) : [];
    };
    return Promise.all(
      [...this.connections.values()].map(async (c) => {
        const manager = c.room.engine?.pcManager;
        return {
          server: c.sfuUrl,
          publisher: await toEntries(manager?.publisher),
          subscriber: await toEntries(manager?.subscriber),
        };
      })
    );
  }

  async ringAgain(): Promise<void> {
    const own = this.ownMembership;
    if (!own?.eventId || this.someoneElseJoined()) return;
    const content: Record<string, unknown> = {
      'm.mentions': { user_ids: [], room: true },
      notification_type: 'ring',
      'm.relates_to': { event_id: own.eventId, rel_type: RelationType.Reference },
      sender_ts: Date.now(),
      lifetime: RING_LIFETIME_MS,
    };
    if (this.callIntent) content['m.call.intent'] = this.callIntent;
    const { event_id } = await this.client.sendEvent(
      this.room.roomId,
      EventType.RTCNotification,
      content as never
    );
    this.startRing(event_id, RING_LIFETIME_MS);
  }

  private onDecrypted = (event: MatrixEvent): void => {
    this.onTimelineEvent(event, this.client.getRoom(event.getRoomId()) ?? undefined);
  };

  private onMembershipError = (error: unknown): void => {
    this.fail('membership', error instanceof Error ? error.message : String(error));
  };

  private membershipFor(eventId: string | undefined, sender: string | undefined) {
    if (!eventId) return undefined;
    return this.members.find((m) => m.eventId === eventId && m.userId === sender);
  }

  private onTimelineEvent = (event: MatrixEvent, room: Room | undefined): void => {
    if (!this.room || room?.roomId !== this.room.roomId) return;
    const relation = event.getContent()['m.relates_to'] as
      | { event_id?: string; key?: string; rel_type?: string }
      | undefined;
    if (
      event.getType() === EventType.RTCDecline &&
      this.snapshot.ring &&
      relation?.event_id === this.ringNotificationId &&
      event.getSender() !== this.identity?.userId
    ) {
      this.setRing('declined');
      return;
    }
    const membership = this.membershipFor(relation?.event_id, event.getSender());
    if (!membership) return;

    if (event.getType() === CALL_REACTION_EVENT) {
      const emoji = event.getContent().emoji;
      if (typeof emoji !== 'string') return;
      const id = membership.rtcBackendIdentity;
      this.reactions.set(id, emoji);
      const timer = setTimeout(() => {
        this.reactionTimers.delete(timer);
        if (this.reactions.get(id) === emoji) this.reactions.delete(id);
        this.scheduleUpdate();
      }, REACTION_VISIBLE_MS);
      this.reactionTimers.add(timer);
      this.scheduleUpdate();
    } else if (
      event.getType() === 'm.reaction' &&
      relation?.rel_type === 'm.annotation' &&
      relation.key?.startsWith('🖐') &&
      event.getId()
    ) {
      this.raisedHands.set(membership.eventId, event.getId()!);
      this.scheduleUpdate();
    }
  };

  private onRedaction = (event: MatrixEvent, room: Room): void => {
    if (room.roomId !== this.room?.roomId) return;
    const redacted = event.event.redacts ?? (event.getContent().redacts as string | undefined);
    for (const [membershipId, reactionId] of this.raisedHands) {
      if (reactionId === redacted) this.raisedHands.delete(membershipId);
    }
    this.scheduleUpdate();
  };

  private fail(kind: CallErrorKind, message: string): void {
    if (this.snapshot.phase === 'error' || this.snapshot.phase === 'left') return;
    this.disposed = true;
    void this.rtcSession?.leaveRoomSession(LEAVE_TIMEOUT_MS).catch(() => {});
    this.teardown();
    this.patch({ phase: 'error', error: { kind, message } });
  }

  private onMediaKey = (identity: string): void => {
    if (this.keyIssues.delete(identity)) this.scheduleUpdate();
  };

  private onEncryptionError = (error: Error, participant?: Participant): void => {
    const reason = /^(InvalidKey|MissingKey|InternalError):/.exec(error.message)?.[1] ?? 'Unknown';
    const identity = participant?.identity;
    console.warn('[mudrix-rtc] media encryption error', {
      identity,
      reason,
      message: error.message,
    });
    if (
      identity &&
      (reason === 'MissingKey' || reason === 'InvalidKey') &&
      !this.keyIssues.has(identity)
    ) {
      this.keyIssues.add(identity);
      this.scheduleUpdate();
    }
  };

  private teardown(): void {
    this.keyIssues.clear();
    this.rtcSession?.off(MatrixRTCSessionEvent.MembershipsChanged, this.onSdkMembershipsChanged);
    this.room.off(RoomStateEvent.Events, this.onCallMemberEvent);
    if (this.membershipTimer) clearInterval(this.membershipTimer);
    this.rtcSession?.off(MatrixRTCSessionEvent.MembershipManagerError, this.onMembershipError);
    this.rtcSession?.off(MatrixRTCSessionEvent.DidSendCallNotification, this.onNotificationSent);
    this.client?.off(RoomEvent.Timeline, this.onTimelineEvent);
    this.client?.off(MatrixEventEvent.Decrypted, this.onDecrypted);
    window.removeEventListener('online', this.onOnline);
    if (this.subscribeRetry) clearTimeout(this.subscribeRetry);
    if (this.ringTimer) clearTimeout(this.ringTimer);
    this.client?.off(RoomEvent.Redaction, this.onRedaction);
    for (const connection of [...this.connections.values()]) this.closeConnection(connection);
    for (const track of [...this.audioElements.keys()]) this.stopAudio(track);
    this.audioContainer?.remove();
    this.audioContainer = undefined;
    this.keyProvider?.dispose();
    void this.audioContext?.close();
    this.audioContext = undefined;
    void this.gainProcessor?.destroy();
    this.gainProcessor = undefined;
    for (const timer of this.reactionTimers) clearTimeout(timer);
    this.reactionTimers.clear();
    if (this.micGraceTimer) clearTimeout(this.micGraceTimer);
    if (this.absentTimer) clearTimeout(this.absentTimer);
  }

  private setReconnecting(on: boolean): void {
    if (this.snapshot.reconnecting !== on) this.patch({ reconnecting: on });
  }

  private patch(partial: Partial<CallSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    this.emit();
  }

  private scheduleUpdate(): void {
    if (this.updateQueued) return;
    this.updateQueued = true;
    queueMicrotask(() => {
      this.updateQueued = false;
      if (this.snapshot.phase === 'left' || this.snapshot.phase === 'error') return;
      this.patch({
        local: this.readLocal(),
        participants: this.readParticipants(),
        awaitingMembership: !this.ownMembership,
      });
    });
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private readLocal(): CallSnapshot['local'] {
    const lp = this.localParticipant;
    return {
      microphone: !!lp?.isMicrophoneEnabled,
      camera: !!lp?.isCameraEnabled,
      sound: !this.deafened,
      screenshare: !!lp?.isScreenShareEnabled,
    };
  }

  private readParticipants(): CallParticipant[] {
    const livekit = new Map<string, Participant>();
    for (const connection of this.connections.values()) {
      for (const participant of connection.room.remoteParticipants.values()) {
        livekit.set(participant.identity, participant);
      }
      if (connection.publisher) {
        const local = connection.room.localParticipant;
        livekit.set(local.identity, local);
      }
    }

    const now = Date.now();
    let graceEndsIn = Infinity;
    let absentEndsIn = Infinity;

    const handsByMembership = this.raisedHands;
    const seen = new Set<string>();
    const result: CallParticipant[] = [];
    // Until our own membership is published we are on the call server but nobody can see us in
    // the member list; show a stand-in for ourselves so the stage is not empty meanwhile
    const entries: Pick<
      CallMembership,
      'rtcBackendIdentity' | 'userId' | 'deviceId' | 'eventId'
    >[] = [...this.members];
    const self = this.localParticipant;
    if (self && this.identity && !this.ownMembership) {
      entries.push({
        rtcBackendIdentity: self.identity,
        userId: this.identity.userId,
        deviceId: this.identity.deviceId,
        eventId: '',
      });
    }
    for (const membership of entries) {
      const id = membership.rtcBackendIdentity;
      if (seen.has(id)) continue;
      seen.add(id);
      const participant = livekit.get(id);
      const isLocal =
        membership.userId === this.identity?.userId &&
        membership.deviceId === this.identity?.deviceId;
      // Someone whose membership outlives them (their app died and the server never sent the
      // delayed leave) is not on the call server any more: they leave the stage after a while
      if (participant || isLocal || this.snapshot.reconnecting) {
        this.absentSince.delete(id);
      } else {
        const since = this.absentSince.get(id) ?? now;
        this.absentSince.set(id, since);
        const left = ABSENT_HIDE_MS - (now - since);
        if (left <= 0) continue;
        absentEndsIn = Math.min(absentEndsIn, left);
      }
      const track = (source: Track.Source): MediaTrackHandle | null => {
        const publication = participant?.getTrackPublication(source);
        return publication?.track && !publication.isMuted ? publication.track : null;
      };
      const mic = participant?.getTrackPublication(Track.Source.Microphone);
      let audioMuted = false;
      if (isLocal) {
        audioMuted = !this.micWanted || this.deafened;
      } else if (participant && mic) {
        audioMuted = mic.isMuted;
      } else if (participant) {
        const joinedAt = this.joinedAfterUs.get(id);
        const waited = joinedAt === undefined ? Infinity : now - joinedAt;
        audioMuted = waited >= NEW_JOINER_MIC_WINDOW_MS;
        if (!audioMuted) graceEndsIn = Math.min(graceEndsIn, NEW_JOINER_MIC_WINDOW_MS - waited);
      }
      result.push({
        id,
        userId: membership.userId,
        deviceId: membership.deviceId,
        isLocal,
        connected: !!participant,
        // A muted mic, or a push-to-talk mic that is not keyed, is not transmitting: no ring
        speaking:
          !!participant?.isSpeaking &&
          !audioMuted &&
          !(isLocal && this.pushToTalk && !this.transmitting),
        audioMuted,
        cameraTrack: track(Track.Source.Camera),
        cameraShared: (() => {
          const publication = participant?.getTrackPublication(Track.Source.Camera);
          return !!publication && !publication.isMuted;
        })(),
        cameraHidden: !isLocal && this.hiddenCameras.has(id),
        screenTrack: track(Track.Source.ScreenShare),
        screenShared: (() => {
          const publication = participant?.getTrackPublication(Track.Source.ScreenShare);
          return !!publication && !publication.isMuted;
        })(),
        watchingScreen: isLocal || this.watchedStreams.has(id),
        screenWatchers: isLocal ? [...this.streamWatchers] : [],
        screenAudio: !!participant?.getTrackPublication(Track.Source.ScreenShareAudio),
        streamVolume: this.streamVolumes.get(membership.userId) ?? 1,
        handRaised: handsByMembership.has(membership.eventId),
        reaction: this.reactions.get(id) ?? null,
        volume: this.userVolumes.get(membership.userId) ?? 1,
        locallyMuted: this.mutedUsers.has(membership.userId),
        keyMissing: !!participant && this.keyIssues.has(id),
      });
    }
    // Viewers are tracked by participant id; show them by user, once each.
    const userIdById = new Map(result.map((p) => [p.id, p.userId]));
    for (const p of result) {
      if (p.screenWatchers.length) {
        p.screenWatchers = [
          ...new Set(
            p.screenWatchers.map((id) => userIdById.get(id)).filter((u): u is string => !!u)
          ),
        ];
      }
    }
    for (const id of this.absentSince.keys()) {
      if (!seen.has(id)) this.absentSince.delete(id);
    }
    if (absentEndsIn !== Infinity && !this.absentTimer) {
      this.absentTimer = setTimeout(() => {
        this.absentTimer = undefined;
        this.scheduleUpdate();
      }, absentEndsIn + 50);
    }
    if (graceEndsIn !== Infinity && !this.micGraceTimer) {
      this.micGraceTimer = setTimeout(() => {
        this.micGraceTimer = undefined;
        this.scheduleUpdate();
      }, graceEndsIn + 50);
    }
    return result;
  }
}
