import { normalizeWord } from '@scrabble/shared';

const BASE_URL = 'https://1mot.net/';
// 1mot.net ne l'exige pas, mais on reste courtois envers un service tiers gratuit.
const USER_AGENT = 'ScrabbleEntreAmis/1.0 (definition lookup)';
const FETCH_TIMEOUT_MS = 4000;
const CACHE_MAX = 2000;

export interface DefinitionResult {
  word: string;
  extracts: string[];
  url: string;
}

// Cache mémoire simple : mot normalisé -> résultat. On met aussi en cache les « rien trouvé »
// pour ne pas re-solliciter 1mot.net à chaque frappe sur un mot absent.
const cache = new Map<string, DefinitionResult>();

function pageUrl(normalizedWord: string): string {
  return BASE_URL + encodeURIComponent(normalizedWord.toLowerCase());
}

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => HTML_ENTITIES[m] ?? m);
}

function liTextToExtract(liInnerHtml: string): string {
  const withoutTags = liInnerHtml.replace(/<[^>]+>/g, '');
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim();
}


export function parseOdsExtracts(html: string): string[] {
  const odsIndex = html.indexOf('>ODS<');
  if (odsIndex === -1) return [];
  const headingEnd = html.indexOf('</h4>', odsIndex);
  if (headingEnd === -1) return [];
  const listStart = html.indexOf('<ul>', headingEnd);
  if (listStart === -1) return [];
  const listEnd = html.indexOf('</ul>', listStart);
  if (listEnd === -1) return [];
  const listHtml = html.slice(listStart, listEnd);

  const extracts: string[] = [];
  const liRegex = /<li>(.*?)<\/li>/gs;
  let match: RegExpExecArray | null;
  while ((match = liRegex.exec(listHtml))) {
    const text = liTextToExtract(match[1] ?? '');
    if (text) extracts.push(text);
  }
  return extracts;
}

export async function getDefinition(rawWord: string): Promise<DefinitionResult> {
  const normalized = normalizeWord(rawWord);
  const cached = cache.get(normalized);
  if (cached) return cached;

  const url = pageUrl(normalized);
  const html = await fetchHtml(url);
  const extracts = html ? parseOdsExtracts(html) : [];
  const result: DefinitionResult = { word: normalized, extracts, url };

  // Cache borné : au-delà de la limite, on repart de zéro (stratégie simple, suffisante ici).
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(normalized, result);
  return result;
}
