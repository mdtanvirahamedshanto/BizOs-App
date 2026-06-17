import { io, Socket } from 'socket.io-client';
import { kvStorage, storageKeys } from '@/lib/storage/mmkv';

// Socket endpoint matching the backend server address.
// Override per-environment via `EXPO_PUBLIC_SOCKET_URL`. Defaults to the Android
// emulator host loopback on the backend port; use your LAN IP on a real device.
const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL?.trim() || 'http://10.0.2.2:4000';

class SocketService {
  private socket: Socket | null = null;

  connect(shopId: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    const token = kvStorage.getItem(storageKeys.AUTH_TOKEN);

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
      auth: {
        token: token ? `Bearer ${token}` : undefined,
      },
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected to realtime gateway.');
      // Identify terminal and join active shop room
      this.socket?.emit('shop:join', { shopId });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected from server:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();
export default socketService;
