import type { Request } from 'express';
import type { Role } from '../generated/prisma/enums.js';

export interface Principal {
  kind: 'user';
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  sessionId: string;
}

export interface ServicePrincipal {
  kind: 'service';
  scope: 'worker' | 'scheduler';
}

export interface AppRequest extends Request {
  requestId: string;
  principal?: Principal;
  service?: ServicePrincipal;
}
