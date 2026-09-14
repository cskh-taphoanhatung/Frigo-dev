import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import type { MealPlanDto, PlanShoppingDtoSchema } from '../../../../packages/domain/src/meal-planning-api';
import type { MoneyDto } from '../../../../packages/domain/src/meal-shopping-api';
import type { z } from 'zod';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { mealPlanningApi } from '../../services/meal-planning';
import { queryKeys } from '../../lib/queryKeys';
import { plannerCopy, type PlannerLocale } from './copy';
import { budgetStatusLabel, formatMoney, formatQuantity, ingredientLabel, parseBudgetMinorAmount, reasonLabel, shoppingStatusLabel, wasteRiskLabel } from './presentation';
import { plannerInputClass } from './PlannerSetup';
import type { usePlanner } from './usePlanner';

type Shopping = z.infer<typeof PlanShoppingDtoSchema>;
export function PlannerShopping({ plan, model, locale }: { plan: MealPlanDto; model: ReturnType<typeof usePlanner>; locale: PlannerLocale }) {
  const t = plannerCopy[locale];
  const client = useQueryClient();
  const [currency, setCurrency] = useState<MoneyDto['currency']>('VND');
  const [budget, setBudget] = useState('');
  const [mode, setMode] = useState<'hard' | 'soft'>('hard');
  const [invalid, setInvalid] = useState(false);
  const key = [...queryKeys.mealPlanningShopping(plan.id), plan.revision, currency, budget, mode];
  const shopping = useQuery<Shopping>({ queryKey: key, queryFn: skipToken, enabled: false, retry: false });
  const fresh = plan.freshness.status === 'fresh';
  const response = fresh && !model.busy && !model.error && shopping.data?.planRevision === plan.revision ? shopping.data : null;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setInvalid(false);
    const minor = budget.trim() ? parseBudgetMinorAmount(budget, currency, locale) : null;
    if (budget.trim() && minor === null) { setInvalid(true); return; }
    await model.perform('shopping', () => mealPlanningApi.shopping(plan.id, { revision: plan.revision, currency,
      ...(minor === null ? {} : { budget: { mode, money: { currency, minorAmount: minor } } }),
    }), (result) => client.setQueryData(key, result));
  }
  return <>
    <Card><h2 className="font-heading font-bold text-xl flex items-center gap-2"><ShoppingBag className="text-emerald-800" />{t.shopping}</h2><p className="text-sm text-slate-600 mt-2 leading-relaxed">{t.shoppingIntro}</p>
      <form onSubmit={submit} className="space-y-4 mt-5"><fieldset disabled={!!model.busy || !fresh} className="space-y-4 disabled:opacity-60">
        <div className="grid grid-cols-[100px_1fr] gap-3"><label className="text-sm font-semibold">{t.currency}<select value={currency} onChange={(e) => setCurrency(e.target.value as MoneyDto['currency'])} className={plannerInputClass}>{['VND', 'JPY', 'USD', 'EUR'].map((value) => <option key={value}>{value}</option>)}</select></label><label className="text-sm font-semibold">{t.budget}<input inputMode="decimal" value={budget} maxLength={100} onChange={(e) => setBudget(e.target.value)} className={plannerInputClass} placeholder="—" /></label></div>
        <label className="block text-sm font-semibold">{t.budgetMode}<select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={plannerInputClass}><option value="hard">{t.hard}</option><option value="soft">{t.soft}</option></select></label>
      </fieldset>
        {invalid && <p role="alert" className="text-sm text-rose-700">{t.budgetInvalid}</p>}
        <Button fullWidth type="submit" disabled={!fresh} isLoading={!!model.busy}>{t.optimize}</Button>
      </form>
      {model.busy === 'shopping' && <p role="status" className="text-sm mt-3 text-emerald-800">{t.optimizing}</p>}
    </Card>
    {response && <ShoppingResult key={response.result.id} response={response} locale={locale} />}
    {!fresh && <Link className="inline-flex min-h-11 items-center underline text-sm text-emerald-800" to={`/planner/${plan.id}`}>{t.back}</Link>}
  </>;
}

