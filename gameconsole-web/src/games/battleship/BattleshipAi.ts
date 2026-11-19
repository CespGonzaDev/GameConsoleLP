import {
  PrologMoveRequest,
  PrologMoveResponse,
  PrologShotHistoryItem
} from '../../types/contracts';

export class BattleshipAi {
  private static readonly PROLOG_API_URL = '/api/ai/battleship/next-move';

  /**
   * Request next AI move, querying Prolog microservice with an intelligent fallback
   */
  public static async getNextMove(
    matchId: string,
    shotsHistory: PrologShotHistoryItem[],
    remainingShipsLengths: number[],
    difficulty: 'easy' | 'tactical' | 'hard' = 'tactical'
  ): Promise<PrologMoveResponse> {
    const startTime = performance.now();

    const requestPayload: PrologMoveRequest = {
      matchId,
      difficulty,
      boardDimensions: { rows: 10, cols: 10 },
      shotsHistory,
      remainingShipsLengths
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

      const response = await fetch(this.PROLOG_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as PrologMoveResponse;
        if (data && data.decision && typeof data.decision.row === 'number') {
          return data;
        }
      }
    } catch {
      // Microservice is booting or offline, transparent fallback to tactical engine
    }

    // Fallback: Intelligent Local Tactical Heuristics (HUNT & TARGET with Parity)
    const fallbackDecision = this.computeTacticalFallback(shotsHistory, remainingShipsLengths);
    const inferenceTimeMs = Math.round(performance.now() - startTime);

    return {
      decision: fallbackDecision.coord,
      mode: fallbackDecision.mode,
      heuristic: `local_fallback_${fallbackDecision.heuristic}`,
      inferenceTimeMs
    };
  }

