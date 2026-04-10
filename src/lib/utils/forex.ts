export async function fetchLiveRate(fromCurrency: string, toCurrency: string = 'INR'): Promise<number> {
  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
  if (!appId) throw new Error('OPEN_EXCHANGE_RATES_APP_ID not configured');

  const res = await fetch(
    `https://openexchangerates.org/api/latest.json?app_id=${appId}&symbols=${fromCurrency},${toCurrency}`
  );
  if (!res.ok) throw new Error('Failed to fetch exchange rates');

  const data = await res.json();
  const rates = data.rates as Record<string, number>;

  // OER returns rates relative to USD
  if (fromCurrency === 'USD') {
    return rates[toCurrency] || 1;
  }
  if (toCurrency === 'USD') {
    return 1 / (rates[fromCurrency] || 1);
  }
  // Cross rate
  const fromUSD = rates[fromCurrency] || 1;
  const toUSD = rates[toCurrency] || 1;
  return toUSD / fromUSD;
}

export function convertCurrency(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

export function calculateDriftPct(lockedRate: number, currentRate: number): number {
  if (lockedRate === 0) return 0;
  return ((currentRate - lockedRate) / lockedRate) * 100;
}
