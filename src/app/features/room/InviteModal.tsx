import { useState, useCallback, useEffect } from 'react';
import { useAtom } from 'jotai';
import { vars } from '@/theme/vars.css';
import { useTranslation } from 'react-i18next';
import { inviteModalRoomIdAtom } from '@/app/store/atoms';
import { getMatrixClient, getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { formatUserId } from '@/util/matrix';
import { Modal } from '@/app/components/Modal';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { useInviteAutocomplete, trackRecentInvite } from './useInviteAutocomplete';
import { InviteAutocompleteDropdown } from './InviteAutocompleteDropdown';
import type { UserSuggestion } from './useInviteAutocomplete';

export function InviteModal() {
  const { t } = useTranslation();
  const [state, setState] = useAtom(inviteModalRoomIdAtom);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const client = getMatrixClientOrNull();

  const autocomplete = useInviteAutocomplete(client!);
  const { open: openAutocomplete } = autocomplete;

  const isOpen = !!state;

  // Pre-populate with recent/DM users whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      openAutocomplete();
    }
  }, [isOpen, openAutocomplete]);

  const close = useCallback(() => {
    setState(null);
    setUserId('');
    autocomplete.close();
  }, [setState, autocomplete]);

  const handleInvite = useCallback(
    async (targetUserId?: string) => {
      const id = (targetUserId ?? userId).trim();
      if (!id) {
        toast.error(t('invite.pleaseEnterUserId'));
        return;
      }
      if (!state || !client) return;

      setLoading(true);
      try {
        const mx = getMatrixClient();

        await mx.invite(state.roomId, id);

        // Track for future recent suggestions
        const user = mx.getUser(id);
        const displayName = user?.displayName ?? formatUserId(id);
        const avatarMxc = user?.avatarUrl ?? null;
        trackRecentInvite(id, displayName, avatarMxc);

        if (state.isSpace) {
          const spaceRoom = mx.getRoom(state.roomId);
          const childEvents = spaceRoom?.currentState.getStateEvents('m.space.child') ?? [];

          const publicChildRoomIds: string[] = [];
          for (const ev of childEvents) {
            const childRoomId = ev.getStateKey();
            if (!childRoomId) continue;
            const childRoom = mx.getRoom(childRoomId);
            if (!childRoom) continue;
            if (childRoom.currentState.getStateEvents('m.room.tombstone', '')) continue;
            const joinRuleEv = childRoom.currentState.getStateEvents('m.room.join_rules', '');
            const joinRule = joinRuleEv?.getContent?.()?.join_rule ?? 'invite';
            if (joinRule === 'public' || joinRule === 'knock') {
              publicChildRoomIds.push(childRoomId);
            }
          }

          const results = await Promise.allSettled(
            publicChildRoomIds.map((roomId) => mx.invite(roomId, id))
          );

          const succeeded = results.filter((r) => r.status === 'fulfilled').length;
          const failed = results.filter((r) => r.status === 'rejected').length;

          if (publicChildRoomIds.length === 0) {
            toast.success(t('invite.invitedTo', { id, name: state.name }));
          } else if (failed === 0) {
            toast.success(
              succeeded !== 1
                ? t('invite.invitedToWithRooms_plural', { id, name: state.name, count: succeeded })
                : t('invite.invitedToWithRooms', { id, name: state.name, count: succeeded })
            );
          } else {
            toast.success(
              succeeded !== 1
                ? t('invite.invitedToWithRoomsFailed_plural', {
                    id,
                    name: state.name,
                    count: succeeded,
                    failed,
                  })
                : t('invite.invitedToWithRoomsFailed', {
                    id,
                    name: state.name,
                    count: succeeded,
                    failed,
                  })
            );
          }
        } else {
          toast.success(t('invite.invitedTo', { id, name: state.name }));
        }

        close();
      } catch (err) {
        toast.error(t('invite.inviteFailed', { error: getErrorMessage(err) }));
      } finally {
        setLoading(false);
      }
    },
    [userId, state, client, close, toast, t]
  );

  // Clicking a suggestion fills the input — user still confirms with Invite button
  const handleSelect = useCallback((suggestion: UserSuggestion) => {
    setUserId(suggestion.userId);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setUserId(val);
      autocomplete.onInput(val);
    },
    [autocomplete]
  );

  if (!client) return null;

  return (
    <Modal
      open={!!state}
      onClose={close}
      title={state ? t('invite.inviteTo', { name: state.name }) : t('invite.title')}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" loading={loading} onClick={() => handleInvite()}>
            {t('common.invite')}
          </Button>
        </>
      }
    >
      <Input
        label={t('invite.userId')}
        placeholder={t('invite.userIdPlaceholder')}
        value={userId}
        onChange={handleChange}
        onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
        autoFocus
      />

      <InviteAutocompleteDropdown
        state={autocomplete.state}
        client={client}
        maxRecent={3}
        onSelect={handleSelect}
      />

      {state?.isSpace && (
        <p style={{ fontSize: '0.8rem', color: vars.color.textSecondary, margin: 0 }}>
          {t('invite.spaceInviteNote')}
        </p>
      )}
    </Modal>
  );
}
