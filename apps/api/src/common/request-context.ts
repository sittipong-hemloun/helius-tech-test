import type { Request } from 'express';

export interface AppRequest extends Request {
  requestId: string;
}
