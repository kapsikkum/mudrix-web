import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import { vars } from '@/theme/vars.css';
import { CameraIcon } from '@phosphor-icons/react';
import { Avatar as AvatarComponent } from '@/app/components/Avatar';
import { useToast } from '@/app/hooks/useToast';
import { useProfile } from '@/app/hooks/useProfile';
import { getErrorMessage } from '@/util/error';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { confirmModalAtom } from '@/app/store/atoms';

export function Avatar() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const { profile, saveProfile, removeAvatar } = useProfile(client!);
  const [, setConfirm] = useAtom(confirmModalAtom);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!client || !profile) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setSaving(true);
    try {
      await saveProfile({ avatarFile: file });
      toast.success(t('common.saved'));
    } catch (err) {
      toast.error(t('common.saveFailed', { error: getErrorMessage(err) }));
      setPreviewUrl(null);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveClick = () => {
    setConfirm({
      open: true,
      title: t('common.removeAvatar'),
      message: t('common.removeAvatarConfirm'),
      danger: true,
      resolve: async (confirmed) => {
        if (!confirmed) return;
        setSaving(true);
        try {
          await removeAvatar();
          setPreviewUrl(null);
          toast.success(t('common.avatarRemoved'));
        } catch (err) {
          toast.error(t('common.removeAvatarFailed', { error: getErrorMessage(err) }));
        } finally {
          setSaving(false);
        }
      },
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div
          style={{ cursor: 'pointer', position: 'relative' }}
          onClick={() => fileRef.current?.click()}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="preview"
              style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <AvatarComponent
              name={profile.displayName}
              mxcUrl={profile.avatarUrl}
              client={client}
              size="xl"
            />
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              backgroundColor: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
          >
            <CameraIcon size={20} style={{ color: '#fff' }} />
          </div>
        </div>

        {(previewUrl || profile.avatarUrl) && (
          <button
            onClick={handleRemoveClick}
            disabled={saving}
            style={{
              background: 'none',
              border: 'none',
              color: vars.color.textMuted,
              fontSize: '0.75rem',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: '4px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = vars.color.danger)}
            onMouseLeave={(e) => (e.currentTarget.style.color = vars.color.textMuted)}
          >
            {t('common.removeAvatar')}
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
