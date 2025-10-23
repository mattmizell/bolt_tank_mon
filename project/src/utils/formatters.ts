/**
 * Format hours to a human-readable string
 * Returns "N/A", hours with 1 decimal, days, or years depending on magnitude
 */
export const formatHoursTo10Inches = (hours: number | undefined): string => {
  if (hours === undefined || hours === null || isNaN(hours)) return 'N/A';

  // Handle zero or negative (tank not consuming)
  if (hours <= 0) return 'N/A';

  // For very large numbers, round to nearest 1000 and show appropriately
  if (hours >= 10000) {
    const rounded = Math.round(hours / 1000) * 1000;
    return `~${(rounded / 8760).toFixed(1)} years`;
  }

  // For more than 30 days, show in days
  if (hours > 720) {
    return `${Math.round(hours / 24)} days`;
  }

  // Normal hours display (caller will add "hrs" suffix)
  return hours.toFixed(1);
};
