import { useState } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { createRoomOpenAtom, currentRoomIdAtom } from '@/app/store/atoms';
import { EventType, Preset } from 'matrix-js-sdk';
import type { ICreateRoomStateEvent } from 'matrix-js-sdk/lib/@types/requests';
import { getMatrixClient, normalizeUrl } from '@/client/initMatrix';
import type { UntypedStateEventType, RawStateContent } from '@/types/matrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import {
  HashIcon,
  UsersThreeIcon,
  LockSimpleIcon,
  GlobeHemisphereWestIcon,
  CaretDownIcon,
} from '@phosphor-icons/react';
import { Modal } from '@/app/components/Modal';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { ToggleRow } from '@/app/components/Toggle';
import * as css from './CreateRoomModal.css';

type AccessOption = 'space' | 'invite' | 'public';

export function CreateRoomModal() {
  const { t } = useTranslation();
  const [state, setState] = useAtom(createRoomOpenAtom);
  const [, setCurrentRoomId] = useAtom(currentRoomIdAtom);
  const toast = useToast();

  const open = state.open;
  const spaceId = state.spaceId ?? null;

  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [encrypted, setEncrypted] = useState(true);
  const [voiceRoom, setVoiceRoom] = useState(false);
  const [jitsiServer, setJitsiServer] = useState('');
  const [roomAlias, setRoomAlias] = useState('');
  const [loading, setLoading] = useState(false);
  // Default to 'space' when opened from inside a space, otherwise 'invite'
  const [access, setAccess] = useState<AccessOption>(spaceId ? 'space' : 'invite');

  const close = () => {
    setState({ open: false });
    setName('');
    setTopic('');
    setEncrypted(true);
    setVoiceRoom(false);
    setJitsiServer('');
    setRoomAlias('');
    setAccess('invite');
  };

  const handleAccessChange = (opt: AccessOption) => {
    setAccess(opt);
    // Public rooms cannot be encrypted
    if (opt === 'public') setEncrypted(false);
    else setEncrypted(true);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error(t('room.create.nameRequired'));
      return;
    }

    setLoading(true);
    try {
      const client = getMatrixClient();

      if (spaceId) {
        const spaceRoom = client.getRoom(spaceId);
        const myId = client.getUserId() ?? '';
        if (spaceRoom && !spaceRoom.currentState.maySendStateEvent('m.space.child', myId)) {
          toast.error(t('room.create.insufficientSpacePermission'));
          setLoading(false);
          return;
        }
      }

      // Validate Jitsi domain before creating the room
      let jitsiDomain: string | null = null;
      if (voiceRoom) {
        try {
          jitsiDomain = new URL(normalizeUrl(jitsiServer)).hostname;
        } catch {
          jitsiDomain = null;
        }
        if (!jitsiDomain) {
          toast.error(t('room.create.jitsiServerRequired'));
          setLoading(false);
          return;
        }
      }

      // Build initial_state
      const initial_state: ICreateRoomStateEvent[] = [];

      if (encrypted && access !== 'public') {
        initial_state.push({
          type: 'm.room.encryption',
          content: { algorithm: 'm.megolm.v1.aes-sha2' },
          state_key: '',
        });
      }

      // join_rule: 'restricted' for space-only, 'invite' for private, 'public' for public
      if (access === 'space' && spaceId) {
        initial_state.push({
          type: 'm.room.join_rules',
          state_key: '',
          content: {
            join_rule: 'restricted',
            allow: [{ type: 'm.room_membership', room_id: spaceId }],
          },
        });
      } else if (access === 'invite') {
        initial_state.push({
          type: 'm.room.join_rules',
          state_key: '',
          content: { join_rule: 'invite' },
        });
      }
      // 'public' uses the preset below — no explicit join_rules state event needed

      const opts: Parameters<typeof client.createRoom>[0] = {
        name: name.trim(),
        topic: topic.trim() || undefined,
        // 'public_chat' preset makes the room public + world-readable
        preset: access === 'public' ? Preset.PublicChat : Preset.PrivateChat,
        initial_state,
      };

      const { room_id: roomId } = await client.createRoom(opts);

      // Create room alias if a public room with an address
      const aliasToSet = roomAlias.trim();
      if (access === 'public' && aliasToSet) {
        try {
          await client.createAlias(aliasToSet, roomId);
          await client.sendStateEvent(
            roomId,
            'm.room.canonical_alias' as UntypedStateEventType,
            { alias: aliasToSet },
            ''
          );
        } catch (aliasErr) {
          toast.error(t('room.create.aliasCreateFailed', { error: getErrorMessage(aliasErr) }));
        }
      }

      // Add the room as a child of the space (always, regardless of access option)
      if (spaceId && roomId) {
        const domain = client.getDomain() ?? '';
        await client.sendStateEvent(spaceId, EventType.SpaceChild, { via: [domain] }, roomId);
        // Also set the parent on the room side so the room knows it belongs to the space
        await client.sendStateEvent(
          roomId,
          EventType.SpaceParent,
          { via: [domain], canonical: true },
          spaceId
        );
      }

      // Voice room widget
      if (voiceRoom && roomId && jitsiDomain) {
        const widgetId = `jitsi_${Date.now()}`;
        const sanitizedRoomName = `Matrix-${name.trim()}-${roomId}`.replace(/[^a-zA-Z0-9-_]/g, '_');
        const url = `https://${jitsiDomain}/${sanitizedRoomName}`;
        // m.room.widget is not in the SDK's StateEvents map; cast to raw state types.
        await client.sendStateEvent(
          roomId,
          'm.room.widget' as UntypedStateEventType,
          {
            type: 'jitsi-voice-channel',
            url,
            name: 'Meeting Room',
            data: { jitsiDomain, confId: sanitizedRoomName, isAudioOnly: true },
            creatorUserId: client.getUserId(),
          } as RawStateContent,
          widgetId
        );
      }

      if (roomId) {
        setCurrentRoomId(roomId);
        toast.success(t('room.create.success', { name: name.trim() }));
      }
      close();
    } catch (err) {
      toast.error(t('room.create.failed', { error: getErrorMessage(err) }));
    } finally {
      setLoading(false);
    }
  };

  const accessOptions: { id: AccessOption; label: string }[] = spaceId
    ? [
        { id: 'space', label: t('room.create.accessStandard') },
        { id: 'invite', label: t('room.create.accessInvite') },
        { id: 'public', label: t('room.create.accessPublic') },
      ]
    : [
        { id: 'invite', label: t('room.create.accessInvite') },
        { id: 'public', label: t('room.create.accessPublic') },
      ];

  const accessIcon: Record<AccessOption, React.ReactNode> = {
    space: <UsersThreeIcon size={16} />,
    invite: <LockSimpleIcon size={16} />,
    public: <GlobeHemisphereWestIcon size={16} />,
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="md"
      title={t('room.create.title')}
      titleIcon={<HashIcon size={18} />}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" loading={loading} onClick={handleCreate}>
            {t('room.create.titleShort')}
          </Button>
        </>
      }
    >
      <Input
        label={t('room.name')}
        placeholder={t('room.namePlaceholder')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        maxLength={255}
      />

      <Input
        label={`${t('room.topic')} (${t('common.optional')})`}
        placeholder={t('room.topicPlaceholder')}
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
      />

      <span className={css.sectionLabel}>{t('room.create.access')}</span>

      <div className={css.accessSelect}>
        <span className={css.accessSelectIcon}>{accessIcon[access]}</span>
        <span className={css.accessSelectLabel}>
          {accessOptions.find((o) => o.id === access)?.label}
        </span>
        <span className={css.accessSelectChevron}>
          <CaretDownIcon size={14} />
        </span>
        <select
          className={css.accessSelectNative}
          value={access}
          onChange={(e) => handleAccessChange(e.target.value as AccessOption)}
        >
          {accessOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Room address — only for public rooms */}
      {access === 'public' && (
        <Input
          label={t('room.create.roomAddress')}
          placeholder={t('room.create.roomAddressPlaceholder')}
          value={roomAlias}
          onChange={(e) => setRoomAlias(e.target.value)}
        />
      )}

      {/* Encryption — hidden for public rooms */}
      {access !== 'public' && (
        <ToggleRow
          label={t('room.create.e2ee')}
          description={t('room.create.e2eeNote')}
          checked={encrypted}
          onChange={setEncrypted}
          size="sm"
        />
      )}

      <ToggleRow
        label={t('room.create.voiceRoom')}
        description={t('room.create.voiceRoomNote')}
        checked={voiceRoom}
        onChange={setVoiceRoom}
        size="sm"
      />

      {voiceRoom && (
        <Input
          label={t('room.create.jitsiServer')}
          placeholder="meet.example.com"
          value={jitsiServer}
          onChange={(e) => setJitsiServer(e.target.value)}
        />
      )}
    </Modal>
  );
}
