import { normalizeWord } from '@scrabble/shared';

/**
 * Récupération d'un extrait de définition depuis le Wiktionnaire francophone.
 *
 * Ce n'est PAS la source de vérité du jeu (ça reste la table `dictionary_words`) : c'est un
 * simple confort d'affichage pour le champ « tester un mot ». On passe par un proxy serveur
 * plutôt qu'un appel direct depuis le navigateur pour trois raisons :
 *   1. Gérer le décalage d'accents — nos mots sont saisis SANS accents (jetons Scrabble), alors
 *      que le Wiktionnaire indexe les lemmes accentués (`école`, pas `ecole`). On tente d'abord
 *      la page en minuscules ; si elle manque, une recherche `list=search` (indexée par
 *      CirrusSearch, insensible aux accents) nous rend le vrai lemme, qu'on privilégie accentué.
 *   2. Parser la définition utile — le texte brut du Wiktionnaire commence par l'étymologie ;
 *      on saute jusqu'à la première section de nature grammaticale (Nom, Verbe, Adjectif…).
 *   3. Mettre en cache et ne pas coupler le client à une API externe.
 *
 * Best-effort de bout en bout : timeout, 429, page absente, structure inattendue → on renvoie
 * simplement `extract: null` (le client affiche alors le seul lien), jamais d'erreur.
 */

const WIKTIONARY_API = 'https://fr.wiktionary.org/w/api.php';
const WIKTIONARY_WIKI = 'https://fr.wiktionary.org/wiki/';
// Le Wiktionnaire (comme tout service Wikimedia) demande un User-Agent descriptif.
const USER_AGENT = 'ScrabbleEntreAmis/1.0 (definition lookup)';
const FETCH_TIMEOUT_MS = 4000;
const CACHE_MAX = 2000;
const MAX_EXTRACT_CHARS = 2500;
const MAX_DEFINITION_CHARS = 300;

// Sections de nature grammaticale à retenir (comparées en forme normalisée : sans accents ni
// espaces, en majuscules). `startsWith` couvre « Nom commun 1 », « Nom propre », etc.
const POS_PREFIXES = [
  'NOM',
  'ADJECTIF',
  'VERBE',
  'ADVERBE',
  'PRONOM',
  'PREPOSITION',
  'CONJONCTION',
  'INTERJECTION',
  'ARTICLE',
  'SYMBOLE',
  'DETERMINANT',
  'NUMERAL',
  'LOCUTION',
  'PARTICULE',
  'ONOMATOPEE',
  'SUFFIXE',
  'PREFIXE',
  'LETTRE',
];

export interface DefinitionResult {
  /** Le mot demandé, normalisé (majuscules, sans accents). */
  word: string;
  /** Définition en texte brut, ou null si rien d'exploitable n'a été trouvé. */
  extract: string | null;
  /** Nature grammaticale de la définition retenue (« Nom commun », « Verbe »…), si connue. */
  partOfSpeech: string | null;
  /** Titre canonique de la page Wiktionnaire (peut différer du mot : accents, casse). */
  title: string | null;
  /** Lien vers la page Wiktionnaire (page trouvée, sinon le mot demandé en minuscules). */
  url: string;
}

// Cache mémoire simple : mot normalisé -> résultat. On met aussi en cache les « rien trouvé »
// pour ne pas re-solliciter le Wiktionnaire à chaque frappe sur un mot absent.
const cache = new Map<string, DefinitionResult>();

interface WikiExtract {
  title: string;
  extract: string;
}

