// app/services/speechParser.ts
import type { CatalogItem } from "../types/catalog";

export type ParsedLine = { itemId: string; qty: number };

// number words -> digits
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12,
};

function normalizeNumbers(s: string) {
  return String(s || "").replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi,
    (w) => String(NUMBER_WORDS[w.toLowerCase()] ?? w)
  );
}

// light singularization for common items (extend as needed)
function singularize(s: string) {
  return s
    .replace(/\b(green\s+onions)\b/gi, "green onion")
    .replace(/\b(fried\s+onions)\b/gi, "fried onion")
    .replace(/\b(onions)\b/gi, "onion")
    .replace(/\b(cucumbers)\b/gi, "cucumber")
    .replace(/\b(edamames)\b/gi, "edamame")
    .replace(/s\b/gi, ""); // fallback
}

function toArray<T>(maybe: T | T[] | null | undefined): T[] {
  if (Array.isArray(maybe)) return maybe;
  if (maybe == null) return [];
  return [maybe];
}

function buildSynonymIndex(catalog: CatalogItem[]) {
  const idx = new Map<string, string>();

  for (const it of catalog || []) {
    const base = String(it.name ?? it.id ?? "").toLowerCase().trim();
    if (base) {
      idx.set(base, it.id);
      const compactBase = base.replace(/[\s\-\.]+/g, "");
      if (compactBase) idx.set(compactBase, it.id);
    }

    // robust to array OR single string
    const syns = toArray<string>(it.synonyms as any);
    for (const s of syns) {
      const key = String(s || "").toLowerCase().trim();
      if (!key) continue;
      idx.set(key, it.id);
      const compact = key.replace(/[\s\-\.]+/g, "");
      if (compact) idx.set(compact, it.id);
    }
  }

  return idx;
}

/**
 * Hermes-safe parser:
 *  - Works with no separators: "5 green onion 3 fried onions 3 edamame"
 *  - Avoids matchAll/flatMap/replaceAll
 *  - Returns an array: [{itemId, qty}], as your UI expects
 */
export function parseSpeechToLines(
  rawText: string,
  catalog: CatalogItem[]
): ParsedLine[] {
  const safe = normalizeNumbers(rawText).toLowerCase().trim();
  if (!safe) return [];

  // qty + name (until next qty or end)
  const re = /(\d+(?:\.\d+)?)\s+([a-z][a-z0-9\s\-\.\(\)]*?)(?=\s+\d+(?:\.\d+)?\b|$)/gi;

  const idx = buildSynonymIndex(catalog || []);
  const out: ParsedLine[] = [];

  let m: RegExpExecArray | null;
  while ((m = re.exec(safe)) !== null) {
    const qty = Number(m[1]);
    let name = String(m[2] || "").replace(/\s*(,|and|&)\s*$/i, "").trim();
    name = singularize(name);

    // map by exact, then compact (remove spaces/hyphens/dots)
    const exact = idx.get(name);
    const compact = idx.get(name.replace(/[\s\-\.]+/g, ""));
    const itemId = exact || compact;
    if (!itemId) continue;

    out.push({ itemId, qty });
  }

  return out;
}
