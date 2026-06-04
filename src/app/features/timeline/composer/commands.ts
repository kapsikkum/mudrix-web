import type { MatrixClient } from 'matrix-js-sdk';
import { EventType } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { markdownToHtml } from '@/util/markdownToHtml';

export interface CommandContext {
  client: MatrixClient;
  roomId: string;
  t: (key: string, opts?: Record<string, string>) => string;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export interface CommandDefinition {
  command: string;
  aliases: string[];
  description: (t: (key: string) => string) => string;
  usage: string;
  fn: (args: string, ctx: CommandContext) => Promise<void>;
}

type CommandHandler = (args: string, ctx: CommandContext) => Promise<void>;

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

const handleJoin: CommandHandler = async (args, { client, toast }) => {
  const alias = args.trim();
  if (!alias) throw new Error('Usage: /join <room_alias>');
  await client.joinRoom(alias);
  toast.success(`Joined room ${alias}`);
};

const handlePart: CommandHandler = async (_args, { client, roomId }) => {
  await client.leave(roomId);
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
];

const ALL_COMMANDS = new Map<string, CommandDefinition>();
for (const cmd of COMMANDS) {
  ALL_COMMANDS.set(cmd.command, cmd);
  for (const alias of cmd.aliases) {
    ALL_COMMANDS.set(alias, cmd);
  }
}

export function parseCommand(text: string): { command: string; args: string } | null {
  const match = text.match(/^\/(\w+)(?:\s+(.*))?$/s);
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