  /**
   * Local Tactical AI Engine:
   * - TARGET MODE: Identifies unsunk HITs, detects collinear alignments, fires at endpoints or orthogonal neighbors.
   * - HUNT MODE: Parity search (checkerboard) with clearance for smallest remaining ship.
   */
  public static computeTacticalFallback(
    shotsHistory: PrologShotHistoryItem[],
    remainingShipsLengths: number[]
  ): { coord: { row: number; col: number }; mode: 'HUNT' | 'TARGET'; heuristic: string } {
    const shotSet = new Set(shotsHistory.map(s => `${s.row},${s.col}`));
    const smallestShip = remainingShipsLengths.length > 0 ? Math.min(...remainingShipsLengths) : 2;

    // 1. Check for unsunk HITs -> TARGET MODE
    const unsunkHits = shotsHistory.filter(s => s.result === 'HIT' && !s.shipSunk);

    if (unsunkHits.length > 0) {
      // If 2 or more hits exist, check if they share a row or column
      if (unsunkHits.length >= 2) {
        // Group by row
        const rowGroups = new Map<number, number[]>();
        const colGroups = new Map<number, number[]>();
        for (const hit of unsunkHits) {
          if (!rowGroups.has(hit.row)) rowGroups.set(hit.row, []);
          rowGroups.get(hit.row)!.push(hit.col);

          if (!colGroups.has(hit.col)) colGroups.set(hit.col, []);
          colGroups.get(hit.col)!.push(hit.row);
        }

        // Check horizontal line
        for (const [r, cols] of rowGroups.entries()) {
          if (cols.length >= 2) {
            cols.sort((a, b) => a - b);
            const minCol = cols[0];
            const maxCol = cols[cols.length - 1];
            // Candidate: minCol - 1 or maxCol + 1
            const candidates = [
              { row: r, col: maxCol + 1 },
              { row: r, col: minCol - 1 }
            ].filter(c => c.col >= 0 && c.col < 10 && !shotSet.has(`${c.row},${c.col}`));

            if (candidates.length > 0) {
              return {
                coord: candidates[Math.floor(Math.random() * candidates.length)],
                mode: 'TARGET',
                heuristic: 'collinear_horizontal_endpoint'
              };
            }
          }
        }

        // Check vertical line
        for (const [c, rows] of colGroups.entries()) {
          if (rows.length >= 2) {
            rows.sort((a, b) => a - b);
            const minRow = rows[0];
            const maxRow = rows[rows.length - 1];
            const candidates = [
              { row: maxRow + 1, col: c },
              { row: minRow - 1, col: c }
            ].filter(cand => cand.row >= 0 && cand.row < 10 && !shotSet.has(`${cand.row},${cand.col}`));

            if (candidates.length > 0) {
              return {
                coord: candidates[Math.floor(Math.random() * candidates.length)],
                mode: 'TARGET',
                heuristic: 'collinear_vertical_endpoint'
              };
            }
          }
        }
      }

      // Check orthogonal neighbors of any unsunk hit
      const targetCandidates: Array<{ row: number; col: number }> = [];
      for (const hit of unsunkHits) {
        const neighbors = [
          { row: hit.row - 1, col: hit.col },
          { row: hit.row + 1, col: hit.col },
          { row: hit.row, col: hit.col - 1 },
          { row: hit.row, col: hit.col + 1 }
        ];

        for (const n of neighbors) {
          if (n.row >= 0 && n.row < 10 && n.col >= 0 && n.col < 10) {
            if (!shotSet.has(`${n.row},${n.col}`)) {
              targetCandidates.push(n);
            }
          }
        }
      }

      if (targetCandidates.length > 0) {
        return {
          coord: targetCandidates[Math.floor(Math.random() * targetCandidates.length)],
          mode: 'TARGET',
          heuristic: 'orthogonal_neighbor_spread'
        };
      }
    }

    // 2. HUNT MODE: Checkerboard Parity Search
    const parityCandidates: Array<{ row: number; col: number }> = [];
    const allFreeCells: Array<{ row: number; col: number }> = [];

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const key = `${r},${c}`;
        if (!shotSet.has(key)) {
          allFreeCells.push({ row: r, col: c });
          // Parity check
          if ((r + c) % 2 === 0) {
            // Verify there is space around this cell for the smallest remaining ship
            if (this.hasRoomForShip(r, c, smallestShip, shotSet)) {
              parityCandidates.push({ row: r, col: c });
            }
          }
        }
      }
    }

    if (parityCandidates.length > 0) {
      return {
        coord: parityCandidates[Math.floor(Math.random() * parityCandidates.length)],
        mode: 'HUNT',
        heuristic: 'checkerboard_parity_probability'
      };
    }

    // Fallback if parity cells are exhausted
    if (allFreeCells.length > 0) {
      return {
        coord: allFreeCells[Math.floor(Math.random() * allFreeCells.length)],
        mode: 'HUNT',
        heuristic: 'random_free_cell'
      };
    }

    return {
      coord: { row: 0, col: 0 },
      mode: 'HUNT',
      heuristic: 'exhaustion'
    };
  }

  private static hasRoomForShip(
    row: number,
    col: number,
    shipLen: number,
    shotSet: Set<string>
  ): boolean {
    // Check horizontal clearance
    let hClear = 1;
    // to left
    for (let c = col - 1; c >= 0 && !shotSet.has(`${row},${c}`) && (col - c) < shipLen; c++) {
      hClear++;
    }
    // to right
    for (let c = col + 1; c < 10 && !shotSet.has(`${row},${c}`) && (c - col) < shipLen; c++) {
      hClear++;
    }
    if (hClear >= shipLen) return true;

    // Check vertical clearance
    let vClear = 1;
    for (let r = row - 1; r >= 0 && !shotSet.has(`${r},${col}`) && (row - r) < shipLen; r++) {
      vClear++;
    }
    for (let r = row + 1; r < 10 && !shotSet.has(`${r},${col}`) && (r - row) < shipLen; r++) {
      vClear++;
    }
    return vClear >= shipLen;
  }
}
