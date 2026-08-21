const STORAGE_KEY = 'scrabble_pseudo';

/** Mémorise le pseudo choisi par un invité pour ne pas le lui redemander à chaque partie. */
export function getRememberedPseudo(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return ''; // stockage indisponible (navigation privée stricte, etc.)
  }
}

export function rememberPseudo(pseudo: string): void {
  const trimmed = pseudo.trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // pas grave si ça échoue, c'est juste une commodité
  }
}
