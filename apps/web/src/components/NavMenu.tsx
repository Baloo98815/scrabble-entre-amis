import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../api/auth.js';
import { useAuthContext } from '../state/AuthContext.js';

/** Menu de navigation flottant, affiché uniquement quand l'utilisateur est connecté. */
export function NavMenu() {
  const { user, refresh } = useAuthContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  async function handleLogout(): Promise<void> {
    setOpen(false);
    await logout();
    await refresh();
    navigate('/');
  }

  return (
    <div className="nav-menu" ref={ref}>
      <button
        type="button"
        className="nav-menu__button"
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        ☰
      </button>
      {open && (
        <div className="nav-menu__panel" role="menu">
          <span className="nav-menu__user">{user.pseudo}</span>
          <Link to="/" role="menuitem">
            Accueil
          </Link>
          <Link to="/history" role="menuitem">
            Mon historique
          </Link>
          <Link to="/settings" role="menuitem">
            Paramètres
          </Link>
          <button type="button" role="menuitem" className="link-button" onClick={handleLogout}>
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
