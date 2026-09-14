import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ShoppingBag } from 'lucide-react';
import type { MealPlanDto } from '../../../../packages/domain/src/meal-planning-api';
import { plannerCopy, type PlannerLocale } from './copy';
import { freshnessReasonLabel, plannerErrorMessage } from './presentation';
import { Button } from '../../components/common/Button';

export function PlannerShell({ children, plan, locale, setLocale }: {
  children: React.ReactNode; plan?: MealPlanDto | null; locale: PlannerLocale; setLocale: (locale: PlannerLocale) => void;
}) {
  const t = plannerCopy[locale];
  return <div className="min-h-screen pb-8" lang={locale}>
    <header className="border-b border-slate-200/70 bg-white px-4 py-4 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-takosan-green-deep min-h-11"><ArrowLeft size={17} />{t.home}</Link>
        <label className="text-xs text-slate-600">Language
          <select aria-label="Language" className="ml-2 min-h-11 rounded-lg border border-slate-200 bg-white px-2" value={locale} onChange={(e) => setLocale(e.target.value as PlannerLocale)}>
            <option value="vi">Tiếng Việt</option><option value="en">English</option>
          </select>
        </label>
      </div>
      <p className="text-[11px] tracking-[0.18em] font-bold text-takosan-green mt-3">{t.eyebrow}</p>
      <h1 className="text-2xl sm:text-3xl font-heading font-bold text-takosan-green mt-1 leading-tight">{t.title}</h1>
      <p className="text-sm text-slate-600 mt-2 leading-relaxed">{t.intro}</p>
      {plan && <nav aria-label={t.week} className="flex gap-2 mt-5">
        {[{ to: `/planner/${plan.id}`, label: t.week, icon: CalendarDays, end: true },
          { to: `/planner/${plan.id}/shopping`, label: t.shopping, icon: ShoppingBag, end: false }].map(({ to, label, icon: Icon, end }) =>
          <NavLink key={to} end={end} to={to} className={({ isActive }) => `flex flex-1 items-center justify-center gap-2 min-h-11 px-3 py-2 rounded-xl text-sm font-semibold ${isActive ? 'bg-takosan-green text-white' : 'bg-slate-100 text-slate-700'}`}><Icon size={17} />{label}</NavLink>)}
      </nav>}
    </header>
    <div className="p-4 sm:p-6 space-y-5">{children}</div>
    <footer className="px-5 text-xs text-slate-500 leading-relaxed"><p>{t.planNote}</p><Link className="inline-block underline min-h-11 py-3" to="/week">{t.legacy}</Link></footer>
  </div>;
}

export function PlannerError({ error, locale, onRetry }: { error: unknown; locale: PlannerLocale; onRetry?: () => void }) {
  return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
    <p>{plannerErrorMessage(error, locale)}</p>
    {onRetry && <Button className="mt-3" variant="outline" onClick={onRetry}>{plannerCopy[locale].retry}</Button>}
  </div>;
}

export function FreshnessNotice({ plan, locale }: { plan: MealPlanDto; locale: PlannerLocale }) {
  if (plan.freshness.status === 'fresh') return null;
  const t = plannerCopy[locale];
  const past = plan.freshness.reasons.includes('planning_time_elapsed');
  return <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 space-y-2">
    <h2 className="font-semibold">{t.staleTitle}</h2><p className="text-sm">{past ? t.historical : t.staleText}</p>
    <ul className="text-xs space-y-1">{plan.freshness.reasons.map((code) => <li key={code}>{freshnessReasonLabel(code, locale)}</li>)}</ul>
    <Link className="inline-flex underline min-h-11 items-center text-sm font-semibold" to="/planner/new">{t.newPlan}</Link>
  </section>;
}
