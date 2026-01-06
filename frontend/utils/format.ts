export const formatCurrency = (
  value: number | undefined | null,
  currencyCode: string = "USD",
): string => {
  if (value === undefined || value === null) return "-";

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch (e) {
    // Fallback if currency code is invalid
    return `${currencyCode} ${value.toFixed(2)}`;
  }
};

export const formatNumber = (value: number | undefined | null): string => {
  if (value === undefined || value === null) return "-";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatCompactNumber = (
  value: number | undefined | null,
  currencyCode?: string,
): string => {
  if (value === undefined || value === null) return "-";

  const num = new Intl.NumberFormat(undefined, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);

  if (currencyCode) {
    // Simple prefix/suffix logic is risky with Intl, creating a separate formatter is better
    // But for compact notation + currency, Intl is tricky.
    // Let's manually append symbol if possible, or just use code.
    // E.g. $1.5B or 1.5B SEK

    // Attempt to get symbol
    const symbol = getCurrencySymbol(currencyCode);
    if (currencyCode === "USD" || currencyCode === "GBP" || currencyCode === "EUR") {
      return `${symbol}${num}`;
    }
    return `${num} ${currencyCode}`;
  }

  return num;
};

const getCurrencySymbol = (currency: string): string => {
  try {
    return (0)
      .toLocaleString(undefined, {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
      .replace(/\d/g, "")
      .trim();
  } catch {
    return currency;
  }
};
