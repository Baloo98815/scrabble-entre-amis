import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Filet de sécurité global : si un rendu plante (ex. payload temps réel inattendu qui a
 * échappé aux garde-fous de useGameConnection), on affiche un message clair avec un bouton
 * de rechargement au lieu d'un écran figé sans explication — et on logue la stack complète
 * pour pouvoir diagnostiquer si ça se reproduit.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] rendu interrompu :', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="page page--centered">
          <h1>Un problème est survenu</h1>
          <p>L'affichage s'est interrompu de façon inattendue.</p>
          <button type="button" className="button--primary" onClick={() => window.location.reload()}>
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
