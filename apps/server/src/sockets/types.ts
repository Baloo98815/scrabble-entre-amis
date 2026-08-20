import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@scrabble/shared';

export type SocketIdentity = { kind: 'user'; userId: string } | { kind: 'guest'; guestId: string } | null;

export interface SocketData {
  identity: SocketIdentity;
}

export type IOServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
