import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Clock, RefreshCw, Users } from 'lucide-react';
import type { MealPlanDto } from '../../../../packages/domain/src/meal-planning-api';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { mealPlanningApi } from '../../services/meal-planning';
import { plannerCopy, type PlannerLocale } from './copy';
import { plannerStatusLabel, plannerConclusionLabel, reasonLabel } from './presentation';
import type { usePlanner } from './usePlanner';

export function PlannerWeek({ plan, model, locale }: { plan: MealPlanDto; model: ReturnType<typeof usePlanner>; locale: PlannerLocale }) {
  const t = plannerCopy[locale];
  const [confirm, setConfirm] = useState(false);
  const days = [...new Set(plan.intent.slots.map((slot) => slot.date))].sort();
  const past = plan.freshness.reasons.includes('planning_time_elapsed');
  return <>
    <div className="flex flex-wrap justify-between gap-3 items-center">
      <div><p className="text-sm font-semibold text-takosan-green-deep">{plannerStatusLabel(plan.result.status, locale)}</p><p className="text-xs text-semantic-text-muted mt-1">{plan.result.meals.length} {t.meals} · {t.revision} <span data-testid="plan-revision">{plan.revision}</span></p></div>
      <Link className="text-sm underline font-semibold min-h-11 flex items-center text-takosan-green-deep" to="/planner/new">{t.newPlan}</Link>
    </div>
    {plan.result.conclusion !== 'feasible' && <Card><p role="status" className="text-sm leading-relaxed">{plannerConclusionLabel(plan.result.conclusion, locale)}</p><Link to="/planner/new" className="inline-flex min-h-11 items-center text-takosan-green-deep underline text-sm">{t.settings}</Link></Card>}
    {plan.result.search.truncated && <p className="text-sm rounded-xl bg-semantic-info-soft p-3 text-semantic-info">{t.limited}</p>}
    {days.map((date) => <section key={date} className="space-y-3">
      <h2 className="flex gap-2 items-center text-sm font-bold text-semantic-text-secondary"><CalendarDays size={16} />{new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}</h2>
      {plan.result.meals.filter((meal) => meal.date === date).map((meal) => <Card key={meal.slotId} className="!p-0 overflow-hidden" data-testid="planned-meal">
        <Link to={`/planner/${plan.id}/meal/${encodeURIComponent(meal.slotId)}`} className="block p-4 sm:p-5 hover:bg-takosan-mint/30 transition-colors">
          <div className="flex justify-between items-center mb-2"><span className="text-[11px] font-bold uppercase tracking-wide text-takosan-green-deep">{t[meal.mealType]} · {meal.time}</span><ChevronRight size={17} className="text-semantic-text-muted" /></div>
          <h3 className="text-lg font-heading font-bold text-semantic-text-primary leading-snug">{meal.title}</h3>
          <div className="flex flex-wrap gap-4 text-xs text-semantic-text-secondary mt-3"><span className="flex items-center gap-1"><Users size={14} />{meal.servings} {t.people}</span><span className="flex items-center gap-1"><Clock size={14} />{meal.cookTimeMinutes === null ? t.unknownTime : `${meal.cookTimeMinutes} ${t.minutes}`}</span></div>
          <p className="text-xs mt-3 text-takosan-green-deep">{meal.requirements.some((item) => !item.optional && item.status === 'unresolved') ? t.quantityReview : meal.requirements.some((item) => !item.optional && item.status !== 'satisfied') ? t.needsShopping : t.available}</p>
          {meal.reasons.length > 0 && <p className="text-xs text-semantic-text-muted mt-2">{reasonLabel(meal.reasons[0], locale)}</p>}
        </Link>
      </Card>)}
      {plan.result.unplannedSlots.filter((slot) => slot.date === date).map((slot) => <div className="rounded-2xl border border-dashed border-semantic-warning/50 p-4 bg-semantic-warning-soft/50" key={slot.slotId}><h3 className="text-sm font-semibold">{t[slot.mealType]} · {t.unplanned}</h3><ul className="text-xs text-semantic-text-secondary mt-2 space-y-1">{slot.reasons.map((code) => <li key={code}>{reasonLabel(code, locale)}</li>)}</ul></div>)}
    </section>)}
    <details className="text-sm text-semantic-text-secondary rounded-xl border border-semantic-border bg-white p-4"><summary className="cursor-pointer font-semibold min-h-6">{t.diagnostics}</summary><p className="mt-3 text-xs">{t.rejectionNote}</p><ul className="mt-3 space-y-2">{[...new Set([...plan.result.search.limitReasons, ...plan.result.search.incompleteReasons.map((item) => item.code), ...plan.result.search.rejections.map((item) => item.code)])].map((code) => <li key={code}>{reasonLabel(code, locale)}</li>)}</ul><p className="mt-3 text-xs">{t.safety}</p></details>
    <Button variant="outline" fullWidth disabled={!!model.busy || past} onClick={() => setConfirm(true)}><RefreshCw size={16} className="mr-2" />{t.regenerate}</Button>
    {model.busy === 'regenerate' && <p role="status" className="text-sm text-takosan-green-deep">{t.generating}</p>}
    <ConfirmDialog open={confirm} title={t.regenerateTitle} description={t.regenerateText} confirmText={t.confirm} cancelText={t.cancel} onCancel={() => setConfirm(false)} onConfirm={() => {
      setConfirm(false);
      void model.perform('regenerate', () => mealPlanningApi.regenerate(plan.id, { revision: plan.revision }), model.replacePlan);
    }} />
  </>;
}
