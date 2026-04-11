/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'ADMIN' | 'SECRETARY' | 'REPORTER' | 'VIEWER' | 'CALIBRATION';

export interface Soldier {
  id: string;
  name: string;
  rank: string;
  position: string;
  unit: string;
  shootingId: string;
}

export interface ShootingResult {
  id?: string;
  lane: number;
  target: number;
  scores: (number | null)[];
  timestamp: number;
  reporterId: string;
}

export interface ShootingQueueItem {
  id: string;
  name: string;
  rank: string;
  position: string;
  unit: string;
  status: 'Pending' | 'Completed';
  shootingId: string;
  order: number;
}

export interface SystemStatus {
  signal: 'SAFE' | 'DANGER' | 'IDLE';
  timestamp: number;
  sender: string;
}

export interface ShootingHistory {
  id?: string;
  name: string;
  results: any[];
  timestamp: number;
  totalSoldiers: number;
  averageScore: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
