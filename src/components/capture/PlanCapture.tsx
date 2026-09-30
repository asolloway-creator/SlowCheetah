'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import type { CompPlan } from '@/lib/calc';
import { track, trackOnce } from '@/lib/track';
import { mapRecord, mergeFormIntoRecord, recordFromPlan, type Topic } from '@/lib/plan-record/map';
import { applyAnswer, GAP_WORDS } from '@/lib/plan-record/copy';
import { NO_CHOICES, type CalcChoices, type PlanContext, type PlanRecord } from '@/lib/plan-record/schema';
import {
  addContext,
  confirmPlan,
  forgetPlans,
  markContributed,
  readDescription,
  type Asked,
  type SignedRead,
} from '@/lib/plan-record/client';
import PlanSentence from '@/components/PlanSentence';
import DescribeStep, { type Ask, type DescribeMessage } from './DescribeStep';
import CheckStep from './CheckStep';
import SavedStep from './SavedStep';
import PlanSummary from './PlanSummary';

/**
 * Putting a plan in: describe it (typed or spoken), check it, confirm it.
 * The numbers form is still one tap away for anyone who'd rather. The
 * working plan is saved through `onSave` (the browser store in the demo, the
 * account when signed in); the confirmed record is filed separately and
 * never blocks the person if filing fails.
 */

type Step = 'summary' | 'describe' | 'check' | 'form' | 'saved';

const MESSAGES = {
  too_vague: 'We need a bit more to go on. Tell us what counts toward your quota, what a deal pays you, and what changes when you hit it.',
  document: 'That looks like text from a plan document. Tell us how you get paid in your own words instead, and leave the document out.',
  not_a_plan: 'That doesn’t read like a pay plan. Tell us how your commission works.',
  busy: 'We’re reading a lot of plans right now. Give it a minute and try again.',
  unavailable: 'Reading plans is paused right now. You can fill in the numbers yourself instead.',
  too_long: 'That’s a little long. Keep it to the rules and the numbers.',
  refused: 'We couldn’t read that one. Try rewording it, or fill in the numbers yourself.',
  failed: 'We couldn’t read that one. Try again, or fill in the numbers yourself.',
  offline: 'You look offline. Check your connection and try again.',
} as const;

/** ?ask=open or ?ask=guided, for comparing the two ways of asking on a preview. */
const askFromUrl = (): Ask | null => {
  const v = new URLSearchParams(window.location.search).get('ask');
  return v === 'open' || v === 'guided' ? v : null;
};
const noop = () => () => {};

