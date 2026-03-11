/**
 * Spintax engine with nested support and anti-detection transformations.
 * Handles: {option1|option2|option3}, nested {Hi|Hello {world|earth}}
 */

const MAX_DEPTH = 10;

/** Synonym map for common Portuguese promo words */
const SYNONYM_MAP: Record<string, string[]> = {
  'achei': ['encontrei', 'vi', 'descobri'],
  'Achei': ['Encontrei', 'Vi', 'Descobri'],
  'barato': ['em conta', 'acessível', 'com desconto'],
  'Barato': ['Em conta', 'Acessível', 'Com desconto'],
  'oferta': ['promoção', 'oportunidade', 'deal'],
  'Oferta': ['Promoção', 'Oportunidade', 'Deal'],
  'comprar': ['garantir', 'pegar', 'aproveitar'],
  'Comprar': ['Garantir', 'Pegar', 'Aproveitar'],
  'preço': ['valor', 'custo', 'investimento'],
  'Preço': ['Valor', 'Custo', 'Investimento'],
  'desconto': ['abatimento', 'redução', 'economia'],
  'Desconto': ['Abatimento', 'Redução', 'Economia'],
  'incrível': ['sensacional', 'fantástico', 'surreal'],
  'Incrível': ['Sensacional', 'Fantástico', 'Surreal'],
  'ótimo': ['excelente', 'top', 'maravilhoso'],
  'Ótimo': ['Excelente', 'Top', 'Maravilhoso'],
  'produto': ['item', 'artigo', 'produto'],
  'Produto': ['Item', 'Artigo', 'Produto'],
  'confira': ['veja', 'olha', 'dá uma olhada'],
  'Confira': ['Veja', 'Olha', 'Dá uma olhada'],
  'corre': ['aproveita', 'vai', 'não perde'],
  'Corre': ['Aproveita', 'Vai', 'Não perde'],
  'imperdível': ['incrível', 'absurdo', 'insano'],
  'Imperdível': ['Incrível', 'Absurdo', 'Insano'],
};

/** Emoji rotation groups */
const EMOJI_GROUPS: string[][] = [
  ['\u{1F525}', '\u{26A1}', '\u{1F4A5}', '\u{1F680}'],
  ['\u{2705}', '\u{2611}\uFE0F', '\u{2714}\uFE0F', '\u{1F44D}'],
  ['\u{1F4B0}', '\u{1F4B5}', '\u{1F911}', '\u{1F4B2}'],
  ['\u{26A0}\uFE0F', '\u{1F6A8}', '\u{1F4E2}', '\u{2757}'],
  ['\u{1F389}', '\u{1F973}', '\u{1F38A}', '\u{1FA85}'],
  ['\u{1F449}', '\u{27A1}\uFE0F', '\u{25B6}\uFE0F', '\u{2192}'],
  ['\u{2764}\uFE0F', '\u{1F49B}', '\u{1F49A}', '\u{1F499}'],
];

/** Punctuation alternatives */
const PUNCTUATION_MAP: Record<string, string[]> = {
  '!': ['!', '!!', '.', '...'],
  '?': ['?', '??', '?!'],
  '...': ['...', '..', '\u{2026}'],
};

const ZERO_WIDTH_SPACE = '\u200B';

/**
 * Parse and resolve spintax: {option1|option2|option3}
 * Supports nesting: {Hi|Hello {world|earth}}
 * Returns a unique variation each call.
 */
export function spinText(template: string): string {
  let result = template;

  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    // Match innermost spintax blocks (no nested braces inside)
    const re = /\{([^{}]+)\}/;
    const match = re.exec(result);
    if (!match) break;

    const options = splitOptions(match[1]!);
    const filtered = options.length > 0 ? options : [''];
    const chosen = filtered[Math.floor(Math.random() * filtered.length)]!;
    result = result.slice(0, match.index) + chosen + result.slice(match.index + match[0].length);
  }

  return result;
}

/**
 * Split spintax options respecting nested braces.
 */
