import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { StickerIcon } from '@phosphor-icons/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { Modal } from '@/app/components/Modal';
import { Button } from '@/app/components/Button';
import { AuthMediaImg } from '@/app/components/AuthMediaImg';
import { getPackSourceImages, type RoomPackSummary } from '@/app/hooks/useUserPacks';
import * as css from '../Timeline.css';

interface Props {
  client: MatrixClient;
  pack: RoomPackSummary;
  onClose: () => void;
}

/** Read-only view of the room pack a sticker was sent from, opened by clicking that sticker. */
export function StickerPackPreviewModal({ client, pack, onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const images = useMemo(
    () => getPackSourceImages(client, pack.roomId, pack.stateKey),
    [client, pack.roomId, pack.stateKey]
  );
  const entries = Object.entries(images);
  const roomName = client.getRoom(pack.roomId)?.name ?? pack.roomId;

  return (
    <Modal
      open
      onClose={onClose}
      title={pack.displayName}
      zIndex={7600}
      footer={
        <Button
          variant="secondary"
          onClick={() => {
            onClose();
            navigate(`/r/${encodeURIComponent(pack.roomId)}`);
          }}
        >
          {t('timeline.stickerPack.viewRoom')}
        </Button>
      }
    >
      <div className={css.stickerPackPreviewHeader}>
        {pack.avatarMxc ? (
          <AuthMediaImg
            client={client}
            mxcUrl={pack.avatarMxc}
            width={40}
            height={40}
            alt=""
            className={css.stickerPackPreviewAvatar}
          />
        ) : (
          <StickerIcon size={24} />
        )}
        <div className={css.stickerPackPreviewInfo}>
          <span className={css.stickerPackPreviewName}>{pack.displayName}</span>
          <span className={css.stickerPackPreviewMeta}>
            {t('timeline.stickerPack.stickerCount', { count: entries.length })}
            {' · '}
            {t('timeline.stickerPack.fromRoom', { room: roomName })}
          </span>
        </div>
      </div>
      <div className={css.stickerPackPreviewGrid}>
        {entries.map(([shortcode, img]) => (
          <div key={shortcode} className={css.stickerPackPreviewItem}>
            <AuthMediaImg
              client={client}
              mxcUrl={img.url}
              alt={img.body ?? shortcode}
              className={css.stickerPackPreviewItemImg}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}
