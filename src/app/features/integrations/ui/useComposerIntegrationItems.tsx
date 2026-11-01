import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { DownloadSimpleIcon, LinkIcon, PaperPlaneRightIcon, PlusIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { ContextMenuItem } from '@/app/features/contextMenu/contextMenuAtom';
import { grantsAtom, installedIntegrationsAtom } from '../store';
import { getComposerActions, renderInsert } from '../matching';

const ICONS: Record<string, Icon> = {
  send: PaperPlaneRightIcon,
  download: DownloadSimpleIcon,
  link: LinkIcon,
  plus: PlusIcon,
};

/** The composer's "more options" entries for installed integrations; each only inserts text at the cursor and never sends. */
export function useComposerIntegrationItems(
  roomId: string,
  onInsert: (text: string) => void
): ContextMenuItem[] {
  const { t } = useTranslation();
  const installed = useAtomValue(installedIntegrationsAtom);
  const grants = useAtomValue(grantsAtom);
  return useMemo(
    () =>
      getComposerActions(installed, grants).map((a) => {
        const IconCmp = ICONS[a.icon ?? ''] ?? PlusIcon;
        return {
          label: t('integrations.composer.actionLabel', {
            label: a.label,
            name: a.integrationName,
          }),
          icon: <IconCmp size={14} />,
          onClick: () => onInsert(renderInsert(a.insert, roomId)),
        };
      }),
    [installed, grants, roomId, onInsert, t]
  );
}
