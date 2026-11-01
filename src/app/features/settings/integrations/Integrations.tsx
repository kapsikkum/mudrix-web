import { useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { WarningIcon } from '@phosphor-icons/react';
import { Button } from '@/app/components/Button/Button';
import { Input } from '@/app/components/Input/Input';
import { Modal } from '@/app/components/Modal/Modal';
import { Toggle } from '@/app/components/Toggle';
import { zIndex } from '@/theme/zIndex';
import {
  CAPABILITIES,
  addRepositoryAtom,
  approveUpdateAtom,
  assertWidgetUrlAllowed,
  dismissUpdateAtom,
  getWidgetCapabilityDef,
  grantsAtom,
  installAtom,
  hasCapability,
  installedIntegrationsAtom,
  refreshRepositoryAtom,
  removeRepositoryAtom,
  repositoriesAtom,
  runsCode,
  setEnabledAtom,
  setGrantAtom,
  uninstallAtom,
  type Capability,
  type Integration,
  type InstalledIntegration,
  type Permissions,
  type RepositoryRecord,
} from '../../integrations';
import * as css from '../Settings.css';
import * as ic from './Integrations.css';

function IconTile({ name, src }: { name: string; src?: string }) {
  if (src) return <img className={ic.iconTile} src={src} alt="" />;
  return (
    <span className={ic.iconTile} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function CodeBadge({ t }: { t: TFunction }) {
  return <span className={ic.codeBadge}>{t('settings.integrations.badge.runsCode')}</span>;
}

/** Shown wherever approving would let third-party code run. Plain statements, no softening. */
function CodeWarning({ t, host }: { t: TFunction; host: string }) {
  return (
    <div
      className={ic.codeWarning}
      role="group"
      aria-label={t('settings.integrations.widget.warning.title')}
    >
      <div className={ic.codeWarningHead}>
        <WarningIcon size={20} weight="fill" aria-hidden="true" />
        <span>{t('settings.integrations.widget.warning.title')}</span>
      </div>
      <ul className={ic.codeWarningList}>
        <li>{t('settings.integrations.widget.warning.source', { host })}</li>
        <li>{t('settings.integrations.widget.warning.changes')}</li>
        <li>{t('settings.integrations.widget.warning.isolated')}</li>
        <li>{t('settings.integrations.widget.warning.trust')}</li>
      </ul>
    </div>
  );
}

/** Plain-language description of one capability of a permission set. */
function CapabilityDetail({
  t,
  capability,
  permissions,
}: {
  t: TFunction;
  capability: Capability;
  permissions: Permissions;
}) {
  if (capability === 'linkCards') {
    return (
      <>
        <span className={ic.permTitle}>{t('settings.integrations.cap.linkCards.title')}</span>
        <ul className={ic.permList}>
          {(permissions.linkCards ?? []).map((rule) => (
            <li key={`${rule.hosts.join(',')}${rule.pathPrefix ?? ''}${rule.title}`}>
              {t('settings.integrations.cap.linkCards.rule', {
                hosts: rule.hosts.join(', '),
                title: rule.title,
              })}
              {rule.pathPrefix
                ? ` ${t('settings.integrations.cap.linkCards.path', { path: rule.pathPrefix })}`
                : ''}
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (capability === 'composerActions') {
    return (
      <>
        <span className={ic.permTitle}>{t('settings.integrations.cap.composerActions.title')}</span>
        <ul className={ic.permList}>
          {(permissions.composerActions ?? []).map((action) => (
            <li key={action.id}>
              <strong>{action.label}</strong>
              {': '}
              {t('settings.integrations.cap.composerActions.inserts')}{' '}
              <code className={ic.code}>{action.insert}</code>
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (capability === 'commands') {
    const actions = permissions.api?.actions ?? [];
    return (
      <>
        <span className={ic.permTitle}>{t('settings.integrations.cap.commands.title')}</span>
        <ul className={ic.permList}>
          {(permissions.commands ?? []).map((cmd) => (
            <li key={cmd.name}>
              <code className={ic.code}>{cmd.usage ?? `/${cmd.name}`}</code>
              {': '}
              {cmd.description}
              {' ('}
              {cmd.widget ? (
                t('settings.integrations.cap.commands.opensWidget')
              ) : cmd.api !== undefined ? (
                t('settings.integrations.cap.commands.runsApi', {
                  label: actions.find((a) => a.id === cmd.api)?.label ?? cmd.api,
                })
              ) : (
                <>
                  {t('settings.integrations.cap.commands.inserts')}{' '}
                  <code className={ic.code}>{cmd.insert}</code>
                </>
              )}
              {')'}
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (capability === 'api' && permissions.api) {
    const { host, actions } = permissions.api;
    return (
      <>
        <span className={ic.permTitle}>{t('settings.integrations.cap.api.title')}</span>
        <span className={ic.muted}>
          {t('settings.integrations.cap.api.summary', {
            host,
            labels: actions.map((a) => a.label).join(', '),
          })}
        </span>
        <ul className={ic.permList}>
          {actions.map((a) => (
            <li key={a.id}>
              <strong>{a.label}</strong>
              {': '}
              <code className={ic.code}>{`POST ${host}${a.path}`}</code>{' '}
              {a.body ? (
                <>
                  {t('settings.integrations.cap.api.sends')}{' '}
                  <code className={ic.code}>{JSON.stringify(a.body)}</code>
                </>
              ) : (
                t('settings.integrations.cap.api.sendsNothing')
              )}
              {a.insertResultLink ? ` ${t('settings.integrations.cap.api.link')}` : ''}
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (capability === 'widget' && permissions.widget) {
    const w = permissions.widget;
    const extra = (w.parameters ?? []).map((p) => t(`settings.integrations.widget.param.${p}`));
    return (
      <>
        <span className={ic.nameRow}>
          <span className={ic.permTitle}>{t('settings.integrations.cap.widget.title')}</span>
          <CodeBadge t={t} />
        </span>
        <span className={ic.muted}>
          {t('settings.integrations.cap.widget.summary', { host: hostOf(w.url) })}
        </span>
        <ul className={ic.permList}>
          {w.capabilities.length === 0 ? (
            <li>{t('settings.integrations.widget.noAccess')}</li>
          ) : (
            w.capabilities.map((id) => {
              const def = getWidgetCapabilityDef(id);
              if (!def) return null;
              return (
                <li key={id}>
                  {t(def.descriptionKey)}
                  {def.risk === 'high' && (
                    <span className={ic.highAccess}>
                      {t('settings.integrations.widget.highAccess')}
                    </span>
                  )}
                </li>
              );
            })
          )}
          <li>
            {t('settings.integrations.widget.address')}
            {extra.length > 0 &&
              ` ${t('settings.integrations.widget.addressExtra', { values: extra.join(', ') })}`}
          </li>
        </ul>
      </>
    );
  }
  return null;
}

function activeCapabilities(permissions: Permissions): Capability[] {
  return CAPABILITIES.filter((c) => hasCapability(permissions, c));
}

/** The tick that has to be set before code from a third party can be installed or updated. */
function UnderstandCodeCheckbox({
  t,
  host,
  checked,
  onChange,
  disabled,
}: {
  t: TFunction;
  host: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={ic.ackRow}>
      <input
        type="checkbox"
        className={ic.ackBox}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{t('settings.integrations.widget.understand', { host })}</span>
    </label>
  );
}

function ConsentDialog({
  integration,
  repo,
  onClose,
}: {
  integration: Integration | null;
  repo: RepositoryRecord | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const install = useSetAtom(installAtom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [understood, setUnderstood] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const widget = integration?.permissions.widget;
  const code = integration ? runsCode(integration.permissions) : false;
  const host = widget ? hostOf(widget.url) : '';
  // A widget on this app's own origin (or any other refused address) can never be installed.
  const urlCheck = useMemo(() => (widget ? assertWidgetUrlAllowed(widget.url) : null), [widget]);
  const blocked = urlCheck !== null && !urlCheck.ok;

  // Each opening starts unticked, with Cancel focused so that Enter can not install by accident.
  useEffect(() => {
    setUnderstood(false);
    setError('');
    if (!integration) return undefined;
    const id = requestAnimationFrame(() => cancelRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [integration]);

  const confirm = async () => {
    if (!integration || !repo) return;
    if (integration.permissions.widget) {
      const check = assertWidgetUrlAllowed(integration.permissions.widget.url);
      if (!check.ok) {
        setError(t('settings.integrations.widget.refused', { error: check.error }));
        return;
      }
    }
    setBusy(true);
    setError('');
    // installAtom fetches the icon, so nothing is contacted before the user agrees.
    const res = await install({
      integration,
      repoUrl: repo.url,
      approved: integration.permissions,
    });
    setBusy(false);
    if (res.ok) onClose();
    else setError(res.error);
  };

  const hasApi = integration?.permissions.api !== undefined;

  return (
    <Modal
      open={integration !== null}
      onClose={busy ? undefined : onClose}
      title={t('settings.integrations.consent.title', { name: integration?.name ?? '' })}
      size="md"
      zIndex={zIndex.overlay}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" size="md" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => void confirm()}
            loading={busy}
            disabled={blocked || (code && !understood)}
          >
            {t('settings.integrations.install')}
          </Button>
        </>
      }
    >
      {integration && (
        <div className={ic.consentBody}>
          <div className={ic.nameRow}>
            <p className={css.settingNote}>{integration.description}</p>
            {code && <CodeBadge t={t} />}
          </div>
          {code && <CodeWarning t={t} host={host} />}
          {urlCheck && !urlCheck.ok && (
            <span className={ic.errorText} role="alert">
              {t('settings.integrations.widget.refused', { error: urlCheck.error })}
            </span>
          )}
          <p className={css.settingLabel}>{t('settings.integrations.consent.intro')}</p>
          {activeCapabilities(integration.permissions).map((c) => (
            <div key={c} className={ic.permBody}>
              <CapabilityDetail t={t} capability={c} permissions={integration.permissions} />
            </div>
          ))}
          {code && (
            <UnderstandCodeCheckbox
              t={t}
              host={host}
              checked={understood}
              onChange={setUnderstood}
              disabled={busy}
            />
          )}
          <p className={css.settingNote}>
            {code
              ? t('settings.integrations.consent.safetyCode')
              : hasApi
                ? t('settings.integrations.consent.safetyApi')
                : t('settings.integrations.consent.safety')}
          </p>
          {error && (
            <span className={ic.errorText} role="alert">
              {error}
            </span>
          )}
        </div>
      )}
    </Modal>
  );
}

function InstalledItem({ item, repoName }: { item: InstalledIntegration; repoName: string }) {
  const { t } = useTranslation();
  const grants = useAtomValue(grantsAtom);
  const setEnabled = useSetAtom(setEnabledAtom);
  const setGrant = useSetAtom(setGrantAtom);
  const uninstall = useSetAtom(uninstallAtom);
  const approveUpdate = useSetAtom(approveUpdateAtom);
  const dismissUpdate = useSetAtom(dismissUpdateAtom);
  const [approving, setApproving] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [understood, setUnderstood] = useState(false);
  const pending = item.pendingUpdate;

  // Code that is new or changed in the update needs the warning (and the tick) again.
  const pendingWidget = pending?.permissions.widget;
  const codeChanged =
    pendingWidget !== undefined &&
    JSON.stringify(pendingWidget) !== JSON.stringify(item.permissions.widget);

  useEffect(() => {
    setUnderstood(false);
    setUpdateError('');
  }, [pending?.version]);

  const approve = async () => {
    if (pendingWidget) {
      const check = assertWidgetUrlAllowed(pendingWidget.url);
      if (!check.ok) {
        setUpdateError(t('settings.integrations.widget.refused', { error: check.error }));
        return;
      }
    }
    setApproving(true);
    const res = await approveUpdate(item.id);
    setApproving(false);
    setUpdateError(res.ok ? '' : res.error);
  };

  return (
    <li className={ic.card}>
      <div className={ic.head}>
        <IconTile name={item.name} src={item.iconDataUrl} />
        <div className={ic.info}>
          <span className={ic.nameRow}>
            <span className={ic.name}>{item.name}</span>
            {runsCode(item.permissions) && <CodeBadge t={t} />}
          </span>
          <span className={ic.muted}>{item.description}</span>
          <span className={ic.muted}>
            {t('settings.integrations.versionSource', { version: item.version, repo: repoName })}
          </span>
        </div>
        <div className={ic.row}>
          <span className={ic.muted}>{t('settings.integrations.enabled')}</span>
          <Toggle
            checked={item.enabled}
            onChange={(enabled) => setEnabled({ id: item.id, enabled })}
            ariaLabel={t('settings.integrations.enableNamed', { name: item.name })}
          />
        </div>
      </div>

      {item.sourceGone && <span className={ic.muted}>{t('settings.integrations.sourceGone')}</span>}

      {pending && (
        <div
          className={ic.banner}
          role="group"
          aria-label={t('settings.integrations.updateAvailable')}
        >
          <span className={ic.bannerTitle}>
            {t('settings.integrations.updateAvailableVersion', { version: pending.version })}
          </span>
          {codeChanged && pendingWidget && <CodeWarning t={t} host={hostOf(pendingWidget.url)} />}
          <span className={ic.muted}>{t('settings.integrations.updateRequests')}</span>
          {activeCapabilities(pending.permissions).map((c) => (
            <div key={c} className={ic.permBody}>
              <CapabilityDetail t={t} capability={c} permissions={pending.permissions} />
            </div>
          ))}
          {codeChanged && pendingWidget && (
            <UnderstandCodeCheckbox
              t={t}
              host={hostOf(pendingWidget.url)}
              checked={understood}
              onChange={setUnderstood}
              disabled={approving}
            />
          )}
          <span className={ic.muted}>{t('settings.integrations.updateOldStays')}</span>
          {updateError && (
            <span className={ic.errorText} role="alert">
              {updateError}
            </span>
          )}
          <div className={ic.row}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void approve()}
              loading={approving}
              disabled={codeChanged && !understood}
            >
              {t('settings.integrations.approveUpdate')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => dismissUpdate(item.id)}>
              {t('settings.integrations.dismiss')}
            </Button>
          </div>
        </div>
      )}

      <details className={ic.disclosure}>
        <summary className={ic.summary}>{t('settings.integrations.permissions')}</summary>
        {activeCapabilities(item.permissions).length === 0 ? (
          <span className={ic.muted}>{t('settings.integrations.noPermissions')}</span>
        ) : (
          activeCapabilities(item.permissions).map((c) => (
            <div key={c} className={ic.perm}>
              <div className={ic.permBody}>
                <CapabilityDetail t={t} capability={c} permissions={item.permissions} />
              </div>
              <Toggle
                checked={grants[item.id]?.[c] === true}
                onChange={(granted) => setGrant({ id: item.id, capability: c, granted })}
                ariaLabel={t('settings.integrations.allowCap', {
                  capability: t(`settings.integrations.cap.${c}.title`),
                })}
              />
            </div>
          ))
        )}
      </details>

      <div className={ic.row}>
        <Button variant="danger" size="sm" onClick={() => uninstall(item.id)}>
          {t('settings.integrations.uninstall')}
        </Button>
      </div>
    </li>
  );
}

function RepositoryItem({ repo }: { repo: RepositoryRecord }) {
  const { t } = useTranslation();
  const refresh = useSetAtom(refreshRepositoryAtom);
  const remove = useSetAtom(removeRepositoryAtom);
  const [busy, setBusy] = useState(false);

  return (
    <li className={ic.card}>
      <div className={ic.head}>
        <div className={ic.info}>
          <span className={ic.name}>{repo.name}</span>
          <span className={ic.mono}>{repo.url}</span>
          <span className={ic.muted}>
            {t('settings.integrations.integrationCount', { count: repo.integrations.length })}
          </span>
        </div>
        <div className={ic.row}>
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={() => {
              setBusy(true);
              void refresh(repo.url).finally(() => setBusy(false));
            }}
          >
            {t('settings.integrations.refresh')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => remove(repo.url)}>
            {t('settings.integrations.remove')}
          </Button>
        </div>
      </div>
      {repo.error && (
        <span className={ic.errorText}>
          {t('settings.integrations.fetchError', { error: repo.error })}
        </span>
      )}
    </li>
  );
}

export function Integrations() {
  const { t } = useTranslation();
  const repos = useAtomValue(repositoriesAtom);
  const installed = useAtomValue(installedIntegrationsAtom);
  const addRepo = useSetAtom(addRepositoryAtom);
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [consent, setConsent] = useState<{
    integration: Integration;
    repo: RepositoryRecord;
  } | null>(null);

  const repoName = (repoUrl: string) =>
    repos.find((r) => r.url === repoUrl)?.name ?? t('settings.integrations.unknownSource');

  const installedIds = new Set(installed.map((i) => i.id));
  const available = repos.flatMap((repo) =>
    repo.integrations
      .filter((integration) => !installedIds.has(integration.id))
      .map((integration) => ({ integration, repo }))
  );

  const add = async () => {
    setAdding(true);
    setAddError('');
    const res = await addRepo(url);
    setAdding(false);
    if (res.ok) setUrl('');
    else setAddError(res.error);
  };

  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.integrations.title')}</h2>
      <p className={ic.intro}>{t('settings.integrations.intro')}</p>

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.integrations.installed')}</h3>
        {installed.length === 0 ? (
          <p className={css.settingNote}>{t('settings.integrations.installedEmpty')}</p>
        ) : (
          <ul className={ic.list}>
            {installed.map((item) => (
              <InstalledItem key={item.id} item={item} repoName={repoName(item.repoUrl)} />
            ))}
          </ul>
        )}
      </div>

      <div className={css.divider} />

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.integrations.available')}</h3>
        {available.length === 0 ? (
          <p className={css.settingNote}>{t('settings.integrations.availableEmpty')}</p>
        ) : (
          <ul className={ic.list}>
            {available.map(({ integration, repo }) => (
              <li key={`${repo.url}#${integration.id}`} className={ic.card}>
                <div className={ic.head}>
                  <IconTile name={integration.name} />
                  <div className={ic.info}>
                    <span className={ic.nameRow}>
                      <span className={ic.name}>{integration.name}</span>
                      {runsCode(integration.permissions) && <CodeBadge t={t} />}
                    </span>
                    <span className={ic.muted}>{integration.description}</span>
                    <span className={ic.muted}>
                      {t('settings.integrations.versionSource', {
                        version: integration.version,
                        repo: repo.name,
                      })}
                    </span>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setConsent({ integration, repo })}
                  >
                    {t('settings.integrations.install')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={css.divider} />

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.integrations.repositories')}</h3>
        <p className={css.settingNote}>{t('settings.integrations.repositoriesNote')}</p>
        <form
          className={ic.addRow}
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim() && !adding) void add();
          }}
        >
          <div className={ic.addInput} aria-live="polite">
            <Input
              aria-label={t('settings.integrations.repoUrl')}
              placeholder="https://example.com/repo.json"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              error={addError || undefined}
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <Button type="submit" variant="primary" size="md" disabled={!url.trim()} loading={adding}>
            {t('settings.integrations.add')}
          </Button>
        </form>
        {repos.length > 0 && (
          <ul className={ic.list}>
            {repos.map((repo) => (
              <RepositoryItem key={repo.url} repo={repo} />
            ))}
          </ul>
        )}
      </div>

      <ConsentDialog
        integration={consent?.integration ?? null}
        repo={consent?.repo ?? null}
        onClose={() => setConsent(null)}
      />
    </div>
  );
}
