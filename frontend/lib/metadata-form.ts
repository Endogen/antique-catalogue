// Timestamps with offsets describe instants; legacy values without offsets are local wall time.
export function timestampInput(value: string): string {
  const raw = value.trim().replace(" ", "T");
  if (!/(Z|[+-]\d\d:\d\d)$/i.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const pad = (n: number, length = 2) => String(n).padStart(length, "0");
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

export function serializeTimestamp(input: string, original: unknown): string {
  if (typeof original === "string" && (input === timestampInput(original) || new Date(input).getTime() === new Date(timestampInput(original)).getTime())) return original;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? input : date.toISOString();
}
