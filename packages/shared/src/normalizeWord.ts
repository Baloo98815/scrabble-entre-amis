const ACCENT_MAP: Record<string, string> = {
  À: 'A',
  Â: 'A',
  Ä: 'A',
  Á: 'A',
  Ã: 'A',
  Å: 'A',
  Ç: 'C',
  É: 'E',
  È: 'E',
  Ê: 'E',
  Ë: 'E',
  Î: 'I',
  Ï: 'I',
  Ì: 'I',
  Í: 'I',
  Ô: 'O',
  Ö: 'O',
  Ò: 'O',
  Ó: 'O',
  Õ: 'O',
  Ù: 'U',
  Û: 'U',
  Ü: 'U',
  Ú: 'U',
  Ÿ: 'Y',
  Ý: 'Y',
  Ñ: 'N',
  Œ: 'OE',
  Æ: 'AE',
};

/**
 * Normalise un mot pour la comparaison au dictionnaire et le stockage en base :
 * majuscules, sans accents/apostrophes/traits d'union (les jetons Scrabble n'ont pas
 * d'accents), utilisé à la fois par le script de seed et par le validateur au moment du jeu.
 */
export function normalizeWord(raw: string): string {
  const upper = raw.toUpperCase();
  let out = '';
  for (const char of upper) {
    out += ACCENT_MAP[char] ?? char;
  }
  return out.replace(/[^A-Z]/g, '');
}
