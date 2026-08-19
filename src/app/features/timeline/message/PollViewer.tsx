import { useState, useEffect, useCallback, useMemo } from 'react';
import type { MatrixClient, MatrixEvent, Relations } from 'matrix-js-sdk';
import {
  M_POLL_START,
  M_POLL_RESPONSE,
  M_POLL_KIND_DISCLOSED,
  M_TEXT,
  MatrixEventEvent,
  PollEvent,
} from 'matrix-js-sdk';
import { ChartBarHorizontalIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import * as css from './PollViewer.css';

interface PollViewerProps {
  event: MatrixEvent;
  client: MatrixClient;
}

export interface Answer {
  id: string;
  label: string;
}

export interface PollData {
  questionText: string;
  answers: Answer[];
  kind: string | undefined;
  maxSelections: number;
  raw: Record<string, unknown>;
}

function extractText(obj: Record<string, unknown> | undefined): string | undefined {
  if (!obj) return undefined;

  const mtext = M_TEXT.findIn(obj);
  if (typeof mtext === 'string') return mtext;
  if (Array.isArray(mtext) && mtext.length > 0) {
    const first = mtext[0] as Record<string, unknown>;
    if (typeof first.body === 'string') return first.body;
  }

  if (typeof obj.body === 'string') return obj.body;
  return undefined;
}

export function extractPollData(event: MatrixEvent): PollData {
  const raw = event.getContent() as Record<string, unknown>;

  const pollSection =
    M_POLL_START.findIn<Record<string, unknown>>(raw) ??
    (raw['org.matrix.msc3381.poll.start'] as Record<string, unknown> | undefined) ??
    (raw['m.poll'] as Record<string, unknown> | undefined);

  const kind = pollSection?.kind as string | undefined;

  const maxSelections =
    typeof pollSection?.max_selections === 'number' && pollSection.max_selections >= 1
      ? (pollSection.max_selections as number)
      : 1;

  const questionText =
    extractText(pollSection?.question as Record<string, unknown> | undefined) ??
    (raw.body as string) ??
    '';

  const rawAnswers = (pollSection?.answers as Record<string, unknown>[]) ?? [];
  const answers: Answer[] = rawAnswers.slice(0, 20).map((a) => ({
    id: (a['m.id'] as string) ?? (a.id as string) ?? '',
    label: extractText(a) ?? (a.id as string) ?? '',
  }));

  return { questionText, answers, kind, maxSelections, raw };
}

function extractResponseAnswers(event: MatrixEvent): string[] {
  const rc = event.getContent() as Record<string, unknown>;

  const unstableSection = rc['org.matrix.msc3381.poll.response'] as
    | Record<string, unknown>
    | undefined;
  const responseSection = M_POLL_RESPONSE.findIn<Record<string, unknown>>(rc) ?? {};

  return (
    (unstableSection?.answers as string[]) ??
    (responseSection.answers as string[]) ??
    (responseSection['m.selections'] as string[]) ??
    (rc['m.selections'] as string[]) ??
    []
  );
}

export function PollViewer({ event, client }: PollViewerProps) {
  const roomId = event.getRoomId();
  const eventId = event.getId();
  const room = client?.getRoom(roomId ?? '') ?? null;
  const poll = room?.polls.get(eventId ?? '') ?? null;

  const [responses, setResponses] = useState<MatrixEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [voting, setVoting] = useState(false);
  const [replacedVersion, setReplacedVersion] = useState(0);
  const [isEnded, setIsEnded] = useState(() => poll?.isEnded ?? false);
  const { t } = useTranslation();

  // Re-read poll data when an edit (m.replace) is applied
  useEffect(() => {
    const onReplaced = () => setReplacedVersion((v) => v + 1);
    event.on(MatrixEventEvent.Replaced, onReplaced);
    return () => {
      event.off(MatrixEventEvent.Replaced, onReplaced);
    };
  }, [event]);

  useEffect(() => {
    if (!poll) {
      setLoaded(true);
      return;
    }

    poll
      .getResponses()
      .then((r: Relations) => {
        setResponses(r.getRelations());
        setLoaded(true);
      })
      .catch(() => setLoaded(true));

    const onResponses = (r: Relations) => setResponses(r.getRelations());
    poll.on(PollEvent.Responses, onResponses);
    const onEnd = () => setIsEnded(true);
    poll.on(PollEvent.End, onEnd);
    return () => {
      poll.off(PollEvent.Responses, onResponses);
      poll.off(PollEvent.End, onEnd);
    };
  }, [poll]);

  const { questionText, answers, kind, maxSelections } = useMemo(
    () => extractPollData(event),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event, replacedVersion]
  );

  const isDisclosed = kind ? M_POLL_KIND_DISCLOSED.matches(kind) : false;
  const myId = client?.getUserId() ?? '';

  const validAnswerIds = useMemo(() => new Set(answers.map((a) => a.id)), [answers]);

  const voteCounts = useMemo(() => {
    type Entry = { ts: number; opts: string[] };
    const perUser = new Map<string, Entry>();
    for (const r of responses) {
      const sender = r.getSender() ?? '';
      if (r.isDecryptionFailure()) continue;
      const ts = r.getTs();
      const prev = perUser.get(sender);
      if (prev && ts < prev.ts) continue;

      const rawOpts = extractResponseAnswers(r);
      const truncated = rawOpts.slice(0, maxSelections);
      const allValid = truncated.every((opt) => validAnswerIds.has(opt));
      perUser.set(sender, { ts, opts: allValid ? truncated : [] });
    }

    const counts = new Map<string, number>();
    for (const { opts } of perUser.values()) {
      for (const opt of opts) {
        counts.set(opt, (counts.get(opt) ?? 0) + 1);
      }
    }
    return counts;
  }, [responses, maxSelections, validAnswerIds]);

  const totalVotes = useMemo(() => {
    type Entry = { ts: number; opts: string[] };
    const perUser = new Map<string, Entry>();
    for (const r of responses) {
      const sender = r.getSender() ?? '';
      if (r.isDecryptionFailure()) continue;
      const ts = r.getTs();
      const prev = perUser.get(sender);
      if (prev && ts < prev.ts) continue;
      const rawOpts = extractResponseAnswers(r);
      const truncated = rawOpts.slice(0, maxSelections);
      const allValid = truncated.every((opt) => validAnswerIds.has(opt));
      perUser.set(sender, { ts, opts: allValid ? truncated : [] });
    }
    let count = 0;
    for (const { opts } of perUser.values()) {
      if (opts.length > 0) count++;
    }
    return count;
  }, [responses, maxSelections, validAnswerIds]);

  const myVote = useMemo(() => {
    let latest: MatrixEvent | null = null;
    for (const r of responses) {
      if (r.getSender() === myId && !r.isDecryptionFailure()) {
        if (!latest || r.getTs() > latest.getTs()) latest = r;
      }
    }
    if (!latest) return null;
    return extractResponseAnswers(latest);
  }, [responses, myId]);

  const handleVote = useCallback(
    async (optionId: string) => {
      if (!client || !roomId || !eventId || voting) return;
      setVoting(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any).sendEvent(roomId, 'm.poll.response', {
          'm.selections': [optionId],
          'm.relates_to': { rel_type: 'm.reference', event_id: eventId },
        });
      } catch {
        // vote failed silently
      } finally {
        setVoting(false);
      }
    },
    [client, roomId, eventId, voting]
  );

  if (!questionText && !loaded) {
    return <span className={css.loadingText}>{t('timeline.poll.loading')}</span>;
  }

  const showResults = isDisclosed || isEnded;
  const canVote = !isEnded && !voting && !!poll;

  return (
    <div className={css.container}>
      <div className={css.header}>
        <ChartBarHorizontalIcon size={18} className={css.icon} weight="fill" />
        <span className={css.question}>{questionText || t('timeline.poll.title')}</span>
      </div>

      {answers.length === 0 && (
        <span className={css.loadingText}>{t('timeline.poll.noOptions')}</span>
      )}

      {answers.map((option) => {
        const count = voteCounts.get(option.id) ?? 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const isSelected = myVote?.includes(option.id) ?? false;

        return (
          <div
            key={option.id}
            className={`${css.optionRow}${isSelected ? ` ${css.optionRowSelected}` : ''}${!canVote ? ` ${css.optionRowEnded}` : ''}`}
            onClick={() => (canVote ? handleVote(option.id) : undefined)}
            role={canVote ? 'radio' : undefined}
            aria-checked={canVote ? isSelected : undefined}
            tabIndex={canVote ? 0 : undefined}
            onKeyDown={
              canVote
                ? (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleVote(option.id);
                    }
                  }
                : undefined
            }
          >
            {showResults && totalVotes > 0 && (
              <div className={css.progressBar} style={{ width: `${pct}%` }} />
            )}

            <div className={css.optionContent}>
              <div
                className={`${css.radioCircle}${isSelected ? ` ${css.radioCircleSelected}` : ''}`}
              />
              <span className={css.optionLabel}>{option.label}</span>
              {showResults && (
                <span className={css.voteCount}>
                  {t('timeline.poll.vote', { count })} | {pct}%
                </span>
              )}
            </div>
          </div>
        );
      })}

      <div className={css.footer}>
        <span>{t('timeline.poll.vote', { count: totalVotes })}</span>
        {!isDisclosed && !isEnded && <span>| {t('timeline.poll.resultsHidden')}</span>}
        {isEnded && <span className={css.endedBadge}>{t('timeline.poll.ended')}</span>}
      </div>
    </div>
  );
}
