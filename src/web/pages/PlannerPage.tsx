import React from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { Card } from '../components/common/Card';
import { PlannerShell, PlannerError, FreshnessNotice } from '../features/planner/PlannerShell';
import { PlannerSetup } from '../features/planner/PlannerSetup';
import { PlannerWeek } from '../features/planner/PlannerWeek';
import { PlannerMeal } from '../features/planner/PlannerMeal';
import { PlannerShopping } from '../features/planner/PlannerShopping';
import { usePlanner } from '../features/planner/usePlanner';
import { usePlannerLocale } from '../features/planner/copy';

export const PlannerPage: React.FC = () => {
  const { planId, slotId } = useParams<{ planId: string; slotId: string }>();
  const location = useLocation();
  const setup = location.pathname === '/planner/new';
  const language = usePlannerLocale();
  const { locale, copy: t } = language;
  const model = usePlanner(planId, !setup);
  const plan = model.plan;
  if (!setup && !planId && plan) return <Navigate to={`/planner/${plan.id}`} replace />;
  return <PlannerShell {...language} plan={setup ? null : plan}>
    {!!model.error && <PlannerError error={model.error} locale={locale} />}
    {model.refreshed && <p role="status" className="text-sm text-takosan-green-deep bg-takosan-mint p-3 rounded-xl">{t.updated}</p>}
    {setup ? <PlannerSetup model={model} locale={locale} /> : model.query.isPending ? <div role="status" className="py-16 text-center text-takosan-green-deep"><CalendarDays className="mx-auto mb-4 animate-pulse" size={36} /><p>{t.loading}</p></div>
      : model.query.isError ? <><PlannerError error={model.query.error} locale={locale} onRetry={() => void model.query.refetch()} /><Link to="/planner" className="underline min-h-11 inline-flex items-center text-sm">{t.back}</Link></>
      : !plan ? <Card className="text-center !py-10"><CalendarDays className="mx-auto mb-5 text-takosan-green" size={40} /><h2 className="text-xl font-heading font-bold">{t.empty}</h2><p className="mt-3 text-sm text-semantic-text-secondary leading-relaxed">{t.emptyText}</p><Link to="/planner/new" className="inline-flex min-h-12 mt-6 items-center justify-center rounded-xl bg-takosan-green px-5 py-3 text-sm font-semibold text-white">{t.newPlan}</Link></Card>
      : <><FreshnessNotice plan={plan} locale={locale} />{slotId ? <PlannerMeal key={`${plan.id}:${plan.revision}:${slotId}`} plan={plan} slotId={slotId} model={model} locale={locale} />
        : location.pathname.endsWith('/shopping') ? <PlannerShopping key={`${plan.id}:${plan.revision}`} plan={plan} model={model} locale={locale} />
          : <PlannerWeek plan={plan} model={model} locale={locale} />}</>}
  </PlannerShell>;
};
