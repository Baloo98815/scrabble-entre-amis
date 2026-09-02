import { useState } from 'react';

interface CopyableLinkProps {
  label: string;
  url: string;
}

/** Lien en lecture seule avec bouton « Copier » (et retour visuel « Copié ! »). */
export function CopyableLink({ label, url }: CopyableLinkProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      // Le retour « Copié ! » s'efface tout seul ; sans effet secondaire à nettoyer ici.
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponible (contexte non sécurisé, permission refusée) : l'input reste
      // sélectionnable pour un copier-coller manuel, on ne casse rien.
    }
  }

  return (
    <div className="share-link">
      <span className="share-link__label">{label}</span>
      <div className="invite-link">
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={handleCopy}>
          {copied ? 'Copié !' : 'Copier'}
        </button>
      </div>
    </div>
  );
}
