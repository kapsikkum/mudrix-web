import { useState, useCallback, useEffect, useId } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { newDmOpenAtom, currentRoomIdAtom as roomAtom, recentInvitesAtom } from '@/app/store/atoms';
import { getMatrixClient, getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { startDm } from '@/app/hooks/useDms';
import { getErrorMessage } from '@/util/error';
import { formatUserId } from '@/util/matrix';
import { useNavigate } from 'react-router-dom';
import { ChatCircleIcon } from '@phosphor-icons/react';
import { Modal } from '@/app/components/Modal';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { useInviteAutocomplete } from '@/app/features/room/useInviteAutocomplete';
import { InviteAutocompleteDropdown } from '@/app/features/room/InviteAutocompleteDropdown';
import type { UserSuggestion } from '@/app/features/room/useInviteAutocomplete';

export function NewDmModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useAtom(newDmOpenAtom);
  const [, setCurrentRoom] = useAtom(roomAtom);
  const setRecentInvites = useSetAtom(recentInvitesAtom);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const client = getMatrixClientOrNull();
  const listId = useId();

  const autocomplete = useInviteAutocomplete(client!);
  const { open: openAutocomplete } = autocomplete;

  // Pre-populate with recent/DM users whenever the modal opens
  useEffect(() => {
    if (open) {
      openAutocomplete();
    }
  }, [open, openAutocomplete]);

  const close = useCallback(() => {
    setOpen(false);
    setUserId('');
    autocomplete.close();
  }, [setOpen, autocomplete]);

  const canStart = userId.trim().length > 0;

  const handleStart = useCallback(
    async (targetUserId?: string) => {
      const id = (targetUserId ?? userId).trim();
      if (!id) return;
      setLoading(true);
      try {
        const mx = getMatrixClient();
        const roomId = await startDm(mx, id);

        // Track for future recent suggestions
        const user = mx.getUser(id);
        const displayName = user?.displayName ?? formatUserId(id);
        const avatarMxc = user?.avatarUrl ?? null;
        setRecentInvites((prev) => {
          const next = prev.filter((u) => u.userId !== id);
          next.unshift({ userId: id, displayName, avatarMxc, timestamp: Date.now() });
          return next.slice(0, 20);
        });

        setCurrentRoom(roomId);
        navigate(`/dm/${encodeURIComponent(roomId)}`);
        close();
      } catch (err) {
        toast.error(t('room.dm.startFailed', { error: getErrorMessage(err) }));
      } finally {
        setLoading(false);
      }
    },
    [userId, setCurrentRoom, navigate, close, toast, t]
  );

  const handleSelect = useCallback(
    (suggestion: UserSuggestion) => {
      setUserId(suggestion.userId);
      autocomplete.close();
    },
    [autocomplete]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setUserId(val);
      autocomplete.onInput(val);
    },
    [autocomplete]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        autocomplete.onArrow(e.key === 'ArrowDown' ? 'down' : 'up');
      } else if (e.key === 'Enter') {
        const selected = autocomplete.confirm();
        if (selected) {
          setUserId(selected.userId);
          autocomplete.close();
        } else {
          handleStart();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        autocomplete.close();
      }
    },
    [autocomplete, handleStart]
  );

  if (!client) return null;

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('room.dm.newDm')}
      titleIcon={<ChatCircleIcon size={18} weight="fill" />}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={() => handleStart()}
            disabled={!canStart}
          >
            {t('room.dm.startChat')}
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
        aria-expanded={autocomplete.state.open && autocomplete.state.suggestions.length > 0}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={
          autocomplete.state.open && autocomplete.state.suggestions.length > 0
            ? `${listId}-option-${autocomplete.state.selectedIndex}`
            : undefined
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
