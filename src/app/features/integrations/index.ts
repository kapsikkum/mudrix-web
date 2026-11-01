export * from './manifest';
export * from './types';
export * from './matching';
export * from './store';
export { parseRepoUrl, fetchRepo } from './repository';
export {
  base64ToBytes,
  fingerprintKey,
  verifyRepoSignature,
  checkSerial,
  checkRepoUpdate,
  isOfficialKey,
} from './signature';
export type { SigResult, RepoUpdateCheck } from './signature';
export { OFFICIAL_REPO_URL, OFFICIAL_REPO_KEYS } from './officialKeys';
export { runSignatureExamples } from './signature.examples';
export { runCustomEventExamples } from './customEvents.examples';
export {
  MAX_WIDGET_EVENTS,
  MAX_CUSTOM_EVENT_CONTENT,
  checkEventType,
  isDeclaredEventType,
  validateCustomEventContent,
} from './customEvents';
export { fetchIconDataUrl } from './icons';
export { previewApiRequest, callApi } from './api';
export type { ApiContext, ApiIntegration, ApiPreview, ApiCallResult } from './api';
export * from './widgetCapabilities';
export {
  WIDGET_SANDBOX,
  WIDGET_ALLOW,
  isSameOriginAsApp,
  assertWidgetUrlAllowed,
  buildWidgetUrl,
  resolveCapabilities,
  customEventCapabilities,
} from './widget';
export type { WidgetUrlCheck, WidgetUrlContext } from './widget';
export { runBehaviourExamples } from './behaviour.examples';
export { runManifestExamples } from './manifest.examples';

if (import.meta.env.DEV) {
  void import('./devChecks').then((m) => m.runDevChecks());
}
