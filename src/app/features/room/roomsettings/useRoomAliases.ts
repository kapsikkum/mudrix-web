import { useCallback } from 'react';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { roomStateMaybe } from '@/util/matrix';
import type { UntypedStateEventType } from '@/types/matrix';

export function useRoomAliases(room: Room | null, roomId: string, canSetCanonical = true) {
  const canonicalEvent = roomStateMaybe(room)?.getStateEvents('m.room.canonical_alias', '');
  const canonicalEventContent = canonicalEvent?.getContent() ?? {};
  const canonicalAlias: string | null = (canonicalEventContent.alias as string | undefined) ?? null;
  const altAliases: string[] = (canonicalEventContent.alt_aliases as string[] | undefined) ?? [];

  const aliasEvents = roomStateMaybe(room)?.getStateEvents('m.room.aliases');
  const legacyAliases: string[] = [];
  if (aliasEvents) {
    const events = Array.isArray(aliasEvents) ? aliasEvents : [aliasEvents];
    for (const ev of events) {
      const list = ev.getContent()?.aliases as string[] | undefined;
      if (list) legacyAliases.push(...list);
    }
  }

  const allAliases: string[] = [
    ...new Set([...altAliases, ...legacyAliases].filter((a) => a !== canonicalAlias)),
  ];

  const handleAddAlias = useCallback(
    async (c: MatrixClient, alias: string) => {
      await c.createAlias(alias, roomId);
      if (!canSetCanonical) return;
      const currentContent =
        roomStateMaybe(room)?.getStateEvents('m.room.canonical_alias', '')?.getContent() ?? {};
      const currentAlt: string[] = (currentContent.alt_aliases as string[] | undefined) ?? [];
      const currentCanonical = (currentContent.alias as string | undefined) ?? '';
      if (!currentAlt.includes(alias) && currentCanonical !== alias) {
        await c.sendStateEvent(
          roomId,
          'm.room.canonical_alias' as UntypedStateEventType,
          { ...currentContent, alt_aliases: [...currentAlt, alias] },
          ''
        );
      }
    },
    [room, roomId, canSetCanonical]
  );

  const handleRemoveAlias = useCallback(
    async (c: MatrixClient, alias: string) => {
      await c.deleteAlias(alias);
      if (!canSetCanonical) return;
      const currentContent =
        roomStateMaybe(room)?.getStateEvents('m.room.canonical_alias', '')?.getContent() ?? {};
      const currentAlt: string[] = (currentContent.alt_aliases as string[] | undefined) ?? [];
      const currentCanonical: string | undefined = currentContent.alias as string | undefined;
      if (currentCanonical === alias || currentAlt.includes(alias)) {
        await c.sendStateEvent(
          roomId,
          'm.room.canonical_alias' as UntypedStateEventType,
          {
            ...currentContent,
            alias: currentCanonical === alias ? '' : currentCanonical,
            alt_aliases: currentAlt.filter((a) => a !== alias),
          },
          ''
        );
      }
    },
    [room, roomId, canSetCanonical]
  );

  const handleSetCanonical = useCallback(
    async (c: MatrixClient, alias: string) => {
      const currentContent =
        roomStateMaybe(room)?.getStateEvents('m.room.canonical_alias', '')?.getContent() ?? {};
      const currentCanonical: string | undefined = currentContent.alias as string | undefined;
      const currentAlt: string[] = (currentContent.alt_aliases as string[] | undefined) ?? [];
      const newAlt = [
        ...new Set([
          ...(currentCanonical && currentCanonical !== alias ? [currentCanonical] : []),
          ...currentAlt.filter((a) => a !== alias),
        ]),
      ];
      await c.sendStateEvent(
        roomId,
        'm.room.canonical_alias' as UntypedStateEventType,
        { ...currentContent, alias, alt_aliases: newAlt },
        ''
      );
    },
    [room, roomId]
  );

  return {
    canonicalAlias,
    allAliases,
    handleAddAlias,
    handleRemoveAlias,
    handleSetCanonical,
  };
}
