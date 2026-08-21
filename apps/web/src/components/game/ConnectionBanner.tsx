interface ConnectionBannerProps {
  connected: boolean;
}

/** Bandeau discret affiché quand la connexion temps réel est perdue (ex: wifi coupé). */
export function ConnectionBanner({ connected }: ConnectionBannerProps) {
  if (connected) return null;
  return <div className="connection-banner">🔌 Connexion perdue — reconnexion en cours…</div>;
}
