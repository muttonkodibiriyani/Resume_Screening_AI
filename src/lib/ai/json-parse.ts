/** Robust JSON parse: strips code fences, finds first { ... } block. */
export function parseAIJson<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  let s = raw.trim();
  s = s.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(s) as T;
  } catch {
    /* fallthrough */
  }
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(s.slice(first, last + 1)) as T;
    } catch {
      return null;
    }
  }
  return null;
}
