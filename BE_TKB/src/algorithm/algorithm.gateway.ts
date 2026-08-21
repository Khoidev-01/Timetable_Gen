import { Injectable, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/** One compact period: [classId, day, period, subjectId, teacherId]. */
export type SlotTuple = [string, number, number, number, string];

export interface SolveProgress {
  attempt: number;
  maxAttempts: number;
  phase: string;
  placed: number;
  required: number;
  hardViolations: number;
  score: number;
  slots?: SlotTuple[];
}

const corsOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

/**
 * Streams solver progress to whoever is watching a semester.
 *
 * The screen used to poll every three seconds and show nothing until the run finished,
 * so a 25 second solve looked like the app had frozen. Pushing progress lets the grid
 * fill in as it happens.
 *
 * The BullMQ worker runs in this same process, so the service can call `publish`
 * directly. If the worker is ever split into its own process this needs to go through
 * Redis pub/sub instead.
 */
@Injectable()
@WebSocketGateway({
  namespace: '/solver',
  cors: { origin: corsOrigins.length > 0 ? corsOrigins : ['http://localhost:3000'], credentials: true },
})
export class AlgorithmGateway implements OnGatewayConnection {
  private readonly logger = new Logger(AlgorithmGateway.name);

  @WebSocketServer()
  server!: Server;

  /** Last frame per semester, so a late joiner sees the current state immediately. */
  private latest = new Map<string, SolveProgress>();

  handleConnection(client: Socket) {
    this.logger.debug(`Solver watcher connected: ${client.id}`);
  }

  @SubscribeMessage('watch')
  onWatch(@ConnectedSocket() client: Socket, @MessageBody() semesterId: string) {
    if (!semesterId) return;

    client.join(this.room(semesterId));
    const snapshot = this.latest.get(semesterId);
    if (snapshot) client.emit('progress', snapshot);
  }

  @SubscribeMessage('unwatch')
  onUnwatch(@ConnectedSocket() client: Socket, @MessageBody() semesterId: string) {
    if (semesterId) client.leave(this.room(semesterId));
  }

  publish(semesterId: string, progress: SolveProgress) {
    this.latest.set(semesterId, progress);
    this.server?.to(this.room(semesterId)).emit('progress', progress);
  }

  publishDone(semesterId: string, payload: any) {
    this.latest.delete(semesterId);
    this.server?.to(this.room(semesterId)).emit('done', payload);
  }

  private room(semesterId: string) {
    return `semester:${semesterId}`;
  }
}