export default function PlanCapture({
  current,
  onSave,
  account,
  compact = false,
  onDone,
  doneLabel = 'See what your deals pay',
}: {
  /** The working plan, if the person already has one of their own. */
  current: CompPlan | null;
  onSave: (p: CompPlan) => Promise<{ error?: string }>;
  account: boolean;
  /** Inside the dialog over the deal: no summary, a smaller frame. */
  compact?: boolean;
  onDone?: () => void;
  doneLabel?: string;
}) {
  const ctx = account ? 'account' : 'own';
  const router = useRouter();
  const askParam = useSyncExternalStore(noop, askFromUrl, () => null);
  const ask: Ask = askParam ?? 'guided';

  const [step, setStep] = useState<Step>(current && !compact ? 'summary' : 'describe');
  const [record, setRecord] = useState<PlanRecord | null>(null);
  const [read, setRead] = useState<SignedRead | null>(null);
  const [choices, setChoices] = useState<CalcChoices>(NO_CHOICES);
  const [asked, setAsked] = useState<Asked[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<DescribeMessage>(null);
  const [correctMsg, setCorrectMsg] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [filedId, setFiledId] = useState<string | null>(null);
  const [calculable, setCalculable] = useState(true);

  const mapping = useMemo(() => (record ? mapRecord(record, choices) : null), [record, choices]);

  // Same journey step the numbers form used to mark: someone started putting their plan in.
  useEffect(() => {
    trackOnce('plan_form_opened', ctx);
  }, [ctx]);

  const reset = () => {
    setRecord(null);
    setRead(null);
    setChoices(NO_CHOICES);
    setAsked([]);
    setMessage(null);
    setCorrectMsg(null);
    setConfirmError(null);
  };

  async function describe(text: string) {
    setBusy(true);
    setMessage(null);
    const out = await readDescription(text);
    setBusy(false);
    if (out.kind === 'error') return setMessage({ tone: 'error', text: MESSAGES[out.error] });
    if (out.kind === 'document' || out.kind === 'not_a_plan') return setMessage({ tone: 'info', text: MESSAGES[out.kind] });
    track('plan_read', ctx);
    if (out.kind === 'too_vague') {
      const gaps = mapRecord(out.read.record).gaps.slice(0, 3).map((g) => GAP_WORDS[g.topic]);
      return setMessage({
        tone: 'info',
        text: gaps.length ? `We need a bit more to go on. Tell us ${list(gaps)}.` : MESSAGES.too_vague,
      });
    }
    setRecord(out.read.record);
    setRead(out.read);
    setChoices(NO_CHOICES);
    setAsked([]);
    setStep('check');
    window.scrollTo({ top: 0 });
  }

  async function correct(text: string): Promise<boolean> {
    if (!record) return false;
    setBusy(true);
    setCorrectMsg(null);
    const out = await readDescription(text, record);
    setBusy(false);
    if (out.kind === 'error') {
      setCorrectMsg(MESSAGES[out.error]);
      return false;
    }
    if (out.kind !== 'plan') {
      setCorrectMsg('That doesn’t read like a change to your plan. Say what to change, like “it’s 12% after quota.”');
      return false;
    }
    setRecord(out.read.record);
    setCorrectMsg('Updated. Check it again below.');
    return true;
  }

  function answer(topic: Topic, index: number, value: string | number, how: 'answered' | 'corrected') {
    if (!record) return;
    setRecord(applyAnswer(record, topic, index, value, how));
    setAsked((a) => [...a, { topic, how }]);
  }

  async function file(finalRecord: PlanRecord, origin: 'described' | 'form', plan: CompPlan | null) {
    const id = await confirmPlan({ origin, record: finalRecord, choices, read, questions: asked });
    if (id) markContributed(true);
    setFiledId(id);
    setCalculable(plan !== null);
    track('plan_confirmed', ctx);
    setStep('saved');
    window.scrollTo({ top: 0 });
  }

  async function confirm() {
    if (!record || !mapping) return;
    setBusy(true);
    setConfirmError(null);
    if (mapping.plan) {
      const res = await onSave(mapping.plan);
      if (res.error) {
        setBusy(false);
        return setConfirmError(res.error);
      }
    }
    await file(record, 'described', mapping.plan);
    setBusy(false);
  }

  async function saveForm(p: CompPlan) {
    const res = await onSave(p);
    if (res.error) return res;
    const final = record ? mergeFormIntoRecord(record, p) : recordFromPlan(p);
    await file(final, record ? 'described' : 'form', p);
    return {};
  }

  async function context(c: PlanContext) {
    if (filedId) await addContext(filedId, c);
  }

  // In the dialog, back to the deal underneath. On the page, to the deal page,
  // which now runs on this plan.
  const finish = () => {
    reset();
    if (onDone) return onDone();
    if (calculable) return router.push('/');
    setStep(current ? 'summary' : 'describe');
  };

  if (step === 'summary' && current) {
    return (
      <PlanSummary
        plan={current}
        onDescribe={() => {
          reset();
          setStep('describe');
        }}
        onForm={() => setStep('form')}
        onForget={async () => {
          const n = await forgetPlans();
          if (n !== null) markContributed(false);
          return n;
        }}
      />
    );
  }

  if (step === 'form') {
    const start = mapping?.plan ?? current ?? null;
    return (
      <div className={compact ? 'cap-form is-compact' : 'cap-form'}>
        <button type="button" className="btn-text cap-back" onClick={() => setStep(record ? 'check' : current && !compact ? 'summary' : 'describe')}>
          &larr; {record ? 'Back to your plan' : current && !compact ? 'Back' : 'Describe it instead'}
        </button>
        <PlanSentence plan={start} demo={!account} onSave={saveForm} trackAs={ctx} />
        <p className="cap-privacy">
          Saving keeps your plan’s rules, anonymously, as one of at least 10 plans IOI compares. Never your company or your
          deals.
        </p>
      </div>
    );
  }

  if (step === 'check' && record && mapping) {
    return (
      <CheckStep
        record={record}
        mapping={mapping}
        onAnswer={answer}
        onChoose={(k) => setChoices((c) => ({ ...c, [k]: true }))}
        onCorrect={correct}
        correcting={busy}
        correctMessage={correctMsg}
        onConfirm={confirm}
        confirming={busy}
        confirmError={confirmError}
        onForm={() => setStep('form')}
        onStartOver={() => {
          reset();
          setStep('describe');
        }}
      />
    );
  }

  if (step === 'saved') {
    return (
      <SavedStep
        calculable={calculable}
        onContext={filedId ? context : null}
        onDone={finish}
        doneLabel={onDone || calculable ? doneLabel : 'Done'}
      />
    );
  }

  return (
    <DescribeStep
      ask={ask}
      busy={busy}
      message={message}
      onRead={describe}
      onForm={() => setStep('form')}
    />
  );
}

function list(items: string[]) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
