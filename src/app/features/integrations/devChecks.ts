/**
 * Development builds run the integrations fixtures once at startup and report failures in the
 * console, so a rule that stops holding is noticed without a separate test runner.
 */
import { runBehaviourExamples } from './behaviour.examples';
import { runCustomEventExamples } from './customEvents.examples';
import { runManifestExamples } from './manifest.examples';
import { runSignatureExamples } from './signature.examples';

export async function runDevChecks(): Promise<void> {
  const failed: Record<string, string[]> = {
    manifest: runManifestExamples(),
    customEvents: runCustomEventExamples(),
    behaviour: runBehaviourExamples(),
    signature: await runSignatureExamples(),
  };
  Object.entries(failed).forEach(([group, names]) => {
    if (names.length > 0) console.error(`[integrations] ${group} fixtures failed:`, names);
  });
}
