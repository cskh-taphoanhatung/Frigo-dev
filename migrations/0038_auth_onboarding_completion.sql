-- T16: persist onboarding completion as account/guest profile state. Existing
-- users remain incomplete until they explicitly finish the preferences flow.
ALTER TABLE profiles ADD COLUMN onboarding_completed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed
  ON profiles(onboarding_completed_at)
  WHERE onboarding_completed_at IS NOT NULL;
