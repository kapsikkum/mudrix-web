import type { MatrixClient } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { markdownToHtml } from '@/util/markdownToHtml';

export interface CommandContext {
  client: MatrixClient;
  roomId: string;
  navigate: (path: string) => void;
  t: (key: string, opts?: Record<string, string>) => string;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
  placeCall?: (roomId: string) => Promise<void> | void;
  joinVoice?: (roomId: string) => Promise<void> | void;
  hangup?: () => void;
  elementCallActive: boolean;
}

export interface CommandDefinition {
  command: string;
  aliases: string[];
  description: (t: (key: string) => string) => string;
  usage: string;
  fn: (args: string, ctx: CommandContext) => Promise<void>;
}

type CommandHandler = (args: string, ctx: CommandContext) => Promise<void>;

async function resolveTargetRoomId(ctx: CommandContext, args: string): Promise<string> {
  const alias = args.trim();
  if (!alias) return ctx.roomId;
  try {
    const res = await ctx.client.getRoomIdForAlias(alias);
    return res.room_id;
  } catch {
    throw new Error(ctx.t('timeline.commands.roomNotFound', { alias }));
  }
}

function resolveUserId(
  client: MatrixClient,
  roomId: string,
  raw: string
): { userId: string; displayName: string } {
  const stripped = raw.startsWith('@') ? raw.slice(1) : raw;

  const room = client.getRoom(roomId);
  if (room) {
    const members = room.getMembers();
    for (const m of members) {
      const displayName = m.name ?? m.userId;
      if (displayName === stripped || m.userId === raw || m.userId === `@${stripped}`) {
        return { userId: m.userId, displayName };
      }
    }
  }

  return { userId: `@${stripped}`, displayName: stripped };
}

const handleMe: CommandHandler = async (args, { client, roomId }) => {
  if (!args.trim()) throw new Error('Usage: /me <message>');
  const content: Record<string, unknown> = {
    msgtype: 'm.emote',
    body: args,
    format: 'org.matrix.custom.html',
    formatted_body: markdownToHtml(args, undefined, false),
  };
  await client.sendMessage(roomId, content as unknown as RoomMessageEventContent);
};

const handleNotice: CommandHandler = async (args, { client, roomId }) => {
  if (!args.trim()) throw new Error('Usage: /notice <message>');
  const content: Record<string, unknown> = {
    msgtype: 'm.notice',
    body: args,
    format: 'org.matrix.custom.html',
    formatted_body: markdownToHtml(args, undefined, false),
  };
  await client.sendMessage(roomId, content as unknown as RoomMessageEventContent);
};

const handleJoin: CommandHandler = async (args, ctx) => {
  const trimmed = args.trim();
  const voiceMatch = trimmed.match(/^voice(?:\s+(.*))?$/i);
  if (voiceMatch) {
    await handleJoinVoice(voiceMatch[1] ?? '', ctx);
    return;
  }
  const alias = trimmed;
  if (!alias) throw new Error('Usage: /join <room_alias>');
  await ctx.client.joinRoom(alias);
  ctx.toast.success(ctx.t('timeline.commands.join.joined', { alias }));
};

const handleJoinVoice: CommandHandler = async (args, ctx) => {
  if (!ctx.joinVoice) throw new Error(ctx.t('timeline.commands.callUnavailable'));
  const targetRoomId = await resolveTargetRoomId(ctx, args);
  await ctx.joinVoice(targetRoomId);
};

const handleCall: CommandHandler = async (args, ctx) => {
  if (ctx.elementCallActive) throw new Error(ctx.t('voice.toastAlreadyInCall'));
  if (!ctx.placeCall) throw new Error(ctx.t('timeline.commands.callUnavailable'));
  const targetRoomId = await resolveTargetRoomId(ctx, args);
  await ctx.placeCall(targetRoomId);
};

const handleHangup: CommandHandler = async (_args, ctx) => {
  if (ctx.elementCallActive) {
    ctx.hangup?.();
    return;
  }
  throw new Error(ctx.t('voice.noActiveCall'));
};

const handlePart: CommandHandler = async (_args, { client, roomId, navigate }) => {
  await client.leave(roomId);
  navigate('/');
};

const handleKick: CommandHandler = async (args, { client, roomId }) => {
  const parts = args.trim().split(/\s+/);
  if (!parts[0]) throw new Error('Usage: /kick <user> [reason]');
  const { userId } = resolveUserId(client, roomId, parts[0]);
  const reason = parts.slice(1).join(' ') || undefined;
  await client.kick(roomId, userId, reason);
};

const handleBan: CommandHandler = async (args, { client, roomId }) => {
  const parts = args.trim().split(/\s+/);
  if (!parts[0]) throw new Error('Usage: /ban <user> [reason]');
  const { userId } = resolveUserId(client, roomId, parts[0]);
  const reason = parts.slice(1).join(' ') || undefined;
  await client.ban(roomId, userId, reason);
};

const handleUnban: CommandHandler = async (args, { client, roomId }) => {
  const raw = args.trim();
  if (!raw) throw new Error('Usage: /unban <user>');
  const { userId } = resolveUserId(client, roomId, raw);
  await client.unban(roomId, userId);
};

const handleInvite: CommandHandler = async (args, { client, roomId }) => {
  const raw = args.trim();
  if (!raw) throw new Error('Usage: /invite <user>');
  const { userId } = resolveUserId(client, roomId, raw);
  await client.invite(roomId, userId);
};

