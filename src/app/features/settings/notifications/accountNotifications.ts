import {
  PushRuleKind,
  PushRuleActionName,
  TweakName,
  type IPushRule,
  type IPushRules,
  type MatrixClient,
  type PushRuleAction,
} from 'matrix-js-sdk';

export type NotifRowLevel = 'off' | 'on' | 'noisy';

export interface ManagedRule {
  ruleId: string;
  kind: PushRuleKind;
}

const USER_MENTION_RULES: ManagedRule[] = [
  { ruleId: '.m.rule.is_user_mention', kind: PushRuleKind.Override },
];

const DISPLAY_NAME_RULES: ManagedRule[] = [
  { ruleId: '.m.rule.contains_display_name', kind: PushRuleKind.Override },
];

const ROOM_MENTION_RULES: ManagedRule[] = [
  { ruleId: '.m.rule.is_room_mention', kind: PushRuleKind.Override },
];

const ROOM_NOTIF_RULES: ManagedRule[] = [
  { ruleId: '.m.rule.roomnotif', kind: PushRuleKind.Override },
];

const CONTAINS_USER_NAME_RULES: ManagedRule[] = [
  { ruleId: '.m.rule.contains_user_name', kind: PushRuleKind.ContentSpecific },
];

export const DM_RULES: ManagedRule[] = [
  { ruleId: '.m.rule.room_one_to_one', kind: PushRuleKind.Underride },
  { ruleId: '.m.rule.encrypted_room_one_to_one', kind: PushRuleKind.Underride },
];

export const ROOM_RULES: ManagedRule[] = [
  { ruleId: '.m.rule.message', kind: PushRuleKind.Underride },
  { ruleId: '.m.rule.encrypted', kind: PushRuleKind.Underride },
];

const rulesOfKind = (rules: IPushRules, kind: PushRuleKind): IPushRule[] =>
  rules.global?.[kind] ?? [];

const findManagedRule = (rules: IPushRules, managed: ManagedRule): IPushRule | undefined =>
  rulesOfKind(rules, managed.kind).find((r) => r.rule_id === managed.ruleId);

function isMutedActions(actions: PushRuleAction[] | undefined): boolean {
  return !actions?.length || actions.includes(PushRuleActionName.DontNotify);
}

function isSoundTweak(action: PushRuleAction): boolean {
  return typeof action === 'object' && action !== null && action.set_tweak === TweakName.Sound;
}

function hasSoundTweak(actions: PushRuleAction[] | undefined): boolean {
  return (actions ?? []).some(isSoundTweak);
}

function notifyActions(actions: PushRuleAction[] | undefined, sound: boolean): PushRuleAction[] {
  const tweaks = (actions ?? []).filter((a) => typeof a === 'object' && a !== null);
  const hasSound = tweaks.some(isSoundTweak);

  let result = tweaks;
  if (sound && !hasSound) {
    result = [...tweaks, { set_tweak: TweakName.Sound, value: 'default' }];
  } else if (!sound && hasSound) {
    result = tweaks.filter((a) => !isSoundTweak(a));
  }

  return [PushRuleActionName.Notify, ...result];
}

export function deriveRowLevel(
  rules: IPushRules | undefined,
  managed: ManagedRule[]
): NotifRowLevel {
  if (!rules) return 'on';

  const present = managed.map((m) => findManagedRule(rules, m)).filter((r): r is IPushRule => !!r);

  const audible = present.filter((r) => r.enabled && !isMutedActions(r.actions));
  if (audible.length === 0) return 'off';

  const anySound = audible.some((r) => hasSoundTweak(r.actions));
  return anySound ? 'noisy' : 'on';
}

export async function setRowLevel(
  client: MatrixClient,
  rules: IPushRules,
  managed: ManagedRule[],
  level: NotifRowLevel
): Promise<void> {
  const sound = level === 'noisy';
  for (const m of managed) {
    const rule = findManagedRule(rules, m);
    if (!rule) continue;

    if (!rule.enabled) {
      await client.setPushRuleEnabled('global', m.kind, m.ruleId, true);
    }

    if (level === 'off') {
      await client.setPushRuleActions('global', m.kind, m.ruleId, []);
      continue;
    }

    await client.setPushRuleActions('global', m.kind, m.ruleId, notifyActions(rule.actions, sound));
  }
}

export function getUserMentionRules(rules: IPushRules | undefined): ManagedRule[] {
  if (!rules) return [];
  return [...USER_MENTION_RULES, ...DISPLAY_NAME_RULES, ...CONTAINS_USER_NAME_RULES].filter((m) =>
    findManagedRule(rules, m)
  );
}

export function getRoomMentionRules(rules: IPushRules | undefined): ManagedRule[] {
  if (!rules) return [];
  return [...ROOM_MENTION_RULES, ...ROOM_NOTIF_RULES].filter((m) => findManagedRule(rules, m));
}

export function listKeywordRules(rules: IPushRules | undefined): IPushRule[] {
  if (!rules) return [];
  return rulesOfKind(rules, PushRuleKind.ContentSpecific).filter((r) => !r.rule_id.startsWith('.'));
}

export const normalizeKeyword = (keyword: string): string => keyword.trim();

export async function addKeywordRule(client: MatrixClient, keyword: string): Promise<void> {
  const existing = (await client.getPushRules()).global?.content?.find(
    (r) => r.rule_id === keyword
  );
  if (existing) {
    await client.setPushRuleEnabled('global', PushRuleKind.ContentSpecific, keyword, true);
    return;
  }
  await client.addPushRule('global', PushRuleKind.ContentSpecific, keyword, {
    actions: [PushRuleActionName.Notify, { set_tweak: TweakName.Highlight, value: true }],
    pattern: keyword,
  });
}

export async function removeKeywordRule(client: MatrixClient, keyword: string): Promise<void> {
  await client.deletePushRule('global', PushRuleKind.ContentSpecific, keyword);
}
