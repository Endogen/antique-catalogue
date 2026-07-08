/**
 * Format a metadata number for display. Digit grouping is disabled because
 * metadata numbers are often years or identifiers ("1947", not "1.947"),
 * while the decimal separator stays locale-aware.
 */
export const formatMetadataNumber = (locale: string, value: number): string =>
  new Intl.NumberFormat(locale, { useGrouping: false }).format(value);