const handleTopic: CommandHandler = async (args, { client, roomId }) => {
  const topic = args.trim();
  if (!topic) throw new Error('Usage: /topic <new_topic>');
  await client.sendStateEvent(roomId, EventType.RoomTopic, { topic }, '');
};

const handleRoomName: CommandHandler = async (args, { client, roomId }) => {
  const name = args.trim();
  if (!name) throw new Error('Usage: /roomname <new_name>');
  await client.sendStateEvent(roomId, EventType.RoomName, { name }, '');
};

const handleNick: CommandHandler = async (args, { client }) => {
  const name = args.trim();
  if (!name) throw new Error('Usage: /nick <display_name>');
  await client.setDisplayName(name);
};

const handleSpoiler: CommandHandler = async (args, { client, roomId }) => {
  if (!args.trim()) throw new Error('Usage: /spoiler ["reason"] <message>');
  let reason = '';
  let body = args;
  const reasonMatch = args.match(/^"(.+?)"\s+(.*)/s);
  if (reasonMatch) {
    reason = reasonMatch[1];
    body = reasonMatch[2];
  }
  const html = markdownToHtml(body, undefined, false);
  const escapedReason = reason.replace(/"/g, '&quot;');
  const wrapped = reason
    ? `<span data-mx-spoiler="${escapedReason}">${html}</span>`
    : `<span data-mx-spoiler>${html}</span>`;
  const content: Record<string, unknown> = {
    msgtype: 'm.text',
    body,
    format: 'org.matrix.custom.html',
    formatted_body: wrapped,
  };
  await client.sendMessage(roomId, content as unknown as RoomMessageEventContent);
};

export const COMMANDS: CommandDefinition[] = [
  {
    command: 'me',
    aliases: [],
    description: (t) => t('timeline.commands.me.description'),
    usage: '/me <message>',
    fn: handleMe,
  },
  {
    command: 'notice',
    aliases: [],
    description: (t) => t('timeline.commands.notice.description'),
    usage: '/notice <message>',
    fn: handleNotice,
  },
  {
    command: 'join',
    aliases: [],
    description: (t) => t('timeline.commands.join.description'),
    usage: '/join <room_alias>',
    fn: handleJoin,
  },
  {
    command: 'join-voice',
    aliases: [],
    description: (t) => t('timeline.commands.joinVoice.description'),
    usage: '/join-voice [room]',
    fn: handleJoinVoice,
  },
  {
    command: 'call',
    aliases: [],
    description: (t) => t('timeline.commands.call.description'),
    usage: '/call [room]',
    fn: handleCall,
  },
  {
    command: 'hangup',
    aliases: [],
    description: (t) => t('timeline.commands.hangup.description'),
    usage: '/hangup',
    fn: handleHangup,
  },
  {
    command: 'part',
    aliases: ['leave'],
    description: (t) => t('timeline.commands.part.description'),
    usage: '/part',
    fn: handlePart,
  },
  {
    command: 'kick',
    aliases: [],
    description: (t) => t('timeline.commands.kick.description'),
    usage: '/kick <user> [reason]',
    fn: handleKick,
  },
  {
    command: 'ban',
    aliases: [],
    description: (t) => t('timeline.commands.ban.description'),
    usage: '/ban <user> [reason]',
    fn: handleBan,
  },
  {
    command: 'unban',
    aliases: [],
    description: (t) => t('timeline.commands.unban.description'),
    usage: '/unban <user>',
    fn: handleUnban,
  },
  {
    command: 'invite',
    aliases: [],
    description: (t) => t('timeline.commands.invite.description'),
    usage: '/invite <user>',
    fn: handleInvite,
  },
  {
    command: 'topic',
    aliases: [],
    description: (t) => t('timeline.commands.topic.description'),
    usage: '/topic <new_topic>',
    fn: handleTopic,
  },
  {
    command: 'roomname',
    aliases: [],
    description: (t) => t('timeline.commands.roomname.description'),
    usage: '/roomname <new_name>',
    fn: handleRoomName,
  },
  {
    command: 'nick',
    aliases: [],
    description: (t) => t('timeline.commands.nick.description'),
    usage: '/nick <display_name>',
    fn: handleNick,
  },
  {
    command: 'spoiler',
    aliases: ['cw', 'content-warning'],
    description: (t) => t('timeline.commands.spoiler.description'),
    usage: '/spoiler ["reason"] <message>',
    fn: handleSpoiler,
  },
];

const ALL_COMMANDS = new Map<string, CommandDefinition>();
for (const cmd of COMMANDS) {
  ALL_COMMANDS.set(cmd.command, cmd);
  for (const alias of cmd.aliases) {
    ALL_COMMANDS.set(alias, cmd);
  }
}

export function parseCommand(text: string): { command: string; args: string } | null {
  const match = text.match(/^\/([\w-]+)(?:\s+(.*))?$/s);
  if (!match) return null;
  return { command: match[1].toLowerCase(), args: match[2] ?? '' };
}

export function getCommandDefinition(command: string): CommandDefinition | undefined {
  return ALL_COMMANDS.get(command);
}

export function getCommandSuggestions(query: string): CommandDefinition[] {
  const q = query.toLowerCase();
  return COMMANDS.filter(
    (cmd) => cmd.command.startsWith(q) || cmd.aliases.some((a) => a.startsWith(q))
  );
}
