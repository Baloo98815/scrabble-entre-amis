import { parse } from 'cookie';
import { GUEST_COOKIE_NAME, SESSION_COOKIE_NAME, verifySession } from '../services/auth.service.js';
import type { IOServer } from './types.js';

/** Résout `socket.data.identity` depuis les mêmes cookies que la couche REST. */
export function registerSocketAuth(io: IOServer): void {
  io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = cookieHeader ? parse(cookieHeader) : {};

    const sessionToken = cookies[SESSION_COOKIE_NAME];
    if (sessionToken) {
      const payload = verifySession(sessionToken);
      if (payload) {
        socket.data.identity = { kind: 'user', userId: payload.sub };
        next();
        return;
      }
    }

    const guestId = cookies[GUEST_COOKIE_NAME];
    socket.data.identity = guestId ? { kind: 'guest', guestId } : null;
    next();
  });
}