export function ShoppingResult({ response, locale }: { response: Shopping; locale: PlannerLocale }) {
  const t = plannerCopy[locale];
  const result = response.result;
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const complete = result.cost.status === 'known' && result.cost.totalCost !== null && result.shoppingCompleteness === 'complete';
  return <div className="space-y-5" data-testid="shopping-result">
    <section className="rounded-2xl bg-takosan-green text-white p-5 sm:p-6 space-y-3" aria-label={t.knownTotal}>
      <h2 className="text-sm text-emerald-100">{complete ? t.completeTotal : t.knownTotal}</h2>
      {result.cost.status === 'unknown' ? <p className="font-semibold text-lg leading-snug">{t.priceUnavailable}</p> : <p className="text-3xl font-heading font-bold break-all">{formatMoney(complete ? result.cost.totalCost : result.cost.knownCost, locale)}</p>}
      {result.cost.unknownCostItemCount > 0 && <p className="text-sm text-amber-100">{result.cost.unknownCostItemCount} {t.unknownPrices}</p>}
      <p className="text-sm font-semibold border-t border-white/20 pt-3" data-testid="budget-status">{budgetStatusLabel(result.budget.status, locale)}</p>
      <p className="text-sm" data-testid="shopping-status">{shoppingStatusLabel(result.shoppingStatus, locale)}</p>
      {result.budget.status === 'over_budget' && <p className="text-sm">{t.gap}: {formatMoney(result.budget.selectedKnownGap, locale)}</p>}
      {!result.optimization.exhaustive && <p className="text-xs text-emerald-100">{t.bestKnown}</p>}
    </section>
    {response.catalogStatus === 'reviewed_catalog_unavailable' && <p className="text-sm bg-amber-50 rounded-xl p-4 text-amber-950">{t.noPrices}</p>}
    {result.shoppingCompleteness !== 'complete' && <p className="text-sm bg-amber-50 rounded-xl p-4 text-amber-950">{t.shoppingPartial}</p>}
    <section className="space-y-3"><h2 className="font-heading text-lg font-bold">{t.list}</h2><p className="text-xs text-slate-500">{t.checklistNote}</p>
      {[...result.requirements, ...result.optionalRequirements].map((requirement) => {
        const line = result.purchaseLines.find((item) => item.requirementId === requirement.id);
        const unresolved = result.unresolvedRequirements.find((item) => item.requirementId === requirement.id);
        return <Card key={requirement.id}>
          <label className="flex gap-3 items-start cursor-pointer min-h-11"><input type="checkbox" className="mt-1 w-5 h-5 accent-emerald-700 shrink-0" checked={checked.has(requirement.id)} onChange={(e) => setChecked((prior) => { const next = new Set(prior); if (e.target.checked) next.add(requirement.id); else next.delete(requirement.id); return next; })} />
            <span className="min-w-0"><span className="font-semibold text-sm">{ingredientLabel(requirement.ingredientId, locale)}</span>{requirement.optional && <span className="block text-xs text-slate-500">{t.optional}</span>}<span className="block text-sm mt-1">{t.required}: {formatQuantity(requirement.required, locale)}</span></span>
          </label>
          {requirement.status === 'unresolved' && <p className="text-sm text-amber-900 mt-2">{t.unresolved}</p>}
          {line && line.selectedPackages.length > 0 ? <div className="mt-3 border-t border-slate-100 pt-3 text-sm space-y-2">
            <p className="text-xs font-semibold text-slate-500">{t.selectedPackages}</p>
            {line.selectedPackages.map((pack) => <p key={pack.purchaseOptionId} className="flex flex-wrap justify-between gap-2"><span>{pack.packageCount} × {formatQuantity(pack.packageContent, locale)}</span><span>{formatMoney(pack.lineCost, locale)}</span></p>)}
            <p className="text-xs text-slate-600">{t.surplus}: {formatQuantity(line.surplus, locale)}</p>
          </div> : <p className="text-xs text-amber-900 mt-2">{requirement.optional ? t.optionalNotPurchased : unresolved ? reasonLabel(unresolved.code, locale) : t.priceUnavailable}</p>}
          <p className="mt-3 text-xs text-slate-500">{[...new Set(requirement.sourceMealSlots.map((slot) => slot.date))].join(' · ')}</p>
        </Card>;
      })}
      {!result.requirements.length && !result.optionalRequirements.length && <Card><p className="text-sm">{t.noShopping}</p></Card>}
    </section>
    {result.budget.largestKnownCostDrivers.length > 0 && <Card><h2 className="font-heading font-bold">{t.largestCosts}</h2><ul className="space-y-3 mt-3 text-sm">{result.budget.largestKnownCostDrivers.map((item) => <li key={item.ingredientId} className="flex justify-between gap-3"><span>{ingredientLabel(item.ingredientId, locale)}</span><span className="break-all">{formatMoney(item.knownCost, locale)}</span></li>)}</ul></Card>}
    <Card><h2 className="font-heading font-bold">{t.waste}</h2><div className="text-sm text-slate-600 mt-3 space-y-2">
      {result.wasteSummary.existingAtRiskLotCount > 0 || result.wasteSummary.purchaseAtRiskSurplusCount > 0 ? <p>{t.wasteAtRisk}</p> : result.wasteSummary.assessedItemCount > 0 && <p>{t.wasteNone}</p>}
      {(result.wasteSummary.unknownRiskItemCount > 0 || result.wasteSummary.assessedItemCount === 0) && <p>{t.wasteUnknown}</p>}
      <p>{t.wasteNote}</p>
      {result.purchaseSurplus.map((item) => <p key={`${item.requirementId}:${item.purchaseOptionId}`} className="text-xs">{ingredientLabel(item.ingredientId, locale)}: {formatQuantity(item.quantity, locale)} · {wasteRiskLabel(item.risk.status, locale)}</p>)}
    </div></Card>
    {(result.optimization.truncated || result.optimization.incompleteReasons.length > 0) && <details className="text-sm border border-slate-200 p-4 rounded-xl"><summary className="font-semibold cursor-pointer">{t.diagnostics}</summary><p className="mt-2">{t.bestKnown}</p><ul className="mt-2 text-xs space-y-1">{[...new Set([...result.optimization.limitReasons, ...result.optimization.incompleteReasons])].map((code) => <li key={code}>{reasonLabel(code, locale)}</li>)}</ul></details>}
    <p className="text-xs text-slate-500">{t.priceAsOf} {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(response.priceAsOf))}. {t.checklistNote}</p>
  </div>;
}
