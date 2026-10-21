import { isTauri, saveDesktopDownload } from '@/util/desktop';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadSimpleIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import type { CryptoApi } from 'matrix-js-sdk/lib/crypto-api';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { getErrorMessage } from '@/util/error';
import {
  MegolmKeyFileError,
  decryptMegolmKeyFile,
  encryptMegolmKeyFile,
} from '@/util/megolmKeyFile';
import * as css from './Sessions.css';
import * as layoutCss from '../Settings.css';

const MIN_PASSPHRASE_LENGTH = 1;

type MegolmSessionData = Parameters<CryptoApi['importRoomKeys']>[0][number];

/** Saves `text` as a file; in the desktop shell (no `<a download>`) it goes to Downloads. */
async function downloadTextFile(name: string, text: string): Promise<string | null> {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  try {
    if (isTauri()) return await saveDesktopDownload(url, name);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return null;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export function RoomKeysBackup() {
  const { t } = useTranslation();
  const toast = useToast();
  const client = getMatrixClientOrNull();

  const [exportPass, setExportPass] = useState('');
  const [exportPassConfirm, setExportPassConfirm] = useState('');
  const [exporting, setExporting] = useState(false);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPass, setImportPass] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportMismatch = exportPassConfirm.length > 0 && exportPass !== exportPassConfirm;
  const canExport =
    !!client?.getCrypto() &&
    !exporting &&
    exportPass.length >= MIN_PASSPHRASE_LENGTH &&
    exportPass === exportPassConfirm;
  const canImport =
    !!client?.getCrypto() &&
    !importing &&
    !!importFile &&
    importPass.length >= MIN_PASSPHRASE_LENGTH;

  const handleExport = async () => {
    const crypto = client?.getCrypto();
    if (!crypto) {
      toast.error(t('settings.roomKeys.cryptoNotAvailable'));
      return;
    }
    setExporting(true);
    try {
      const json = await crypto.exportRoomKeysAsJson();
      const file = await encryptMegolmKeyFile(json, exportPass);
      const savedPath = await downloadTextFile('mudrix-room-keys.txt', file);
      setExportPass('');
      setExportPassConfirm('');
      toast.success(
        savedPath
          ? t('common.downloadSaved', { path: savedPath })
          : t('settings.roomKeys.exportSuccess')
      );
    } catch (err) {
      toast.error(t('settings.roomKeys.exportFailed', { error: getErrorMessage(err) }));
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    const crypto = client?.getCrypto();
    if (!crypto || !importFile) return;
    setImporting(true);
    try {
      const text = await importFile.text();
      const json = await decryptMegolmKeyFile(text, importPass);
      const keys = JSON.parse(json) as MegolmSessionData[];
      if (!Array.isArray(keys)) throw new MegolmKeyFileError('format');
      await crypto.importRoomKeys(keys);
      toast.success(t('settings.roomKeys.importSuccess', { count: keys.length }));
      setImportFile(null);
      setImportPass('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      if (err instanceof MegolmKeyFileError) {
        toast.error(t(`settings.roomKeys.error_${err.code}`));
      } else if (err instanceof SyntaxError) {
        toast.error(t('settings.roomKeys.error_format'));
      } else {
        toast.error(t('settings.roomKeys.importFailed', { error: getErrorMessage(err) }));
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className={layoutCss.section}>
      <h3 className={layoutCss.sectionTitle}>{t('settings.roomKeys.title')}</h3>
      <p className={css.sessionNote}>{t('settings.roomKeys.description')}</p>

      <div className={css.roomKeysForm}>
        <h4 className={css.roomKeysSubtitle}>{t('settings.roomKeys.exportTitle')}</h4>
        <Input
          type="password"
          showPasswordToggle
          label={t('settings.roomKeys.passphrase')}
          value={exportPass}
          autoComplete="new-password"
          onChange={(e) => setExportPass(e.target.value)}
          disabled={exporting}
        />
        <Input
          type="password"
          label={t('settings.roomKeys.confirmPassphrase')}
          value={exportPassConfirm}
          autoComplete="new-password"
          error={exportMismatch ? t('settings.roomKeys.passphraseMismatch') : undefined}
          onChange={(e) => setExportPassConfirm(e.target.value)}
          disabled={exporting}
        />
        <div>
          <Button size="sm" onClick={handleExport} disabled={!canExport} loading={exporting}>
            <DownloadSimpleIcon size={14} />
            {t('settings.roomKeys.exportBtn')}
          </Button>
        </div>
      </div>

      <div className={layoutCss.divider} />

      <div className={css.roomKeysForm}>
        <h4 className={css.roomKeysSubtitle}>{t('settings.roomKeys.importTitle')}</h4>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,text/plain"
          aria-label={t('settings.roomKeys.chooseFile')}
          className={css.roomKeysFileInput}
          onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
          disabled={importing}
        />
        <Input
          type="password"
          showPasswordToggle
          label={t('settings.roomKeys.passphrase')}
          value={importPass}
          autoComplete="off"
          onChange={(e) => setImportPass(e.target.value)}
          disabled={importing}
        />
        <div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleImport}
            disabled={!canImport}
            loading={importing}
          >
            <UploadSimpleIcon size={14} />
            {t('settings.roomKeys.importBtn')}
          </Button>
        </div>
      </div>
    </div>
  );
}
