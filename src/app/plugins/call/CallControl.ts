import type { ClientWidgetApi } from 'matrix-widget-api';
import type { ElementMediaStateDetail, ElementMediaStatePayload } from './types';
import { ElementWidgetActions } from './types';
import { CallControlState } from './CallControlState';

export type CallControlListener = (state: CallControlState) => void;

/**
 * The control API our Element Call fork puts on its window (element-call/src/mudrix/bridge.ts).
 * When EC comes from the upstream npm package instead, it is missing and we fall back to driving
 * EC's own (hidden) footer buttons.
 */
interface MudrixCallBridge {
  toggleScreenShare(): void;
  sendReaction(name: string): Promise<void>;
  toggleRaisedHand(): Promise<void>;
  openSettings(): void;
  setLayout(layout: 'grid' | 'spotlight'): void;
  subscribe(
    listener: (state: { sharingScreen: boolean; layout: 'grid' | 'spotlight' | null }) => void
  ): () => void;
  reactions: readonly { emoji: string; name: string }[];
}

const FOOTER = '[data-testid="footer-container"]';

const SELECTORS = {
  screenshare: `${FOOTER} [data-testid="incall_screenshare"]`,
  settings: `${FOOTER} [data-testid="settings-bottom-left"], ${FOOTER} [data-testid="settings-bottom-center"]`,
  spotlightRadio: `${FOOTER} input[type="radio"][value="spotlight"]`,
  gridRadio: `${FOOTER} input[type="radio"][value="grid"]`,
  reactions: `${FOOTER} [aria-haspopup="true"]:not([data-testid]):not([aria-label])`,
} as const;

const OBSERVE_RETRY_MS = 500;
const OBSERVE_MAX_RETRIES = 20;
const LAYOUT_POLL_MS = 1000;

export class CallControl {
  private state: CallControlState;

  private listeners = new Set<CallControlListener>();

  private observer: MutationObserver | null = null;

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  private observeRetries = 0;

  private observing = false;

  private bridgeUnsubscribe: (() => void) | null = null;

  constructor(
    initial: CallControlState,
    private readonly call: ClientWidgetApi,
    private readonly iframe: HTMLIFrameElement
  ) {
    this.state = initial;
  }

  getState(): CallControlState {
    return this.state;
  }

  onState(listener: CallControlListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async applyState() {
    await this.sendMediaState({
      audio_enabled: this.state.microphone,
      video_enabled: this.state.video,
    });
    this.setSound(this.state.sound);
    this.emit();
  }

  public onMediaState(evt: CustomEvent<ElementMediaStateDetail>) {
    const { data } = evt.detail;
    if (!data) return;

    this.state = new CallControlState(
      data.audio_enabled ?? this.state.microphone,
      data.video_enabled ?? this.state.video,
      this.state.sound,
      this.state.screenshare,
      this.state.spotlight
    );
    this.emit();

    if (this.state.microphone && !this.state.sound) {
      this.toggleSound();
    }
  }

  public toggleMicrophone() {
    const payload: ElementMediaStatePayload = {
      audio_enabled: !this.state.microphone,
      video_enabled: this.state.video,
    };
    return this.sendMediaState(payload);
  }

  public toggleVideo() {
    const payload: ElementMediaStatePayload = {
      audio_enabled: this.state.microphone,
      video_enabled: !this.state.video,
    };
    return this.sendMediaState(payload);
  }

  public toggleSound() {
    const sound = !this.state.sound;
    this.state = new CallControlState(
      this.state.microphone,
      this.state.video,
      sound,
      this.state.screenshare,
      this.state.spotlight
    );
    this.setSound(sound);
    this.emit();

    if (!this.state.sound && this.state.microphone) {
      this.toggleMicrophone();
    }
  }

  public toggleScreenshare() {
    const bridge = this.bridge();
    if (bridge) {
      bridge.toggleScreenShare();
      return true;
    }
    return this.click(SELECTORS.screenshare);
  }

  public setSpotlight(spotlight: boolean) {
    const bridge = this.bridge();
    if (bridge) {
      bridge.setLayout(spotlight ? 'spotlight' : 'grid');
      return true;
    }
    const radio = this.query<HTMLInputElement>(
      spotlight ? SELECTORS.spotlightRadio : SELECTORS.gridRadio
    );
    if (!radio || radio.checked) return false;
    radio.click();
    this.syncFromDom();
    return true;
  }

  public openReactions() {
    return this.click(SELECTORS.reactions);
  }

  /** Every reaction EC knows, when the fork's bridge is there (our own picker shows them all). */
  public getReactions(): readonly { emoji: string; name: string }[] | null {
    return this.bridge()?.reactions ?? null;
  }

  public toggleRaisedHand() {
    const bridge = this.bridge();
    if (!bridge) return false;
    bridge.toggleRaisedHand().catch(() => {});
    return true;
  }

  /**
   * Send one reaction through Element Call's own picker (so EC still sends and plays it): open the
   * hidden footer's popup, press the button with that emoji, and close it again.
   */
  public sendReaction(emoji: string) {
    const bridge = this.bridge();
    if (bridge) {
      const reaction = bridge.reactions.find((r) => r.emoji === emoji || r.name === emoji);
      if (reaction) bridge.sendReaction(reaction.name).catch(() => {});
      return !!reaction;
    }
    const doc = this.getDocument();
    if (!doc || !this.click(SELECTORS.reactions)) return false;
    window.setTimeout(() => {
      const button = Array.from(doc.querySelectorAll<HTMLButtonElement>('button')).find(
        (b) => !b.closest(FOOTER) && b.textContent?.trim() === emoji
      );
      button?.click();
      // Picking a reaction does not always close EC's popup.
      window.setTimeout(() => {
        if (doc.querySelector(`${SELECTORS.reactions}[aria-expanded="true"]`)) {
          this.click(SELECTORS.reactions);
        }
      }, 50);
    }, 60);
    return true;
  }

  public openSettings() {
    const bridge = this.bridge();
    if (bridge) {
      bridge.openSettings();
      return true;
    }
    return this.click(SELECTORS.settings);
  }

  public startObserving() {
    if (this.observing) return;

    const doc = this.getDocument();
    if (!doc) {
      if (this.observeRetries < OBSERVE_MAX_RETRIES) {
        this.observeRetries += 1;
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          this.startObserving();
        }, OBSERVE_RETRY_MS);
      }
      return;
    }

