import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, RefreshCw, Sparkles, Users, X } from 'lucide-react';
import type { MealPlanDto, PlanFeedbackSchema } from '../../../../packages/domain/src/meal-planning-api';
import type { z } from 'zod';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { mealPlanningApi } from '../../services/meal-planning';
import { ApiError } from '../../services/http';
import { queryKeys } from '../../lib/queryKeys';
import { plannerCopy, type PlannerLocale } from './copy';
import { formatQuantity, ingredientLabel, reasonLabel } from './presentation';
import { PlannerError } from './PlannerShell';
import type { usePlanner } from './usePlanner';

export function PlannerMeal({ plan, slotId, model, locale }: {
  plan: MealPlanDto; slotId: string; model: ReturnType<typeof usePlanner>; locale: PlannerLocale;
}) {
  const t = plannerCopy[locale];
  const navigate = useNavigate();
  const location = useLocation();
  const meal = plan.result.meals.find((item) => item.slotId === slotId);
  const [swapOpen, setSwapOpen] = useState(false);
  const [receipts, setReceipts] = useState<string[]>([]);
  const [explanation, setExplanation] = useState<Awaited<ReturnType<typeof mealPlanningApi.explanation>> | null>(null);
  const [aiFailed, setAiFailed] = useState(false);
  const alternatives = useQuery({ queryKey: [...queryKeys.mealPlanningAlternatives(plan.id, slotId), plan.revision],
    queryFn: () => mealPlanningApi.alternatives(plan.id, plan.revision), enabled: swapOpen, retry: false });
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!swapOpen) return;
    const trigger = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, [swapOpen]);

  if (!meal) return <Card><p>{t.mealUnavailable}</p><Link to={`/planner/${plan.id}`} className="underline min-h-11 inline-flex items-center">{t.back}</Link></Card>;
  const swappedHere = location.state?.swappedRevision === plan.revision && location.state?.swappedSlot === slotId;
  async function feedback(type: z.infer<typeof PlanFeedbackSchema>['type']) {
    const input = { revision: plan.revision, slotId, type };
    const result = await model.perform(type, () => mealPlanningApi.feedback(plan.id, input, model.requestKey(input)));
    if (result) {
      setReceipts((prior) => [...new Set([...prior, type])]);
      await model.query.refetch();
    }
  }
  const codes = explanation?.reasonCodes ?? meal.reasons;
  return <>
    <Link className="inline-flex items-center gap-2 min-h-11 text-sm text-takosan-green-deep font-semibold" to={`/planner/${plan.id}`}><ArrowLeft size={16} />{t.back}</Link>
    <Card className="!p-5 sm:!p-6">
      <p className="text-xs font-bold text-takosan-green-deep uppercase tracking-wide">{t[meal.mealType]} · {meal.date}</p>
      <h2 className="text-2xl font-heading font-bold text-slate-900 mt-2 leading-tight">{meal.title}</h2>
      <div className="flex gap-5 text-sm text-slate-600 mt-4"><span className="inline-flex items-center gap-1"><Users size={16} />{meal.servings} {t.people}</span><span className="inline-flex items-center gap-1"><Clock size={16} />{meal.cookTimeMinutes === null ? t.unknownTime : `${meal.cookTimeMinutes} ${t.minutes}`}</span></div>
      <Button className="mt-5" fullWidth variant="secondary" disabled={!!model.busy || plan.freshness.reasons.includes('planning_time_elapsed')} onClick={() => setSwapOpen(true)}><RefreshCw size={16} className="mr-2" />{t.swap}</Button>
    </Card>
    <Card><h3 className="font-heading font-bold text-lg">{t.ingredients}</h3>
      <ul className="divide-y divide-slate-100 mt-2">{meal.requirements.map((item, index) => <li key={`${item.ingredientId}:${index}`} className="py-4">
        <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold text-sm">{ingredientLabel(item.ingredientId, locale)}{item.optional && <span className="block text-xs text-slate-500 font-normal">{t.optional}</span>}</span><span className="text-sm font-semibold">{formatQuantity(item.required, locale)}</span></div>
        <p className="text-xs text-slate-600 mt-2">{t.covered}: {formatQuantity(item.covered, locale)}</p>
        {item.status === 'unresolved' || item.missing === null ? <p className="mt-2 text-sm text-amber-900">{t.unresolved}</p>
          : item.status !== 'satisfied' && <p className={`text-xs mt-2 ${item.optional ? 'text-slate-500' : 'text-amber-900'}`}>{t.missing}: {formatQuantity(item.missing, locale)}</p>}
      </li>)}</ul>
      <p className="text-xs text-slate-500 border-t pt-3">{t.safety}</p>
    </Card>
    <Card><h3 className="font-heading font-bold text-lg">{t.instructions}</h3>{meal.instructions.length ? <ol className="mt-4 space-y-4 list-decimal pl-5 text-sm leading-relaxed text-slate-700">{meal.instructions.map((step, index) => <li key={index} className="pl-1">{step}</li>)}</ol> : <p className="mt-3 text-sm text-slate-500">{t.noInstructions}</p>}<p className="mt-5 text-xs text-slate-500">{t.nutrition}</p></Card>
    <Card><h3 className="font-heading font-bold text-lg">{t.reasons}</h3><ul className="space-y-2 mt-3 text-sm text-slate-700">{codes.map((code, index) => <li key={`${code}:${index}`}>{reasonLabel(code, locale)}</li>)}</ul>
      <Button variant="outline" className="mt-4" disabled={!!model.busy} onClick={async () => {
        setAiFailed(false);
        const response = await model.perform('explain', () => mealPlanningApi.explanation(plan.id, { revision: plan.revision, slotId, locale }));
        if (response) setExplanation(response); else setAiFailed(true);
      }}><Sparkles size={16} className="mr-2" />{t.explain}</Button>
      {model.busy === 'explain' && <p role="status" className="text-sm mt-2">{t.explaining}</p>}
      {(explanation || aiFailed) && <p role="status" className="text-xs text-takosan-green-deep mt-3">{explanation?.source === 'ai' ? t.aiUsed : t.fallback}</p>}
      <p className="text-xs text-slate-500 mt-3">{t.aiNote}</p>
    </Card>
    <Card><h3 className="font-heading font-bold text-lg">{t.feedback}</h3><div className="grid grid-cols-2 gap-2 mt-4">{(['liked', 'disliked', 'cooked', 'skipped', ...(swappedHere ? ['swapped' as const] : [])] as const).map((type) =>
      <Button key={type} variant={receipts.includes(type) ? 'secondary' : 'outline'} disabled={!!model.busy || receipts.includes(type)} onClick={() => void feedback(type)}>{receipts.includes(type) ? `${t.feedbackSaved}: ` : ''}{t[type]}</Button>)}</div><p className="text-xs text-slate-500 mt-3">{t.cookedNote}</p></Card>
    {swapOpen && <dialog ref={dialog} onCancel={(event) => { if (model.busy) event.preventDefault(); else setSwapOpen(false); }} onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (first && ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last))) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }} aria-labelledby="swap-title" className="w-[calc(100%-2rem)] max-w-lg max-h-[85dvh] rounded-2xl p-0 shadow-xl backdrop:bg-slate-950/50">
      <div className="p-5"><div className="flex items-start justify-between gap-2"><h2 id="swap-title" className="font-heading font-bold text-xl">{t.chooseAlternative}</h2><Button variant="ghost" aria-label={t.cancel} disabled={!!model.busy} onClick={() => setSwapOpen(false)}><X size={18} /></Button></div>
        <p className="text-xs text-slate-600 mt-2 mb-4 leading-relaxed">{t.alternativeNote}</p>
        {alternatives.data?.truncated && <p className="text-xs text-amber-900 mb-3">{t.alternativesLimited}</p>}
        {alternatives.isPending ? <p role="status">{t.loading}</p> : alternatives.isError ? <PlannerError error={alternatives.error} locale={locale} onRetry={() => {
          if (alternatives.error instanceof ApiError && alternatives.error.status === 409) {
            void model.perform('refresh', () => mealPlanningApi.get(plan.id), model.replacePlan);
          } else void alternatives.refetch();
        }} /> : <ul className="space-y-2">
          {alternatives.data?.alternatives.filter((item) => item.id !== meal.source.id).map((item) => <li key={item.id} className="border border-slate-200 rounded-xl p-3 flex items-center gap-3 justify-between"><span className="text-sm font-semibold">{item.title}</span><Button disabled={!!model.busy} variant="secondary" aria-label={`${t.choose}: ${item.title}`} onClick={async () => {
            const next = await model.perform('swap', () => mealPlanningApi.swap(plan.id, { revision: plan.revision, slotId, replacement: { kind: 'recipe', id: item.id } }), model.replacePlan);
            if (next) { setSwapOpen(false); navigate(`/planner/${plan.id}/meal/${encodeURIComponent(slotId)}`, { replace: true, state: { swappedRevision: next.revision, swappedSlot: slotId } }); }
          }}>{t.choose}</Button></li>)}
          {!alternatives.data?.alternatives.some((item) => item.id !== meal.source.id) && <li className="text-sm">{t.noAlternatives}</li>}
        </ul>}
        {model.busy === 'swap' && <p role="status" className="text-sm mt-3">{t.swapping}</p>}
        {!!model.error && <div className="mt-3"><PlannerError error={model.error} locale={locale} /></div>}
      </div>
    </dialog>}
  </>;
}
