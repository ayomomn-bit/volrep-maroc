export type Money = { amount: string; currencyCode: string };

// Drizzle returns `numeric` columns as strings (avoids float precision
// loss) — this just pairs that string with a currency code. Never do
// arithmetic on the *returned* string; compute with numbers first, then
// format once at the response boundary via this function.
export function toMoney(amount: string | number, currencyCode: string): Money {
  const value = typeof amount === "number" ? amount : Number(amount);
  return { amount: value.toFixed(2), currencyCode };
}
