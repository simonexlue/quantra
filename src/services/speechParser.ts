import { CatalogItem } from "../types/catalog";
import { InventorySubmissionLine } from "../types/inventory";
import { computeFlag } from "../constants/flags";

// Common filter words to remove from speech
const FILTER_WORDS = [
  // Corrections
  'wait', 'no', 'actually', 'sorry', 'correction', 'wrong', 'scratch that',
  // Filler words
  'um', 'uh', 'er', 'ah', 'like', 'you know', 'so',
  // Interruptions
  'stop', 'cancel', 'nevermind', 'forget it', 'skip',
  // Common speech artifacts
  'the', 'a', 'an', 'and', 'or', 'but'
];

/** Parse spoken text into structured inventory lines
 *  Example: "10 red onions, 5 cucumbers"
 *    -> [{itemId:'redonion', qty:10}, {itemId:'cucumber', qty:5}]
 */
export function parseSpeechToLines(text: string, catalog: CatalogItem[]): InventorySubmissionLine[] {
  const lower = text.toLowerCase();

  const results: InventorySubmissionLine[] = [];

  // Split by comma or the standalone word "and" (won't split "candy")
  let parts = lower.split(/,|\band\b/).map(p => p.trim()).filter(Boolean);

  // If nothing split out, try to detect "<number> <name ...>" sequences
  if (parts.length === 1) {
    parts = extractNumberItems(lower);
  }

  // Track items for correction detection (latest mention wins)
  const itemMap = new Map<string, { qty: number; item: CatalogItem }>();

  for (const part of parts) {
    if (!part) continue;

    let qty: number | null = null;
    let matchedItem: CatalogItem | null = null;

    // Case: "out of ___"
    if (part.startsWith("out of")) {
      qty = 0;
      const phrase = part.replace("out of", "").trim();
      matchedItem = bestCatalogMatch(phrase, catalog);
    } else {
      // General case: "<digits> <name...>"
      const mDigits = part.match(/^(-?\d+(?:\.\d+)?)\s+(.+)$/);
      if (mDigits) {
        qty = Number(mDigits[1]);
        const phrase = mDigits[2].trim();
        matchedItem = bestCatalogMatch(phrase, catalog);
      } else {
        // Word-number case: "six radishes", "three tofu"
        const mWords = part
            .match(/^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\s+(.+)$/);
        if (mWords) {
          qty = wordToNumber(mWords[1]);
          const phrase = mWords[2].trim();
          matchedItem = bestCatalogMatch(phrase, catalog);
        }
      }
    }

    if (matchedItem) {
      const safeQty = qty ?? 0;
      // Corrections override previous values
      itemMap.set(matchedItem.id, { qty: safeQty, item: matchedItem });
    }
  }

  // Convert map to results array
  for (const [, { qty, item }] of itemMap) {
    results.push({
      itemId: item.id,
      qty,
      // keep if your type allows flags; otherwise remove 'flag'
      flag: computeFlag(qty),
    } as any);
  }

  return results;
}

/* ----------------- helpers ----------------- */

function extractNumberItems(text: string): string[] {
  const items: string[] = [];
  const words = text.split(/\s+/);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Is this a number (digit or word)?
    if (/^\d+$/.test(word) || isWordNumber(word)) {
      // Collect name words until next number/number-word
      let itemName = '';
      let j = i + 1;

      while (j < words.length && !/^\d+$/.test(words[j]) && !isWordNumber(words[j])) {
        if (itemName) itemName += ' ';
        itemName += words[j];
        j++;
      }

      if (itemName) {
        // Remove filler words from the name chunk
        const cleaned = cleanItemName(itemName);
        if (cleaned) items.push(`${word} ${cleaned}`);
        i = j - 1; // skip processed words
      }
    }
  }

  return items;
}

function cleanItemName(itemName: string): string {
  const words = itemName.split(/\s+/);
  const cleanedWords = words.filter(
    word => !FILTER_WORDS.includes(word.toLowerCase()) && word.trim().length > 0
  );
  return cleanedWords.join(' ');
}

function isWordNumber(word: string): boolean {
  const wordNumbers = [
    'one','two','three','four','five','six','seven','eight','nine','ten',
    'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen',
    'eighteen','nineteen','twenty','thirty','forty','fifty','sixty','seventy',
    'eighty','ninety','hundred','thousand'
  ];
  return wordNumbers.includes(word.toLowerCase());
}

function wordToNumber(word: string): number {
  const numbers: Record<string, number> = {
    zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10,
    eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17,
    eighteen:18, nineteen:19, twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70,
    eighty:80, ninety:90, hundred:100, thousand:1000
  };
  return numbers[word.toLowerCase()] ?? 0;
}

function normalize(s: string) {
  // lowercase, strip punctuation, collapse spaces
  return s.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, '').replace(/\s+/g, ' ');
}

function singularize(word: string) {
  // helps with avocadoes/tomatoes/berries
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('ses')) return word.slice(0, -2);
  if (word.endsWith('s'))   return word.slice(0, -1);
  return word;
}

function toArraySynonyms(syn: unknown): string[] {
  if (Array.isArray(syn)) return syn;
  if (typeof syn === 'string') {
    return syn.split(/[,|]/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

// tolerant, plural-safe lookup
function findInCatalog(name: string, catalog: CatalogItem[]): CatalogItem | null {
  const n = normalize(name);
  const nSing = singularize(n);

  for (const item of catalog) {
    const base = normalize(item.name ?? item.id);
    const bases = [base, singularize(base), base + 's'];
    if (bases.includes(n) || bases.includes(nSing)) return item;

    const syns = toArraySynonyms((item as any).synonyms).map(normalize);
    for (const s of syns) {
      const forms = [s, singularize(s), s + 's'];
      if (forms.includes(n) || forms.includes(nSing)) return item;
    }
  }
  return null;
}

// matches the item first, ignores trailing junk words.
function bestCatalogMatch(phrase: string, catalog: CatalogItem[]): CatalogItem | null {
  const toks = normalize(phrase).split(/\s+/).filter(Boolean);
  for (let end = toks.length; end >= 1; end--) {
    const chunk = toks.slice(0, end).join(' ');
    const hit = findInCatalog(chunk, catalog);
    if (hit) return hit;
  }
  return null;
}
