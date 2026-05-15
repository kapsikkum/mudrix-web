// Produces a deterministic, filesystem-safe Jitsi conference room name.
export function sanitizeName(roomName: string, roomId: string): string {
  return `Matrix-${roomName}-${roomId}`.replace(/[^a-zA-Z0-9-_]/g, '_');
}

// Dynamically loads the Jitsi External API script if not already present.
export async function loadJitsiApi(domain: string): Promise<void> {
  if (window.JitsiMeetExternalAPI) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://${domain}/external_api.js`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Jitsi API'));
    document.head.appendChild(s);
  });
}
