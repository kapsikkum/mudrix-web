import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useProfile } from '@/app/hooks/useProfile';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { Input } from '@/app/components/Input';
import { Button } from '@/app/components/Button';
import * as css from '../Settings.css';

export function DisplayName() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const { profile, saveProfile } = useProfile(client!);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.displayName) setDisplayName(profile.displayName);
  }, [profile?.displayName]);

  if (!client || !profile) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfile({ displayName: displayName.trim() || undefined });
      toast.success(t('common.saved'));
    } catch (err) {
      toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={css.settingItem}
      style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', width: '100%' }}>
        <div style={{ flex: 1 }}>
          <Input
            id="display-name"
            label={t('settings.profile.displayName')}
            placeholder={t('settings.profile.displayNamePlaceholder')}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <Button variant="primary" onClick={handleSave} loading={saving}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}
