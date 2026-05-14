import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeIcon } from '@phosphor-icons/react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Avatar } from '@/app/components/Avatar';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import * as css from '@/app/components/Settings/Settings.css';

interface MemberEntry {
  userId: string;
  displayName: string;
  avatarMxc: string | null;
  powerLevel: number;
}

function powerLevelLabel(level: number, t: (key: string) => string): string {
  if (level >= 100) return t('room.settings.members.admin');
  if (level >= 50) return t('room.settings.members.moderator');
  return t('room.settings.members.member');
}

function powerLevelBadgeClass(
  level: number,
  styles: { permLevelAdmin: string; permLevelMod: string; permLevelMember: string }
): string {
  if (level >= 100) return styles.permLevelAdmin;
  if (level >= 50) return styles.permLevelMod;
  return styles.permLevelMember;
}

interface PermissionsPanelProps {
  spaceId: string;
}

export function PermissionsPanel({ spaceId }: PermissionsPanelProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();

  const space = client?.getRoom(spaceId) ?? null;
  const myUserId = client?.getUserId() ?? '';
  const isAdmin = (space?.getMember(myUserId)?.powerLevel ?? 0) >= 100;

  const allMembers: MemberEntry[] = (space?.getJoinedMembers() ?? []).map((m) => ({
    userId: m.userId,
    displayName: m.name ?? m.userId,
    avatarMxc: m.getMxcAvatarUrl() ?? null,
    powerLevel: m.powerLevel,
  }));

  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number>(0);
  const [applying, setApplying] = useState(false);

  const filteredMembers =
    query.trim().length === 0
      ? []
      : allMembers.filter(
          (m) =>
            m.displayName.toLowerCase().includes(query.toLowerCase()) ||
            m.userId.toLowerCase().includes(query.toLowerCase())
        );

  const selectedMember = selectedUserId
    ? (allMembers.find((m) => m.userId === selectedUserId) ?? null)
    : null;

  const handleSelectMember = (userId: string, currentLevel: number) => {
    setSelectedUserId(userId);
    setSelectedLevel(currentLevel);
  };

  const handleApply = async () => {
    if (!client || !selectedUserId) return;
    setApplying(true);
    try {
      await client.setPowerLevel(spaceId, selectedUserId, selectedLevel);
      toast.success(
        t('room.settings.members.permissionsApplySuccess', {
          name: selectedMember?.displayName ?? selectedUserId,
          level: powerLevelLabel(selectedLevel, t),
        })
      );
      setSelectedUserId(null);
      setQuery('');
    } catch (err) {
      toast.error(
        t('room.settings.members.permissionsApplyFailed', { error: getErrorMessage(err) })
      );
    } finally {
      setApplying(false);
    }
  };

  return (
    <div>
      <h2 className={css.panelTitle}>{t('room.settings.members.title')}</h2>

      {!isAdmin && (
        <div className={css.readOnlyNote}>
          <EyeIcon size={14} />
          {t('room.settings.readOnlyPermissions')}
        </div>
      )}

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('room.settings.members.memberPermissions')}</h3>
        <p className={css.settingNoteBlock}>{t('room.settings.permissions.description')}</p>

        <div className={css.permSearchRow}>
          <div className={css.permSearchWrap}>
            <Input
              label={t('room.settings.members.searchMembers')}
              placeholder={t('room.settings.members.searchMembersPlaceholder')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedUserId(null);
              }}
            />
          </div>
        </div>

        {query.trim().length > 0 && (
          <div className={css.permResults}>
            {filteredMembers.length === 0 ? (
              <div className={css.noResults}>{t('room.settings.members.noMembersFound')}</div>
            ) : (
              filteredMembers.map((m) => (
                <div
                  key={m.userId}
                  className={
                    selectedUserId === m.userId ? css.permResultItemSelected : css.permResultItem
                  }
                  onClick={() => handleSelectMember(m.userId, m.powerLevel)}
                >
                  <Avatar
                    name={m.displayName}
                    mxcUrl={m.avatarMxc}
                    client={client ?? undefined}
                    size="sm"
                  />
                  <div className={css.flexOneMinWidth}>
                    <div className={css.permResultName}>{m.displayName}</div>
                    <div className={css.permResultId}>{m.userId}</div>
                  </div>
                  <span className={powerLevelBadgeClass(m.powerLevel, css)}>
                    {powerLevelLabel(m.powerLevel, t)}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {selectedMember && isAdmin && (
          <div className={css.permApplyRow}>
            <span className={css.permApplyLabel}>
              <strong>{selectedMember.displayName}</strong>
            </span>
            <select
              className={css.select}
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(Number(e.target.value))}
            >
              <option value={0}>{t('room.settings.members.member')} (0)</option>
              <option value={50}>{t('room.settings.members.moderator')} (50)</option>
              <option value={100}>{t('room.settings.members.admin')} (100)</option>
            </select>
            <Button
              variant="primary"
              size="sm"
              loading={applying}
              onClick={handleApply}
              disabled={selectedLevel === selectedMember.powerLevel}
            >
              {t('common.apply')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
