import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { mealPlanningApi } from '../../services/meal-planning';
import { plannerCopy, type PlannerLocale } from './copy';
import { buildPlanningIntent, localDate } from './intent';
import type { usePlanner } from './usePlanner';

export const plannerInputClass = 'block w-full min-h-11 mt-1 rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:ring-2 focus:ring-takosan-green focus:outline-none';

export function PlannerSetup({ model, locale }: { model: ReturnType<typeof usePlanner>; locale: PlannerLocale }) {
  const t = plannerCopy[locale];
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(() => { const next = new Date(); next.setDate(next.getDate() + 1); return localDate(next); });
  const [days, setDays] = useState(7);
  const [servings, setServings] = useState(2);
  const [meals, setMeals] = useState<Array<'breakfast' | 'lunch' | 'dinner'>>(['dinner']);
  const [mode, setMode] = useState<'shopping_allowed' | 'cook_now'>('shopping_allowed');
  const [maxTime, setMaxTime] = useState('');
  const [invalid, setInvalid] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setInvalid(false);
    let intent;
    try { intent = buildPlanningIntent({ startDate, days, servings, meals, mode, maxTime, offset: -new Date().getTimezoneOffset() }); }
    catch { setInvalid(true); return; }
    const plan = await model.perform('generate', () => mealPlanningApi.generate(intent, model.requestKey(intent)), (result) => {
      model.replacePlan(result);
      model.retireRequestKey(intent);
    });
    if (plan) navigate(`/planner/${plan.id}`, { replace: true });
  }
  return <Card>
    <div className="flex items-center gap-3 mb-5"><span className="p-3 rounded-2xl bg-takosan-mint text-takosan-green-deep"><CalendarDays /></span><h2 className="text-xl font-heading font-bold text-slate-900">{t.newPlan}</h2></div>
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={!!model.busy} className="space-y-5 disabled:opacity-70">
        <label className="block text-sm font-semibold">{t.date}<input type="date" required min={localDate()} value={startDate} onChange={(e) => setStartDate(e.target.value)} className={plannerInputClass} /></label>
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm font-semibold">{t.days}<input type="number" min={1} max={14} required value={days} onChange={(e) => setDays(Number(e.target.value))} className={plannerInputClass} /></label>
          <label className="text-sm font-semibold">{t.servings}<input type="number" min={1} max={20} required value={servings} onChange={(e) => setServings(Number(e.target.value))} className={plannerInputClass} /></label>
        </div>
        <fieldset><legend className="text-sm font-semibold mb-2">{t.slots}</legend><div className="grid grid-cols-3 gap-2">
          {(['breakfast', 'lunch', 'dinner'] as const).map((type) => <label key={type} className={`flex flex-col sm:flex-row items-center gap-2 p-3 rounded-xl border text-sm cursor-pointer ${meals.includes(type) ? 'bg-takosan-mint border-takosan-green text-takosan-green-deep' : 'border-slate-200'}`}>
            <input type="checkbox" checked={meals.includes(type)} onChange={(e) => setMeals(e.target.checked ? [...meals, type] : meals.filter((item) => item !== type))} className="accent-takosan-green w-4 h-4" />{t[type]}
          </label>)}
        </div></fieldset>
        <label className="block text-sm font-semibold">{t.mode}<select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={plannerInputClass}><option value="shopping_allowed">{t.allowShopping}</option><option value="cook_now">{t.cookNow}</option></select></label>
        <label className="block text-sm font-semibold">{t.maxTime}<input type="number" min={1} max={1440} value={maxTime} onChange={(e) => setMaxTime(e.target.value)} className={plannerInputClass} /></label>
      </fieldset>
      <div className="text-xs text-slate-600 leading-relaxed space-y-2"><p>{t.future}</p><p>{t.policy}</p><p>{t.timezone}</p></div>
      {invalid && <p role="alert" className="text-sm text-rose-700">{t.invalidForm}</p>}
      <Button type="submit" fullWidth size="lg" isLoading={!!model.busy}>{t.generate}</Button>
      {model.busy && <p role="status" className="text-sm text-center text-takosan-green-deep">{t.generating}</p>}
    </form>
  </Card>;
}
