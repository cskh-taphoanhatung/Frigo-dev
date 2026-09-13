export async function seedT13ReconciliationEvidence(db, householdId, userId, recordObservation) {
  const now = new Date().toISOString();
  const ids = [];
  for (const [key, ingredientId, rawName, quantity, unit] of [
    ['egg', 'CHICKEN_EGG', 'Trứng kiểm kê thử nghiệm', 5, 'piece'],
    ['tofu', 'TOFU', 'Đậu phụ kiểm kê thử nghiệm', 450, 'g'],
  ]) {
    const result = await recordObservation(db, { householdId, actorId: userId }, {
      sourceType: 'SCAN', sourceRef: `t13b-reconciliation-${key}`, observedAt: now,
      ingredientId, rawName, legacyItemId: `preview-stock-${key}`, evidence: 'CONFIRMED',
      claim: { quantity, unit, quantityMilli: null, canonicalUnit: null, storage: null,
        expiryDate: null, expiryKind: null, openedAt: null },
    }, now);
    ids.push(result.observation.observationId);
  }
  return { observationIds: ids };
}
