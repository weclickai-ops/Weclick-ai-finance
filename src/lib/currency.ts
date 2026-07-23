export const CURRENCIES = [
  { code: "INR", symbol: "₹",   name: "Indian Rupee" },
  { code: "USD", symbol: "$",   name: "US Dollar" },
  { code: "EUR", symbol: "€",   name: "Euro" },
  { code: "GBP", symbol: "£",   name: "Pound Sterling" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "AUD", symbol: "A$",  name: "Australian Dollar" },
  { code: "CAD", symbol: "C$",  name: "Canadian Dollar" },
  { code: "SGD", symbol: "S$",  name: "Singapore Dollar" },
  { code: "JPY", symbol: "¥",   name: "Japanese Yen" },
  { code: "CHF", symbol: "Fr",  name: "Swiss Franc" },
  { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
  { code: "ZAR", symbol: "R",   name: "South African Rand" },
  { code: "SAR", symbol: "﷼",   name: "Saudi Riyal" },
  { code: "MYR", symbol: "RM",  name: "Malaysian Ringgit" },
  { code: "SEK", symbol: "kr",  name: "Swedish Krona" },
];

export function symbolOf(code: string) {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

/** Format in the invoice's own currency. */
export function amount(n: number, code = "INR") {
  try {
    return new Intl.NumberFormat(code === "INR" ? "en-IN" : "en-US", {
      style: "currency", currency: code,
      minimumFractionDigits: code === "JPY" ? 0 : 2,
      maximumFractionDigits: code === "JPY" ? 0 : 2,
    }).format(n || 0);
  } catch {
    return `${symbolOf(code)}${(n || 0).toFixed(2)}`;
  }
}

/** Convert to the base currency using the rate locked on the record. */
export function toBase(n: number, rate = 1) {
  return (n || 0) * (rate || 1);
}
