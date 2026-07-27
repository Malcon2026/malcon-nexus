/** Km incentive brackets (applied to an employee's period total kms). */
export const KM_INCENTIVE_TIER1_THRESHOLD = 1000;
export const KM_INCENTIVE_TIER2_THRESHOLD = 1800;
export const KM_INCENTIVE_TIER1_RATE = 3; // ₹/km for km above 1000 up to 1800
export const KM_INCENTIVE_TIER2_RATE = 4; // ₹/km for km above 1800

export const KM_INCENTIVE_RULE_LABEL =
  `₹${KM_INCENTIVE_TIER1_RATE}/km above ${KM_INCENTIVE_TIER1_THRESHOLD.toLocaleString('en-IN')} km · ₹${KM_INCENTIVE_TIER2_RATE}/km above ${KM_INCENTIVE_TIER2_THRESHOLD.toLocaleString('en-IN')} km`;

/**
 * Marginal brackets on period total kms:
 * - first 1000 km → ₹0
 * - km 1001–1800 → ₹3/km
 * - km above 1800 → ₹4/km
 */
export function calculateKmIncentive(totalKms: number): number {
  const kms = Math.max(0, Number(totalKms) || 0);
  if (kms <= KM_INCENTIVE_TIER1_THRESHOLD) return 0;
  if (kms <= KM_INCENTIVE_TIER2_THRESHOLD) {
    return (kms - KM_INCENTIVE_TIER1_THRESHOLD) * KM_INCENTIVE_TIER1_RATE;
  }
  const tier1Kms = KM_INCENTIVE_TIER2_THRESHOLD - KM_INCENTIVE_TIER1_THRESHOLD;
  const tier2Kms = kms - KM_INCENTIVE_TIER2_THRESHOLD;
  return tier1Kms * KM_INCENTIVE_TIER1_RATE + tier2Kms * KM_INCENTIVE_TIER2_RATE;
}
