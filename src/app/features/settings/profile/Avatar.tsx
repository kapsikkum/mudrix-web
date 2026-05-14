import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import { CameraIcon } from '@phosphor-icons/react';
import { Avatar as AvatarComponent } from '@/app/components/Avatar';
import * as css from '@/app/components/Settings/Settings.css';
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
    <div className={css.avatarRow}>
      <div className={css.avatarUploadWrap}>
        <div className={css.avatarClickable} onClick={() => fileRef.current?.click()}>
          {previewUrl ? (
            <img src={previewUrl} alt="preview" className={css.avatarPreviewImg} />
          ) : (
            <AvatarComponent
              name={profile.displayName}
              mxcUrl={profile.avatarUrl}
              client={client}
              size="xl"
            />
          )}
          <div className={css.avatarOverlay}>
            <CameraIcon size={20} className={css.whiteIcon} />
          </div>
        </div>

        {(previewUrl || profile.avatarUrl) && (
          <button onClick={handleRemoveClick} disabled={saving} className={css.removeAvatarBtn}>
            {t('common.removeAvatar')}
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className={css.hiddenInput}
        onChange={handleFileChange}
      />
    </div>
  );
}
