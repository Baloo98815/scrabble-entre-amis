import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@scrabble/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

/** Connexion unique et partagée — même origine que la page (proxy Vite en dev, Nginx en prod). */
export function getSocket(): GameSocket {
  if (!socket) {
    socket = io({ withCredentials: true, autoConnect: false });
  }
  return socket;
}
