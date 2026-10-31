import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrashIcon } from '@phosphor-icons/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { Button, IconButton } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import * as css from '@/app/components/Settings/Settings.css';
import { vars } from '@/theme/vars.css';

function isValidAlias(value: string): boolean {
  return /^#[A-Za-z0-9.\-_/=]+:[A-Za-z0-9.\-_]+$/.test(value);
}

interface Props {
  client: MatrixClient | null;
  /** The main address, and the other addresses (without the main one). */
  canonicalAlias: string | null;
  aliases: string[];
  canEdit: boolean;
  /** Each of these makes the room's or space's own state changes; failures are toasted here. */
  onAdd: (client: MatrixClient, alias: string) => Promise<void>;
  onRemove: (client: MatrixClient, alias: string) => Promise<void>;
  onSetCanonical: (client: MatrixClient, alias: string) => Promise<void>;
}

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 12px',
  borderRadius: 8,
  backgroundColor: vars.color.bgSecondary,
  marginBottom: 6,
};

const ALIAS_STYLE: React.CSSProperties = {
  flex: 1,
  fontSize: '0.9rem',
  fontFamily: 'monospace',
  color: vars.color.textPrimary,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/** A room's or space's published addresses: the list, and a field to add one. */
export function AddressesSection({
  client,
  canonicalAlias,
  aliases,
  canEdit,
  onAdd,
  onRemove,
  onSetCanonical,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [newAlias, setNewAlias] = useState('');
  const [addingAlias, setAddingAlias] = useState(false);

  const canAddAlias = canEdit && isValidAlias(newAlias.trim());

  const handleAddAlias = async () => {
    const trimmed = newAlias.trim();
    if (!isValidAlias(trimmed)) return;
    if (!client) return;
    setAddingAlias(true);
    try {
      await onAdd(client, trimmed);
      setNewAlias('');
    } catch (err) {
      toast.error(
        getErrorMessage(err).includes('already in use')
          ? t('room.settings.addresses.aliasInUse')
          : t('room.settings.addresses.invalidFormat')
      );
    } finally {
      setAddingAlias(false);
    }
  };

  const guarded =
    (action: (c: MatrixClient, alias: string) => Promise<void>) => async (alias: string) => {
      if (!client) return;
      try {
        await action(client, alias);
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    };
  const handleRemoveAlias = guarded(onRemove);
  const handleSetCanonical = guarded(onSetCanonical);

  return (
    <div className={css.section}>
      <h3 className={css.sectionTitle}>{t('room.settings.addresses.title')}</h3>

      {canonicalAlias ? (
        <div style={ROW_STYLE}>
          <span style={ALIAS_STYLE}>{canonicalAlias}</span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 10,
              backgroundColor: vars.color.accent,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {t('room.settings.general.title')}
          </span>
        </div>
      ) : (
        <p className={css.settingNote}>{t('room.settings.addresses.noAddresses')}</p>
      )}

      {aliases.map((alias) => (
        <div key={alias} style={ROW_STYLE}>
          <span style={ALIAS_STYLE}>{alias}</span>
          {alias !== canonicalAlias && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSetCanonical(alias)}
              disabled={!canEdit}
            >
              {t('room.settings.addresses.mainAddress')}
            </Button>
          )}
          <IconButton
            size="sm"
            onClick={() => handleRemoveAlias(alias)}
            aria-label={t('room.settings.addresses.removeAddress')}
            disabled={!canEdit}
          >
            <TrashIcon size={14} />
          </IconButton>
        </div>
      ))}

      <div className={css.flexRowWrap} style={{ marginTop: 16 }}>
        <div className={css.flexOne}>
          <Input
            placeholder={t('room.settings.addresses.addressPlaceholder')}
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            disabled={!canEdit}
          />
        </div>
        <Button
          variant="primary"
          loading={addingAlias}
          onClick={handleAddAlias}
          disabled={!canAddAlias}
        >
          {t('room.settings.addresses.addAddress')}
        </Button>
      </div>
    </div>
  );
}
