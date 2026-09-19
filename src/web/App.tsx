import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { SessionBoundary } from './components/common/SessionBoundary';
import { RouteFallback } from './components/common/RouteFallback';
import { useAuthStore } from './stores/useAuthStore';
import { AppLayout } from './components/layout/AppLayout';
import { isMealPlannerEnabled } from './features/planner/feature';
import { MotionProvider } from './design-system/motion';

const PlannerPage = lazy(() => import('./pages/PlannerPage').then((m) => ({ default: m.PlannerPage })));

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })),
);
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const OnboardingPage = lazy(() =>
  import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })),
);
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const InventoryPage = lazy(() =>
  import('./pages/InventoryPage').then((m) => ({ default: m.InventoryPage })),
);
const IngredientDetailPage = lazy(() =>
  import('./pages/IngredientDetailPage').then((m) => ({ default: m.IngredientDetailPage })),
);
const ReconciliationPage = lazy(() =>
  import('./pages/ReconciliationPage').then((m) => ({ default: m.ReconciliationPage })),
);
const ScanPage = lazy(() => import('./pages/ScanPage').then((m) => ({ default: m.ScanPage })));
const ScanResultPage = lazy(() =>
  import('./pages/ScanResultPage').then((m) => ({ default: m.ScanResultPage })),
);
const ReceiptReviewPage = lazy(() =>
  import('./pages/ReceiptReviewPage').then((m) => ({ default: m.ReceiptReviewPage })),
);
const RecipesPage = lazy(() =>
  import('./pages/RecipesPage').then((m) => ({ default: m.RecipesPage })),
);
const RecipeDetailPage = lazy(() =>
  import('./pages/RecipeDetailPage').then((m) => ({ default: m.RecipeDetailPage })),
);
const CookingModePage = lazy(() =>
  import('./pages/CookingModePage').then((m) => ({ default: m.CookingModePage })),
);
const CookingCompletePage = lazy(() =>
  import('./pages/CookingCompletePage').then((m) => ({ default: m.CookingCompletePage })),
);
const ShoppingPage = lazy(() =>
  import('./pages/ShoppingPage').then((m) => ({ default: m.ShoppingPage })),
);
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const FamilySharingPage = lazy(() =>
  import('./pages/FamilySharingPage').then((m) => ({ default: m.FamilySharingPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const PlusPaywallPage = lazy(() =>
  import('./pages/PlusPaywallPage').then((m) => ({ default: m.PlusPaywallPage })),
);
const FoodPreferencesPage = lazy(() =>
  import('./pages/settings/FoodPreferencesPage').then((m) => ({ default: m.FoodPreferencesPage })),
);
const PlanningSettingsPage = lazy(() =>
  import('./pages/settings/PlanningSettingsPage').then((m) => ({ default: m.PlanningSettingsPage })),
);
const NotificationPreferencesPage = lazy(() =>
  import('./pages/settings/NotificationPreferencesPage').then((m) => ({ default: m.NotificationPreferencesPage })),
);
const PrivacyDataPage = lazy(() =>
  import('./pages/settings/PrivacyDataPage').then((m) => ({ default: m.PrivacyDataPage })),
);
const WeekDashboardPage = lazy(() =>
  import('./pages/WeekDashboardPage').then((m) => ({ default: m.WeekDashboardPage })),
);
const WeekSetupPage = lazy(() =>
  import('./pages/WeekSetupPage').then((m) => ({ default: m.WeekSetupPage })),
);
const WeekGeneratingPage = lazy(() =>
  import('./pages/WeekGeneratingPage').then((m) => ({ default: m.WeekGeneratingPage })),
);
const MealDetailPage = lazy(() =>
  import('./pages/MealDetailPage').then((m) => ({ default: m.MealDetailPage })),
);
const WeekShoppingPage = lazy(() =>
  import('./pages/WeekShoppingPage').then((m) => ({ default: m.WeekShoppingPage })),
);
const WeekSettingsPage = lazy(() =>
  import('./pages/WeekSettingsPage').then((m) => ({ default: m.WeekSettingsPage })),
);

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed)
      return (
        <main className="min-h-screen p-6 space-y-4 text-center">
          <h1 className="text-xl font-bold" role="alert">
            Không thể mở trang này
          </h1>
          <p>Vui lòng tải lại ứng dụng để thử lại.</p>
          <button
            className="rounded-xl bg-takosan-green px-4 py-3 text-white"
            onClick={() => window.location.reload()}
          >
            Tải lại
          </button>
        </main>
      );
    return this.props.children;
  }
}

// Week → Planner compatibility redirects preserve route params. `Navigate`
// does not interpolate params, so each redirect reads them explicitly.
const WeekHomeRedirect: React.FC = () => <Navigate to="/planner" replace />;
const WeekSetupRedirect: React.FC = () => <Navigate to="/planner/new" replace />;
const WeekPlanRedirect: React.FC = () => {
  const { planId } = useParams();
  return <Navigate to={`/planner/${planId ?? ''}`} replace />;
};
const WeekMealRedirect: React.FC = () => {
  const { planId, mealId } = useParams();
  return <Navigate to={`/planner/${planId ?? ''}/meal/${mealId ?? ''}`} replace />;
};
const WeekShoppingRedirect: React.FC = () => {
  const { planId } = useParams();
  return <Navigate to={`/planner/${planId ?? ''}/shopping`} replace />;
};

export const App: React.FC = () => {
  const { isGuest, isOnboarded, userId, householdId } = useAuthStore();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <MotionProvider>
        <AppErrorBoundary key={`${userId}:${householdId}`}>
          <SessionBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes key={`${userId}:${householdId}`}>
                {/* Public / Intro Routes */}
                <Route path="/landing" element={userId && householdId
                  ? <Navigate to={isOnboarded ? '/' : '/onboarding'} replace />
                  : <LandingPage />} />
                <Route path="/auth" element={userId && householdId && !isGuest
                  ? <Navigate to={isOnboarded ? '/' : '/onboarding'} replace />
                  : <AuthPage />} />
                <Route path="/onboarding" element={userId && householdId
                  ? isOnboarded ? <Navigate to="/" replace /> : <OnboardingPage />
                  : <Navigate to="/landing" replace />} />
                {/* Kit step routes (screens 04-06); same server-authoritative flow. */}
                <Route path="/onboarding/household" element={userId && householdId
                  ? isOnboarded ? <Navigate to="/" replace /> : <OnboardingPage initialStep={1} />
                  : <Navigate to="/landing" replace />} />
                <Route path="/onboarding/preferences" element={userId && householdId
                  ? isOnboarded ? <Navigate to="/" replace /> : <OnboardingPage initialStep={2} />
                  : <Navigate to="/landing" replace />} />
                <Route path="/onboarding/goals" element={userId && householdId
                  ? isOnboarded ? <Navigate to="/" replace /> : <OnboardingPage initialStep={3} />
                  : <Navigate to="/landing" replace />} />

                {/* Core App Shell */}
                <Route
                  element={
                    userId && householdId ? <AppLayout /> : <Navigate to="/landing" replace />
                  }
                >
                  <Route
                    path="/"
                    element={isOnboarded ? <HomePage /> : <Navigate to="/onboarding" replace />}
                  />

                  {/* Fridge / Inventory */}
                  <Route path="/fridge" element={<InventoryPage />} />
                  <Route path="/inventory" element={<Navigate to="/fridge" replace />} />
                  <Route path="/fridge/:id" element={<IngredientDetailPage />} />
                  <Route path="/ingredients/:id" element={<IngredientDetailPage />} />
                  <Route path="/inventory/:id" element={<IngredientDetailPage />} />
                  <Route path="/inventory-reconciliation" element={<ReconciliationPage />} />

                  {/* AI Scan & Review */}
                  <Route path="/scan" element={<ScanPage />} />
                  <Route path="/scan/:id/review" element={<ScanResultPage />} />
                  <Route path="/scan/receipt-review" element={<ReceiptReviewPage />} />
                  <Route path="/scan/result" element={<ScanResultPage />} />

                  {/* Recipes & Cooking */}
                  <Route path="/recipes" element={<RecipesPage />} />
                  <Route path="/recipes/:slug" element={<RecipeDetailPage />} />
                  <Route path="/recipes/id/:id" element={<RecipeDetailPage />} />
                  <Route path="/cook/:slug" element={<CookingModePage />} />
                  <Route path="/cooking/:id" element={<CookingModePage />} />
                  <Route path="/cooking/complete" element={<CookingCompletePage />} />

                  {/* Planner is canonical when enabled; Week stays the visible
                      compatibility surface while the flag is off. Params are
                      preserved in both redirect directions. */}
                  <Route path="/week" element={isMealPlannerEnabled() ? <WeekHomeRedirect /> : <WeekDashboardPage />} />
                  <Route path="/week/setup" element={isMealPlannerEnabled() ? <WeekSetupRedirect /> : <WeekSetupPage />} />
                  <Route path="/week/generating" element={isMealPlannerEnabled() ? <Navigate to="/planner" replace /> : <WeekGeneratingPage />} />
                  <Route path="/week/:planId" element={isMealPlannerEnabled() ? <WeekPlanRedirect /> : <WeekDashboardPage />} />
                  <Route path="/week/:planId/meal/:mealId" element={isMealPlannerEnabled() ? <WeekMealRedirect /> : <MealDetailPage />} />
                  <Route path="/week/:planId/shopping" element={isMealPlannerEnabled() ? <WeekShoppingRedirect /> : <WeekShoppingPage />} />
                  <Route path="/week/:planId/settings" element={isMealPlannerEnabled() ? <Navigate to="/settings/planning" replace /> : <WeekSettingsPage />} />
                  <Route path="/planner" element={isMealPlannerEnabled() ? <PlannerPage /> : <Navigate to="/week" replace />} />
                  <Route path="/planner/new" element={isMealPlannerEnabled() ? <PlannerPage /> : <Navigate to="/week" replace />} />
                  <Route path="/planner/:planId" element={isMealPlannerEnabled() ? <PlannerPage /> : <Navigate to="/week" replace />} />
                  <Route path="/planner/:planId/meal/:slotId" element={isMealPlannerEnabled() ? <PlannerPage /> : <Navigate to="/week" replace />} />
                  <Route path="/planner/:planId/shopping" element={isMealPlannerEnabled() ? <PlannerPage /> : <Navigate to="/week" replace />} />

                  {/* Shopping, Profile/Me, Settings, Notifications, Plus, Household */}
                  <Route path="/shopping" element={<ShoppingPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/me" element={<ProfilePage />} />
                  <Route path="/profile" element={<Navigate to="/me" replace />} />
                  <Route path="/me/preferences" element={<FoodPreferencesPage />} />
                  <Route path="/family" element={<Navigate to="/me/household" replace />} />
                  <Route path="/me/household" element={<FamilySharingPage />} />
                  <Route path="/settings" element={<Navigate to="/settings/app" replace />} />
                  <Route path="/settings/app" element={<SettingsPage />} />
                  <Route path="/settings/notifications" element={<NotificationPreferencesPage />} />
                  <Route path="/settings/planning" element={<PlanningSettingsPage />} />
                  <Route path="/settings/privacy" element={<PrivacyDataPage />} />
                  <Route path="/plus" element={<PlusPaywallPage />} />
                </Route>

                {/* Catch-all fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </SessionBoundary>
        </AppErrorBoundary>
        </MotionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};
