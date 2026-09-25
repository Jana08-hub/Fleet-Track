import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { verifyJwt } from './utils/jwt.js';

export let io: Server | null = null;

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: (process.env.FRONTEND_URL || 'http://localhost:3000').split(','), credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next();
      const p = verifyJwt(token);
      (socket.data as any).user = p;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join-admin-room', () => socket.join('admins'));
    socket.on('join-driver-room', (driverId: string) => {
      if (driverId) socket.join(`driver:${driverId}`);
    });
    socket.on('start-tracking', (tripId: string) => {
      if (tripId) socket.join(`trip:${tripId}`);
    });
    socket.on('stop-tracking', (tripId: string) => {
      if (tripId) socket.leave(`trip:${tripId}`);
    });
    socket.on('send-gps-update', (payload) => {
      // GPS ingestion goes through REST for validation; socket just relays to trip room
      if (payload?.tripId) socket.to(`trip:${payload.tripId}`).emit('vehicle-location-updated', payload);
    });
  });
  return io;
}

export function emitToAdmins(event: string, payload: unknown) {
  io?.to('admins').emit(event, payload);
}
