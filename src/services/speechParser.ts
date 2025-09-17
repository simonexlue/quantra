import { CatalogItem } from "../types/catalog";
import { InventorySubmissionLine } from "../types/inventory";
import { computeFlag } from "../constants/flags";

// Common filter words to remove from speech
const FILTER_WORDS = [
  // Corrections
  'wait', 'no', 'actually', 'sorry', 'correction', 'wrong', "scratch that",
  // Filler words
  'um', 'uh', 'er', 'ah', 'like', 'you know', 'so',
  // Interruptions
  'stop', 'cancel', 'nevermind', 'forget it', 'skip',
  // Common speech artifacts
  'the', 'a', 'an', 'and', 'or', 'but'
];

/** Parse spoken text into structured inventory lines
 * 
 * Example: "10 redonions, 5 cucumbers" 
 *   -> [{itemId: 'redonion', qty: 10},
 *       {itemId: 'cucumber', qty: 5}]
 */

export function parseSpeechToLines(text: string, catalog: CatalogItem[]): InventorySubmissionLine[] {
    const lower = text.toLowerCase();

    const results: InventorySubmissionLine[] = [];

    // First try: split by common separators (comma, "and")
    let parts = lower.split(/,|and/).map((p) => p.trim());
    
    // If that doesn't work, try to find number patterns in the whole text
    if (parts.length === 1) {
        parts = extractNumberItems(lower);
    }

    // Track items by name for correction detection
    const itemMap = new Map<string, { qty: number; item: CatalogItem }>();

    for (const part of parts) {
        if (!part) continue;

        let qty: number | null = null;
        let matchedItem: CatalogItem | null = null;

        // Case: "out of ___"
        if (part.startsWith("out of")) {
            qty = 0;
            const name = part.replace("out of", "").trim();
            matchedItem = findInCatalog(name, catalog);
        } else {
            // General case: starts with a number
            const match = part.match(/^(\d+)\s+(.+)$/);
            if (match) {
                qty = parseInt(match[1], 10);
                const name = match[2].trim();
                matchedItem = findInCatalog(name, catalog);
            } else {
                // Word number case: "six radishes", "three tofu"
                const wordNumberMatch = part.match(/^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\s+(.+)$/);
                if (wordNumberMatch) {
                    qty = wordToNumber(wordNumberMatch[1]);
                    const name = wordNumberMatch[2].trim();
                    matchedItem = findInCatalog(name, catalog);
                }
            }
        }

        if(matchedItem) {
            const safeQty = qty ?? 0;
            
            // Store the latest quantity (corrections override previous values)
            itemMap.set(matchedItem.id, { qty: safeQty, item: matchedItem });
        }
    }

    // Convert map to results array
    for (const [itemId, { qty, item }] of itemMap) {
        results.push({
            itemId: item.id,
            qty: qty,
            flag: computeFlag(qty),
        });
    }

    return results;
}

function extractNumberItems(text: string): string[] {
    const items: string[] = [];
    const words = text.split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        
        // Check if this word is a number (digit or word)
        if (/^\d+$/.test(word) || isWordNumber(word)) {
            // Found a number, collect the item name
            let itemName = '';
            let j = i + 1;
            
            // Collect words until we hit another number
            while (j < words.length && !/^\d+$/.test(words[j]) && !isWordNumber(words[j])) {
                if (itemName) itemName += ' ';
                itemName += words[j];
                j++;
            }
            
            if (itemName) {
                // Clean the item name by removing filter words
                const cleanedItemName = cleanItemName(itemName);
                if (cleanedItemName) {
                    items.push(`${word} ${cleanedItemName}`);
                }
                i = j - 1; // Skip the words we just processed
            }
        }
    }
    
    return items;
}

function cleanItemName(itemName: string): string {
    const words = itemName.split(/\s+/);
    const cleanedWords = words.filter(word => 
        !FILTER_WORDS.includes(word.toLowerCase()) && word.trim().length > 0
    );
    return cleanedWords.join(' ');
}

function isWordNumber(word: string): boolean {
    const wordNumbers = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
        'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand'];
    return wordNumbers.includes(word.toLowerCase());
}

function wordToNumber(word: string): number {
    const numbers: Record<string, number> = {
        'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
        'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
        'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
        'eighty': 80, 'ninety': 90, 'hundred': 100, 'thousand': 1000
    };
    return numbers[word.toLowerCase()] || 0;
}

function findInCatalog(name: string, catalog: CatalogItem[]): CatalogItem | null {
    for (const item of catalog) {
        if (item.name.toLowerCase() === name) return item;
        if (item.synonyms?.some((s) => s.toLowerCase() === name)) return item;
        // Plural check
        if (item.name.toLowerCase() + "s" === name) return item;
    }
    return null;
}

