import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventType, JoinRule, RestrictedAllowType } from 'matrix-js-sdk';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { useConfirm } from '@/app/hooks/useConfirm';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { getStateEventContent, joinRuleToAccess } from '@/util/matrix';

export type AccessOption = 'invite' | 'restricted' | 'public' | 'knock';

interface Options {
  client: MatrixClient | null;
  room: Room | null;
  roomId: string;
  /** The room a "restricted" join rule lets the members of in; with none, no `allow` is sent. */
  restrictedAllowRoomId: string | null;
  /** Also resets the form when this changes (the room page passes its history setting). */
  resetKey?: unknown;
  /** Runs with every reset, for state the caller keeps next to the form. */
  onReset?: () => void;
}

/**
 * The name, topic, avatar and join rule of a room or space as one form: the edited values, the
 * current ones from state, and the handlers that pick, remove and save them.
 */
export function useIdentityForm({
  client,
  room,
  roomId,
  restrictedAllowRoomId,
  resetKey,
  onReset,
}: Options) {
  const { t } = useTranslation();
  const confirmDialog = useConfirm();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const nameContent = getStateEventContent(room, 'm.room.name');
  const topicContent = getStateEventContent(room, 'm.room.topic');
  const joinRulesContent = getStateEventContent(room, EventType.RoomJoinRules);
  const currentName: string = (nameContent?.name as string | undefined) ?? room?.name ?? '';
  const currentTopic: string = (topicContent?.topic as string | undefined) ?? '';
  const currentAvatarMxc: string | null = room?.getMxcAvatarUrl?.() ?? null;
  const currentJoinRule: string =
    (joinRulesContent?.join_rule as string | undefined) ?? JoinRule.Invite;

  const [name, setName] = useState(currentName);
  const [topic, setTopic] = useState(currentTopic);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessOption>(
    joinRuleToAccess(currentJoinRule) as AccessOption
  );
  const [saving, setSaving] = useState(false);

  const isDirty =
    name !== currentName ||
    topic !== currentTopic ||
    avatarFile !== null ||
    access !== joinRuleToAccess(currentJoinRule);

  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;
  useEffect(() => {
    setName(currentName);
    setTopic(currentTopic);
    setAccess(joinRuleToAccess(currentJoinRule) as AccessOption);
    onResetRef.current?.();
    setAvatarFile(null);
    setAvatarPreview(null);
  }, [roomId, currentName, currentTopic, currentJoinRule, resetKey]);

  useEffect(() => {
    if (!avatarPreview) return undefined;
    return () => URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleRemoveAvatar = async () => {
    const ok = await confirmDialog({
      title: t('common.removeAvatar'),
      message: t('common.removeAvatarConfirm'),
      danger: true,
    });
    if (!ok || !client) return;
    try {
      await client.sendStateEvent(roomId, EventType.RoomAvatar, { url: '' }, '');
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (err) {
      toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
    }
  };

  const handleSave = async () => {
    if (!client || !room) return;
    setSaving(true);
    try {
      const ops: Promise<unknown>[] = [];
      if (avatarFile) {
        const { content_uri: mxcUrl } = await client.uploadContent(avatarFile, {
          name: avatarFile.name,
        });
        ops.push(client.sendStateEvent(roomId, EventType.RoomAvatar, { url: mxcUrl }, ''));
      }
      if (name.trim() !== currentName)
        ops.push(client.sendStateEvent(roomId, EventType.RoomName, { name: name.trim() }, ''));
      if (topic !== currentTopic)
        ops.push(client.sendStateEvent(roomId, EventType.RoomTopic, { topic }, ''));

      const targetJoinRule =
        access === 'public'
          ? JoinRule.Public
          : access === 'restricted'
            ? JoinRule.Restricted
            : access === 'knock'
              ? JoinRule.Knock
              : JoinRule.Invite;
      if (targetJoinRule !== currentJoinRule) {
        const joinRuleContent: {
          join_rule: JoinRule;
          allow?: { type: RestrictedAllowType; room_id: string }[];
        } = {
          join_rule: targetJoinRule,
        };
        if (access === 'restricted' && restrictedAllowRoomId) {
          joinRuleContent.allow = [
            { type: RestrictedAllowType.RoomMembership, room_id: restrictedAllowRoomId },
          ];
        }
        ops.push(client.sendStateEvent(roomId, EventType.RoomJoinRules, joinRuleContent, ''));
      }

      await Promise.all(ops);
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (err) {
      toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
    } finally {
      setSaving(false);
    }
  };

  return {
    fileRef,
    currentAvatarMxc,
    name,
    setName,
    topic,
    setTopic,
    avatarPreview,
    lightboxSrc,
    setLightboxSrc,
    access,
    setAccess,
    saving,
    isDirty,
    handleAvatarSelect,
    handleRemoveAvatar,
    handleSave,
  };
}

export type IdentityForm = ReturnType<typeof useIdentityForm>;
