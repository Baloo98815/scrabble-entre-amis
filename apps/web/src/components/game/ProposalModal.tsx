import type { ProposalState } from '@scrabble/shared';

interface ProposalModalProps {
  proposal: ProposalState;
  proposerPseudo: string;
  myGamePlayerId: string;
  onVote: (accept: boolean) => void;
  onCancel: () => void;
}

/** Popin du mode Scrabbullshit : vote sur le mot proposé (côté votants) ou suivi des votes (côté proposant). */
export function ProposalModal({ proposal, proposerPseudo, myGamePlayerId, onVote, onCancel }: ProposalModalProps) {
  const isProposer = proposal.proposerId === myGamePlayerId;
  const hasVoted = proposal.accepted.includes(myGamePlayerId) || proposal.rejected.includes(myGamePlayerId);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Proposition de mot">
      <div className="modal">
        <h2>{isProposer ? 'Ta proposition' : `${proposerPseudo} propose un mot`}</h2>
        <p className="proposal__word">{proposal.word}</p>
        <p>
          {proposal.accepted.length} accord(s) reçu(s). Il sera ajouté au dictionnaire de cette partie si tout le
          monde l’accepte.
        </p>
        <div className="modal__actions">
          {isProposer ? (
            <button type="button" onClick={onCancel}>
              Annuler ma proposition
            </button>
          ) : hasVoted ? (
            <p>Vote enregistré, en attente des autres…</p>
          ) : (
            <>
              <button type="button" onClick={() => onVote(false)}>
                Refuser
              </button>
              <button type="button" className="button--primary" onClick={() => onVote(true)}>
                Accepter
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
