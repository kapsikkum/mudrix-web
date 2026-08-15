import type { CallEmbed } from './CallEmbed';

const LEAVE_GRACE_MS = 10_000;
const leaving = new Set<CallEmbed>();

export function disposeAfterLeave(embed: CallEmbed): void {
  if (leaving.has(embed)) return;
  leaving.add(embed);

  let fallback: ReturnType<typeof setTimeout> | null = null;

  const handleClose = () => finish();
  const finish = () => {
    if (!leaving.has(embed)) return;
    leaving.delete(embed);
    embed.call.off(`action:io.element.close`, handleClose);
    if (fallback) clearTimeout(fallback);
    embed.dispose();
  };

  embed.call.on(`action:io.element.close`, handleClose);
  fallback = setTimeout(finish, LEAVE_GRACE_MS);
}
