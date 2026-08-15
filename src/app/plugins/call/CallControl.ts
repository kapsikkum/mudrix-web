import type { ClientWidgetApi } from 'matrix-widget-api';
import type { ElementMediaStateDetail, ElementMediaStatePayload } from './types';
import { ElementWidgetActions } from './types';
import { CallControlState } from './CallControlState';

export type CallControlListener = (state: CallControlState) => void;

export class CallControl {
  private state: CallControlState;

  private listeners = new Set<CallControlListener>();

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
      this.state.sound
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
    this.state = new CallControlState(this.state.microphone, this.state.video, sound);
    this.setSound(sound);
    this.emit();

    if (!this.state.sound && this.state.microphone) {
      this.toggleMicrophone();
    }
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

  public dispose() {
    this.listeners.clear();
  }

  private emit() {
    this.listeners.forEach((listener) => listener(this.state));
  }
}
