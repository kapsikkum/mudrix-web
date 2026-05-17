import { useState, useCallback, useEffect } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { newDmOpenAtom, currentRoomIdAtom as roomAtom } from '@/app/store/atoms';
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
import {
  useInviteAutocomplete,
  trackRecentInvite,
} from '@/app/features/room/useInviteAutocomplete';
import { InviteAutocompleteDropdown } from '@/app/features/room/InviteAutocompleteDropdown';
import type { UserSuggestion } from '@/app/features/room/useInviteAutocomplete';

export function NewDmModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useAtom(newDmOpenAtom);
  const [, setCurrentRoom] = useAtom(roomAtom);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const client = getMatrixClientOrNull();

  const autocomplete = useInviteAutocomplete(client!);

  // Pre-populate with recent/DM users whenever the modal opens
  useEffect(() => {
    if (open) {
      autocomplete.open();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setUserId('');
    autocomplete.close();
  }, [setOpen, autocomplete]);

  const handleStart = useCallback(
    async (targetUserId?: string) => {
      const id = (targetUserId ?? userId).trim();
      if (!id) {
        toast.error(t('invite.pleaseEnterUserId'));
        return;
      }
      setLoading(true);
      try {
        const mx = getMatrixClient();
        const roomId = await startDm(mx, id);

        // Track for future recent suggestions
        const user = mx.getUser(id);
        const displayName = user?.displayName ?? formatUserId(id);
        const avatarMxc = user?.avatarUrl ?? null;
        trackRecentInvite(id, displayName, avatarMxc);

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
          <Button variant="primary" loading={loading} onClick={() => handleStart()}>
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
        autoFocus
      />

      <InviteAutocompleteDropdown
        state={autocomplete.state}
        client={client}
        maxRecent={3}
        onSelect={handleSelect}
      />
    </Modal>
  );
}
