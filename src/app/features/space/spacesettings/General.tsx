import { SpaceBannerPicker } from '../SpaceBannerPicker';
import { SPACE_BANNER_STATE_TYPE } from '../spaceBanner';
import { SPACE_AUTO_JOIN_STATE_TYPE, setSpaceAutoJoin, useSpaceAutoJoin } from '../spaceAutoJoin';
import { ToggleRow } from '@/app/components/Toggle';
import { SoundboardRoomSettings } from '@/app/features/soundboard/SoundboardRoomSettings';
import {
  SPACE_LIST_STYLE_STATE_TYPE,
  setSpaceListStyle,
  useSpaceListStyle,
} from '../spaceListStyle';
import type { RoomListStyle } from '@/app/store/atoms/settings';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { developerModeAtom } from '@/app/store/atoms';
import { EventType } from 'matrix-js-sdk';

import { getMatrixClientOrNull } from '@/client/initMatrix';
import { CopyButton } from '@/app/components/Button';
import { Select } from '@/app/components/Select';
import { useToast } from '@/app/hooks/useToast';
import { useCanSendState } from '@/app/hooks/useCanSendState';
import { getErrorMessage } from '@/util/error';
import { rootSpaceId } from '@/util/matrix';

import * as css from '@/app/components/Settings/Settings.css';
import {
  useIdentityForm,
  type AccessOption,
} from '@/app/features/room/roomsettings/useIdentityForm';
import { IdentitySection } from '@/app/features/room/roomsettings/IdentitySection';
import { AddressesSection } from '@/app/features/room/roomsettings/AddressesSection';
import { useRoomAliases } from '@/app/features/room/roomsettings/useRoomAliases';

interface GeneralPanelProps {
  spaceId: string;
}

export function GeneralPanel({ spaceId }: GeneralPanelProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const [devModeEnabled] = useAtom(developerModeAtom);
  const toast = useToast();

  const space = client?.getRoom(spaceId) ?? null;

  const can = useCanSendState(space);
  const canSetName = can(EventType.RoomName);
  const canSetTopic = can(EventType.RoomTopic);
  const canSetAvatar = can(EventType.RoomAvatar);
  const canSetJoinRules = can(EventType.RoomJoinRules);
  const autoJoin = useSpaceAutoJoin(client, spaceId);
  const canSetAutoJoin = can(SPACE_AUTO_JOIN_STATE_TYPE);
  const listStyle = useSpaceListStyle(client, spaceId);
  // A space inside another one follows the style of the top space; it is set there.
  const styleInherited = !!client && rootSpaceId(client, spaceId) !== spaceId;
  const canSetListStyle = can(SPACE_LIST_STYLE_STATE_TYPE) && !styleInherited;
  const handleListStyle = async (style: RoomListStyle) => {
    if (!client) return;
    try {
      await setSpaceListStyle(client, spaceId, style);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };
  const handleAutoJoin = async (enabled: boolean) => {
    if (!client) return;
    try {
      await setSpaceAutoJoin(client, spaceId, enabled);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const canSetCanonical = can('m.room.canonical_alias');
  const { canonicalAlias, allAliases, handleAddAlias, handleRemoveAlias, handleSetCanonical } =
    useRoomAliases(space, spaceId, canSetCanonical);

  const form = useIdentityForm({
    client,
    room: space,
    roomId: spaceId,
    restrictedAllowRoomId: spaceId,
  });
  const { access, setAccess } = form;

  return (
    <div>
      <h2 className={css.panelTitle}>{t('room.settings.general.title')}</h2>

      <div className={css.section}>
        <SpaceBannerPicker
          client={client}
          spaceId={spaceId}
          canEdit={can(SPACE_BANNER_STATE_TYPE)}
        />
      </div>

      <div className={css.section}>
        <div className={css.settingRow}>
          <div className={css.settingInfo}>
            <span className={css.settingLabel}>{t('settings.appearance.roomListStyle')}</span>
            <span className={css.settingNote}>{t('settings.appearance.roomListStyleNote')}</span>
          </div>
          <Select<RoomListStyle>
            aria-label={t('settings.appearance.roomListStyle')}
            value={listStyle}
            options={[
              { value: 'matrix', label: t('settings.appearance.roomListStyleMatrix') },
              { value: 'modern', label: t('settings.appearance.roomListStyleModern') },
            ]}
            onChange={handleListStyle}
            disabled={!canSetListStyle}
          />
        </div>
        <ToggleRow
          label={t('room.settings.general.autoJoin')}
          description={t('room.settings.general.autoJoinNote')}
          checked={autoJoin}
          onChange={handleAutoJoin}
          disabled={!canSetAutoJoin}
        />
      </div>

      <SoundboardRoomSettings roomId={spaceId} />

      <IdentitySection
        form={form}
        client={client}
        roomName={space?.name ?? ''}
        nameLabel={t('room.space.name')}
        namePlaceholder={t('room.space.namePlaceholder')}
        canSetName={canSetName}
        canSetTopic={canSetTopic}
        canSetAvatar={canSetAvatar}
        canSetJoinRules={canSetJoinRules}
      />

      <div className={css.divider} />

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('room.settings.security.title')}</h3>

        <div className={css.settingRow}>
          <div className={css.settingInfo}>
            <span className={css.settingLabel}>{t('room.settings.security.access')}</span>
          </div>
          <Select
            aria-label={t('room.settings.security.access')}
            value={access}
            disabled={!canSetJoinRules}
            options={[
              { value: 'invite', label: t('room.settings.security.accessInviteSpace') },
              { value: 'knock', label: t('room.settings.security.accessKnock') },
              { value: 'public', label: t('room.settings.security.accessPublic') },
            ]}
            onChange={(v) => setAccess(v as AccessOption)}
          />
        </div>
      </div>

      {devModeEnabled && (
        <>
          <div className={css.divider} />

          <div className={css.section}>
            <h3 className={css.sectionTitle}>{t('room.space.settings.general.spaceId')}</h3>
            <div className={css.tokenRow}>
              <code className={css.tokenField}>{spaceId}</code>
              <CopyButton text={spaceId} />
            </div>
          </div>
        </>
      )}

      <div className={css.divider} />

      <AddressesSection
        client={client}
        canonicalAlias={canonicalAlias}
        aliases={allAliases}
        canEdit={canSetCanonical}
        onAdd={handleAddAlias}
        onRemove={handleRemoveAlias}
        onSetCanonical={handleSetCanonical}
      />
    </div>
  );
}