    this.observing = true;
    const sync = () => this.syncFromDom();
    this.observer = new MutationObserver(sync);
    this.observer.observe(doc.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['aria-checked'],
    });
    this.pollTimer = setInterval(sync, LAYOUT_POLL_MS);
    sync();
  }

  public dispose() {
    this.observing = false;
    this.observeRetries = 0;
    this.observer?.disconnect();
    this.observer = null;
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.bridgeUnsubscribe?.();
    this.bridgeUnsubscribe = null;
    this.listeners.clear();
  }

  private bridge(): MudrixCallBridge | null {
    return (
      (this.iframe.contentWindow as (Window & { mudrixCall?: MudrixCallBridge }) | null)
        ?.mudrixCall ?? null
    );
  }

  private getDocument(): Document | null {
    return this.iframe.contentDocument ?? this.iframe.contentWindow?.document ?? null;
  }

  private query<T extends Element>(selector: string): T | null {
    return this.getDocument()?.querySelector<T>(selector) ?? null;
  }

  private click(selector: string): boolean {
    const el = this.query<HTMLElement>(selector);
    if (!el) return false;
    el.click();
    return true;
  }

  private syncFromDom() {
    const bridge = this.bridge();
    if (bridge) {
      if (!this.bridgeUnsubscribe) {
        this.bridgeUnsubscribe = bridge.subscribe(({ sharingScreen, layout }) =>
          this.setShared(sharingScreen, layout ? layout === 'spotlight' : this.state.spotlight)
        );
      }
      return;
    }
    const screenshare =
      this.query<HTMLElement>(SELECTORS.screenshare)?.getAttribute('aria-checked') === 'true';
    const gridRadio = this.query<HTMLInputElement>(SELECTORS.gridRadio);
    const spotlight = gridRadio ? !gridRadio.checked : this.state.spotlight;

    this.setShared(screenshare, spotlight);
  }

  private setShared(screenshare: boolean, spotlight: boolean) {
    if (screenshare === this.state.screenshare && spotlight === this.state.spotlight) return;

    this.state = new CallControlState(
      this.state.microphone,
      this.state.video,
      this.state.sound,
      screenshare,
      spotlight
    );
    this.emit();
  }

  private sendMediaState(payload: ElementMediaStatePayload) {
    return this.call.transport.send(ElementWidgetActions.DeviceMute, payload).catch(() => {});
  }

  private setSound(sound: boolean): void {
    const callDocument = this.iframe.contentDocument ?? this.iframe.contentWindow?.document;
    if (callDocument) {
      callDocument.querySelectorAll('audio').forEach((el) => {
        el.muted = !sound;
      });
    }
  }

  private emit() {
    this.listeners.forEach((listener) => listener(this.state));
  }
}
