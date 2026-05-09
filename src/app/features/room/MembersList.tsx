import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai';
import { currentRoomIdAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Avatar } from '@/app/components/Avatar';
import { useMembers } from './useMembers';
import type { MemberEntry } from './useMembers';
import * as css from './MembersList.css';

const MemberRow = memo(function MemberRow({
  member,
  client,
}: {
  member: MemberEntry;
  client: ReturnType<typeof getMatrixClientOrNull>;
}) {
  return (
    <div className={css.memberRow} title={member.userId}>
      <Avatar
        name={member.displayName}
        mxcUrl={member.avatarMxc}
        client={client ?? undefined}
        size="sm"
      />
      <span className={css.memberName}>{member.displayName}</span>
    </div>
  );
});

export function MembersList() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const roomId = useAtomValue(currentRoomIdAtom);
  const members = useMembers(client, roomId);

  if (!roomId) return null;

  if (members.length === 0) {
    return <div className={css.emptyState}>{t('room.noMembers')}</div>;
  }

  return (
    <div>
      {members.map((m) => (
        <MemberRow key={m.userId} member={m} client={client} />
      ))}
    </div>
  );
}
