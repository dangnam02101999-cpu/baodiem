import { Soldier, ShootingResult } from './types';

export const MOCK_SOLDIERS: Soldier[] = [
  { id: '1', name: 'Nguyễn Văn An', rank: 'Thượng úy', position: 'Trung đội trưởng', unit: 'C1 / D4', shootingId: 'QD-20485' },
  { id: '2', name: 'Lê Minh Đức', rank: 'Trung úy', position: 'Đại đội phó', unit: 'C1 / D4', shootingId: 'QD-20486' },
  { id: '3', name: 'Phạm Hùng Sơn', rank: 'Thượng tá', position: 'Tiểu đoàn trưởng', unit: 'C1 / D4', shootingId: 'QD-20487' },
  { id: '4', name: 'Trần Quang Minh', rank: 'Thượng úy', position: 'Trung đội trưởng', unit: 'C1 / D4', shootingId: 'QD-20488' },
  { id: '5', name: 'Phạm Quốc Cường', rank: 'Hạ sĩ', position: 'Chiến sĩ', unit: 'C1 / D4', shootingId: 'QD-20489' },
  { id: '6', name: 'Lê Văn Bình', rank: 'Binh nhì', position: 'Chiến sĩ', unit: 'C1 / D4', shootingId: 'QD-20490' },
];

export const MOCK_RESULTS: ShootingResult[] = [
  { lane: 1, target: 4, scores: [9, 9, 9], timestamp: Date.now(), reporterId: 'mock-reporter' },
  { lane: 2, target: 7, scores: [10, 10, 10], timestamp: Date.now(), reporterId: 'mock-reporter' },
  { lane: 3, target: 8, scores: [null, null, null], timestamp: Date.now(), reporterId: 'mock-reporter' },
];

export const RANKS = ['Binh nhì', 'Binh nhất', 'Hạ sĩ', 'Trung sĩ', 'Thượng sĩ', 'Thiếu úy', 'Trung úy', 'Thượng úy', 'Đại úy', 'Thiếu tá', 'Trung tá', 'Thượng tá', 'Đại tá'];
