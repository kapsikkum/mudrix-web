// Whether the open room's timeline is scrolled to the newest message. Notifications read this so
// a message that arrives while you are scrolled up in the room still makes a sound.
let openRoomId: string | null = null;
let openRoomAtBottom = true;

export function setTimelineAtBottom(roomId: string, atBottom: boolean): void {
  openRoomId = roomId;
  openRoomAtBottom = atBottom;
}

export function clearTimelineAtBottom(roomId: string): void {
  if (openRoomId === roomId) {
    openRoomId = null;
    openRoomAtBottom = true;
  }
}

export function isTimelineAtBottom(roomId: string): boolean {
  return openRoomId !== roomId || openRoomAtBottom;
}