function wikiUrl(title: string): string {
  return WIKTIONARY_WIKI + encodeURIComponent(title.replace(/ /g, '_'));
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    // 429 (trop de requêtes), 5xx… : on abandonne silencieusement AVANT de parser (le corps
    // n'est alors pas du JSON), on dégradera en « pas d'extrait ».
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    // Timeout, réseau coupé, JSON invalide… : jamais d'erreur remontée, on renvoie null.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Récupère le texte brut d'une page Wiktionnaire, ou null si la page n'existe pas. */
async function fetchExtract(title: string): Promise<WikiExtract | null> {
  const url =
    `${WIKTIONARY_API}?format=json&formatversion=2&action=query&prop=extracts` +
    `&explaintext=1&redirects=1&exchars=${MAX_EXTRACT_CHARS}&titles=${encodeURIComponent(title)}`;
  const data = await fetchJson(url);
  const page = (
    data as { query?: { pages?: Array<{ title?: string; missing?: boolean; extract?: string }> } }
  )?.query?.pages?.[0];
  if (!page || page.missing || !page.extract) return null;
  return { title: page.title ?? title, extract: page.extract };
}

/** Recherche insensible aux accents (CirrusSearch) pour retrouver le lemme (« ecole » -> « école »). */
async function searchTitles(word: string): Promise<string[]> {
  const url =
    `${WIKTIONARY_API}?format=json&formatversion=2&action=query&list=search` +
    `&srlimit=6&srsearch=${encodeURIComponent(word)}`;
  const data = await fetchJson(url);
  const results = (data as { query?: { search?: Array<{ title?: unknown }> } })?.query?.search;
  if (!Array.isArray(results)) return [];
  return results.map((r) => r.title).filter((t): t is string => typeof t === 'string');
}

function isAscii(s: string): boolean {
  for (const c of s) if (c.charCodeAt(0) > 127) return false;
  return true;
}

function isSingleToken(s: string): boolean {
  return !s.includes(' ') && !s.includes('-') && !s.includes('’');
}

/**
 * Parmi les candidats de recherche, choisit le meilleur lemme : même mot normalisé, un seul
 * token, en privilégiant la forme accentuée (le vrai lemme, ex. « école ») puis en minuscule
 * (les entrées ASCII/majuscules sont souvent des « mauvaise orthographe de… »).
 */
function pickBestTitle(candidates: string[], normalized: string): string | null {
  const matches = candidates.filter((c) => normalizeWord(c) === normalized && isSingleToken(c));
  matches.sort((a, b) => {
    const aAscii = isAscii(a) ? 1 : 0;
    const bAscii = isAscii(b) ? 1 : 0;
    if (aAscii !== bAscii) return aAscii - bAscii; // accentué d'abord
    const aLower = a[0] === a[0]?.toLowerCase() ? 0 : 1;
    const bLower = b[0] === b[0]?.toLowerCase() ? 0 : 1;
    return aLower - bLower; // minuscule d'abord
  });
  return matches[0] ?? null;
}

/**
 * Extrait la première définition d'un texte brut Wiktionnaire. On segmente par titres de
 * sections (`== … ==`), on saute étymologie/anagrammes/etc. pour s'arrêter à la première
 * nature grammaticale, puis on prend sa première ligne « de sens » (en ignorant la ligne
 * vedette « mot \prononciation\ »).
 */
function parseDefinition(text: string, normalized: string): { partOfSpeech: string; definition: string } | null {
  const lines = text.split('\n');
  const sections: Array<{ title: string; body: string[] }> = [];
  let current: { title: string; body: string[] } = { title: '', body: [] };
  for (const raw of lines) {
    const heading = /^=+\s*(.+?)\s*=+$/.exec(raw.trim());
    if (heading) {
      sections.push(current);
      current = { title: heading[1] ?? '', body: [] };
    } else {
      current.body.push(raw);
    }
  }
  sections.push(current);

  for (const section of sections) {
    const key = normalizeWord(section.title);
    if (!POS_PREFIXES.some((p) => key.startsWith(p))) continue;
    for (const bodyLine of section.body) {
      const t = bodyLine.trim();
      if (!t) continue;
      if (t.includes('\\')) continue; // ligne vedette + prononciation API (\ʃjɛ̃\)
      const firstToken = t.split(/[\s,;:.]/)[0] ?? '';
      if (normalizeWord(firstToken) === normalized) continue; // encore la vedette
      return { partOfSpeech: section.title, definition: t.slice(0, MAX_DEFINITION_CHARS) };
    }
  }
  return null;
}

export async function getDefinition(rawWord: string): Promise<DefinitionResult> {
  const normalized = normalizeWord(rawWord);
  const cached = cache.get(normalized);
  if (cached) return cached;

  // 1) Page en minuscules — le cas courant (« zinc », « chien », « manger »…).
  const lower = rawWord.trim().toLowerCase();
  let hit = await fetchExtract(lower);

  // 2) Fallback accents : la page ASCII n'existe pas, on retrouve le lemme accentué.
  if (!hit) {
    const best = pickBestTitle(await searchTitles(lower), normalized);
    if (best) hit = await fetchExtract(best);
  }

  const parsed = hit ? parseDefinition(hit.extract, normalized) : null;
  const result: DefinitionResult = hit
    ? {
        word: normalized,
        extract: parsed?.definition ?? null,
        partOfSpeech: parsed?.partOfSpeech ?? null,
        title: hit.title,
        url: wikiUrl(hit.title),
      }
    : { word: normalized, extract: null, partOfSpeech: null, title: null, url: wikiUrl(lower) };

  // Cache borné : au-delà de la limite, on repart de zéro (stratégie simple, suffisante ici).
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(normalized, result);
  return result;
}
