export class CallControlState {
  constructor(
    public microphone = true,
    public video = false,
    public sound = true,
    public screenshare = false,
    public spotlight = true
  ) {}
}