function splitOptions(content: string): string[] {
  const options: string[] = [];
  let current = '';
  let depth = 0;

  for (const ch of content) {
    if (ch === '{') {
      depth++;
      current += ch;
    } else if (ch === '}') {
      depth--;
      current += ch;
    } else if (ch === '|' && depth === 0) {
      options.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  options.push(current);
  return options;
}

/**
 * Generate N unique variations from a template.
 * Throws if template cannot produce N unique results.
 */
export function generateVariations(template: string, count: number): string[] {
  const totalPossible = countVariations(template);
  if (count > totalPossible) {
    throw new Error(
      `Cannot generate ${count} unique variations. Template only supports ${totalPossible}.`
    );
  }

  const seen = new Set<string>();
  const results: string[] = [];
  const maxAttempts = count * 20;
  let attempts = 0;

  while (results.length < count && attempts < maxAttempts) {
    const variation = spinText(template);
    if (!seen.has(variation)) {
      seen.add(variation);
      results.push(variation);
    }
    attempts++;
  }

  if (results.length < count) {
    throw new Error(
      `Could only generate ${results.length}/${count} unique variations after ${maxAttempts} attempts.`
    );
  }

  return results;
}

/**
 * Calculate the total possible variations for a template.
 */
export function countVariations(template: string): number {
  return countVariationsRecursive(template, 0);
}

function countVariationsRecursive(template: string, depth: number): number {
  if (depth > MAX_DEPTH) return 1;

  const re = /\{([^{}]+)\}/;
  const match = re.exec(template);
  if (!match) return 1;

  const options = splitOptions(match[1]!);
  const filtered = options.length > 0 ? options : [''];

  let totalForThisBlock = 0;
  for (const option of filtered) {
    const substituted = template.slice(0, match.index) + option + template.slice(match.index + match[0].length);
    totalForThisBlock += countVariationsRecursive(substituted, depth + 1);
  }

  return totalForThisBlock;
}

/**
 * Apply additional anti-detection transformations:
 * - Synonym substitution
 * - Emoji rotation
 * - Punctuation variation
 * - Whitespace variation (single/double line breaks)
 * - Zero-width character insertion (anti-hash)
 */
export function applyAntiDetection(text: string): string {
  const allTransformations = [
    applySynonyms,
    applyEmojiRotation,
    applyPunctuationVariation,
    applyWhitespaceVariation,
    applyZeroWidthInsertion,
  ];

  // Randomly pick 2-3 transformations
  const count = 2 + Math.floor(Math.random() * 2);
  const shuffled = [...allTransformations].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  let result = text;
  for (const transform of selected) {
    result = transform(result);
  }

  return result;
}

function applySynonyms(text: string): string {
  let result = text;
  for (const [word, synonyms] of Object.entries(SYNONYM_MAP)) {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`);
    if (regex.test(result)) {
      const replacement = synonyms[Math.floor(Math.random() * synonyms.length)]!;
      result = result.replace(regex, replacement);
    }
  }
  return result;
}

function applyEmojiRotation(text: string): string {
  let result = text;
  for (const group of EMOJI_GROUPS) {
    for (const emoji of group) {
      if (result.includes(emoji)) {
        const replacement = group[Math.floor(Math.random() * group.length)]!;
        result = result.replaceAll(emoji, replacement);
        break;
      }
    }
  }
  return result;
}

function applyPunctuationVariation(text: string): string {
  let result = text;
  for (const [punct, alternatives] of Object.entries(PUNCTUATION_MAP)) {
    if (result.includes(punct)) {
      const replacement = alternatives[Math.floor(Math.random() * alternatives.length)]!;
      result = result.replace(punct, replacement);
    }
  }
  return result;
}

function applyWhitespaceVariation(text: string): string {
  return text.replace(/\n/g, () => {
    return Math.random() > 0.7 ? '\n\n' : '\n';
  });
}

function applyZeroWidthInsertion(text: string): string {
  const insertions = 1 + Math.floor(Math.random() * 3);
  let result = text;

  for (let i = 0; i < insertions; i++) {
    if (result.length === 0) break;
    const pos = Math.floor(Math.random() * result.length);
    result = result.slice(0, pos) + ZERO_WIDTH_SPACE + result.slice(pos);
  }

  return result;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
