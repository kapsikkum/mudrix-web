import type { CallEmbed } from './CallEmbed';

const LEAVE_TIMEOUT_MS = 1_000;

export function leaveCallEmbed(embed: CallEmbed, timeoutMs = LEAVE_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      embed.call.off(`action:io.element.close`, handleClose);
      clearTimeout(timer);
      embed.dispose();
      resolve();
    };
    const handleClose = () => finish();
    const timer = setTimeout(finish, timeoutMs);

    embed.call.on(`action:io.element.close`, handleClose);
    void embed.hangup().catch(() => {});
  });
}
