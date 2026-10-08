import { useState, useCallback, useEffect, useId } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { inviteModalRoomIdAtom, recentInvitesAtom } from '@/app/store/atoms';
import { getMatrixClient, getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { formatUserId } from '@/util/matrix';
import { Modal } from '@/app/components/Modal';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { useInviteAutocomplete } from './useInviteAutocomplete';
import { InviteAutocompleteDropdown } from './InviteAutocompleteDropdown';
import type { UserSuggestion } from './useInviteAutocomplete';

export function InviteModal() {
  const { t } = useTranslation();
  const [state, setState] = useAtom(inviteModalRoomIdAtom);
  const setRecentInvites = useSetAtom(recentInvitesAtom);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const client = getMatrixClientOrNull();
  const listId = useId();

  const autocomplete = useInviteAutocomplete(client!);
  const { open: openAutocomplete } = autocomplete;

  const isOpen = !!state;

  // Pre-populate with recent/DM users whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      openAutocomplete();
    }
  }, [isOpen, openAutocomplete]);

  // Defensive guard, you can only invite others to a room you have actually
  // joined. If somehow opened for an invited/left room, close immediately.
  useEffect(() => {
    if (!isOpen || !state || !client) return;
    const room = client.getRoom(state.roomId);
    if (room && room.getMyMembership() !== 'join') {
      setState(null);
      toast.error(t('invite.joinRequired'));
    }
  }, [isOpen, state, client, setState, toast, t]);

  const close = useCallback(() => {
    setState(null);
    setUserId('');
    autocomplete.close();
  }, [setState, autocomplete]);

  const canInvite = userId.trim().length > 0;

  const handleInvite = useCallback(
    async (targetUserId?: string) => {
      const id = (targetUserId ?? userId).trim();
      if (!id) return;
      if (!state || !client) return;

      setLoading(true);
      try {
        const mx = getMatrixClient();

        await mx.invite(state.roomId, id);

        // Track for future recent suggestions
        const user = mx.getUser(id);
        const displayName = user?.displayName ?? formatUserId(id);
        const avatarMxc = user?.avatarUrl ?? null;
        setRecentInvites((prev) => {
          const next = prev.filter((u) => u.userId !== id);
          next.unshift({ userId: id, displayName, avatarMxc, timestamp: Date.now() });
          return next.slice(0, 20);
        });

        toast.success(t('invite.invitedTo', { id, name: state.name }));

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

  const acVisible = autocomplete.state.open && autocomplete.state.suggestions.length > 0;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        autocomplete.onArrow('down');
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        autocomplete.onArrow('up');
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        autocomplete.close();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const sel = autocomplete.confirm();
        if (sel) {
          handleSelect(sel);
        } else {
          void handleInvite();
        }
        return;
      }
    },
    [autocomplete, handleSelect, handleInvite]
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
          <Button
            variant="primary"
            loading={loading}
            onClick={() => handleInvite()}
            disabled={!canInvite}
          >
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
        onKeyDown={handleKeyDown}
        data-dialog-autofocus
        role="combobox"
        aria-expanded={acVisible}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={
          acVisible ? `${listId}-option-${autocomplete.state.selectedIndex}` : undefined
        }
      />

      <InviteAutocompleteDropdown
        state={autocomplete.state}
        client={client}
        maxRecent={3}
        onSelect={handleSelect}
        listId={listId}
      />
    </Modal>
  );
}
