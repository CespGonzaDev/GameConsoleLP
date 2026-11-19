import { BattleshipCoord, PrologShotHistoryItem } from '../../types/contracts';

export type ShipOrientation = 'HORIZONTAL' | 'VERTICAL';

export interface ShipDefinition {
  id: string;
  name: string; // e.g. "Aircraft Carrier", "Battleship", "Cruiser", "Submarine", "Destroyer"
  length: number;
  color: string;
}

export const FLEET_CONFIG: ShipDefinition[] = [
  { id: 'carrier', name: 'Aircraft Carrier', length: 5, color: '#06b6d4' },
  { id: 'battleship', name: 'Battleship', length: 4, color: '#3b82f6' },
  { id: 'cruiser', name: 'Cruiser', length: 3, color: '#10b981' },
  { id: 'submarine', name: 'Submarine', length: 3, color: '#f59e0b' },
  { id: 'destroyer', name: 'Destroyer', length: 2, color: '#ec4899' }
];

export interface PlacedShip {
  id: string;
  name: string;
  length: number;
  color: string;
  orientation: ShipOrientation;
  originRow: number; // 0-9
  originCol: number; // 0-9
  coords: Array<{ row: number; col: number }>; // 0-9
  hits: number;
  sunk: boolean;
}

export type CellState = 'EMPTY' | 'SHIP' | 'HIT' | 'MISS' | 'SUNK';

export interface BoardCell {
  row: number; // 0-9
  col: number; // 0-9
  state: CellState;
  shipId?: string;
  shipName?: string;
}

export const ROW_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;

// Coordinate translation helpers
export function toGameStatsCoord(row: number, col: number): BattleshipCoord {
  const rowLabel = ROW_LABELS[row] || 'A';
  return {
    row: rowLabel,
    col: col + 1 // 1-10
  };
}

export function fromGameStatsCoord(coord: BattleshipCoord): { row: number; col: number } {
  const rowIndex = ROW_LABELS.indexOf(coord.row as typeof ROW_LABELS[number]);
  const row = rowIndex >= 0 ? rowIndex : 0;
  const col = Math.max(0, Math.min(9, coord.col - 1));
  return { row, col };
}

export function toPrologShotHistory(
  shots: Array<{ row: number; col: number; result: 'HIT' | 'MISS'; shipSunk: string | null }>
): PrologShotHistoryItem[] {
  return shots.map(s => ({
    row: s.row,
    col: s.col,
    result: s.result,
    shipSunk: s.shipSunk
  }));
}
