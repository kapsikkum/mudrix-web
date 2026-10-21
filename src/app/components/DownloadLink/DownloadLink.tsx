import { useTranslation } from 'react-i18next';
import { isTauri, saveDesktopDownload } from '@/util/desktop';
import { useToast } from '@/app/hooks/useToast';

interface Props extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'download' | 'href'> {
  href: string;
  filename: string;
}

/**
 * A download link that also works in the desktop shell, where webview `<a download>` does
 * nothing: there the file is saved to the Downloads folder and a toast says where.
 */
export function DownloadLink({ href, filename, onClick, children, ...rest }: Props) {
  const { t } = useTranslation();
  const toast = useToast();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || !isTauri()) return;
    e.preventDefault();
    saveDesktopDownload(href, filename).then(
      (path) => toast.success(t('common.downloadSaved', { path })),
      () => toast.error(t('common.downloadFailed'))
    );
  };

  return (
    <a {...rest} href={href} download={filename} onClick={handleClick}>
      {children}
    </a>
  );
}
