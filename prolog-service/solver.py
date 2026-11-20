"""
solver.py - Battleship AI Solver Interface
Bridge between FastAPI and SWI-Prolog (with robust pure-Python fallback).
"""

import os
import re
import subprocess
import time
import shutil
import logging
from typing import List, Dict, Any, Tuple, Optional

logger = logging.getLogger("prolog_solver")

PROLOG_FILE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "battleship_ai.pl")

ALLOWED_RESULTS = {"HIT", "MISS"}
ALLOWED_DIFFICULTIES = {"easy", "tactical", "hard"}
# Ship names are interpolated into a Prolog goal: only a conservative charset is allowed.
SHIP_NAME_RE = re.compile(r"^[A-Za-z0-9 _.-]{1,40}$")
MAX_BOARD_SIZE = 26

# Must stay in sync with ship_length/2 in battleship_ai.pl
SHIP_LENGTHS = {
    "Aircraft Carrier": 5,
    "Carrier": 5,
    "Battleship": 4,
    "Cruiser": 3,
    "Submarine": 3,
    "Destroyer": 2,
    "Patrol Boat": 2,
}
DEFAULT_SHIP_LENGTH = 2


def _is_sunk_name(sunk: Any) -> bool:
    return sunk is not None and sunk not in ("null", "none", "")


def sanitize_request(
    rows: int,
    cols: int,
    shots_history: List[Dict[str, Any]],
    remaining_lengths: List[int],
    difficulty: str,
) -> Tuple[int, int, List[Dict[str, Any]], List[int], str]:
    """
    Validates and normalises every value that ends up inside a Prolog goal.
    Raises ValueError on anything unexpected (never silently coerces strings into atoms).
    """
    rows, cols = int(rows), int(cols)
    if not (1 <= rows <= MAX_BOARD_SIZE and 1 <= cols <= MAX_BOARD_SIZE):
        raise ValueError("Board dimensions out of range")

    difficulty = (difficulty or "tactical").lower()
    if difficulty not in ALLOWED_DIFFICULTIES:
        raise ValueError(f"Invalid difficulty: {difficulty!r}")

    clean_shots: List[Dict[str, Any]] = []
    for s in shots_history:
        r, c = int(s.get("row", 0)), int(s.get("col", 0))
        if not (0 <= r < rows and 0 <= c < cols):
            raise ValueError(f"Shot ({r},{c}) outside the board")
        res = str(s.get("result", "MISS")).upper()
        if res not in ALLOWED_RESULTS:
            raise ValueError(f"Invalid shot result: {res!r}")
        sunk = s.get("shipSunk")
        if _is_sunk_name(sunk):
            if not isinstance(sunk, str) or not SHIP_NAME_RE.match(sunk):
                raise ValueError("Invalid shipSunk value")
        else:
            sunk = None
        clean_shots.append({"row": r, "col": c, "result": res, "shipSunk": sunk})

    clean_lengths = [int(n) for n in remaining_lengths]
    if len(clean_lengths) > 20 or any(not (1 <= n <= MAX_BOARD_SIZE) for n in clean_lengths):
        raise ValueError("Invalid remainingShipsLengths")

    return rows, cols, clean_shots, clean_lengths, difficulty


def compute_sunk_cells(shots_history: List[Dict[str, Any]]) -> set:
    """
    Python mirror of sunk_cells/2 in battleship_ai.pl.
    Only the last hit of a ship carries shipSunk; a ship of length L occupies a straight
    segment of L HIT cells containing it, made of hits shot BEFORE the sinking and not yet
    claimed. Ties go to the segment built from the most recent shots.
    """
    claimed: set = set()
    prefix: List[Tuple[int, int]] = []  # earlier HIT cells, most recent first
    for s in shots_history:
        r, c = int(s["row"]), int(s["col"])
        if str(s.get("result", "")).upper() == "HIT" and _is_sunk_name(s.get("shipSunk")):
            length = SHIP_LENGTHS.get(s["shipSunk"], DEFAULT_SHIP_LENGTH)
            best_score, best_seg = None, None
            for off in range(length):
                segs = [
                    [(r, c - off + i) for i in range(length)],
                    [(r - off + i, c) for i in range(length)],
                ]
                for seg in segs:
                    if min(min(p) for p in seg) < 0:
                        continue
                    score, ok = 0, True
                    for cell in seg:
                        if cell == (r, c):
                            continue
                        if cell in claimed or cell not in prefix:
                            ok = False
                            break
                        score -= prefix.index(cell)
                    if ok and (best_score is None or score >= best_score):
                        best_score, best_seg = score, seg
            claimed.update(best_seg if best_seg else [(r, c)])
        if str(s.get("result", "")).upper() == "HIT":
            prefix.insert(0, (r, c))
    return claimed


def _pl_atom(value: str) -> str:
    """Quotes a validated string as a Prolog atom (defence in depth: escapes \\ and ')."""
    return "'" + value.replace("\\", "\\\\").replace("'", "\\'") + "'"


def check_swipl_installed() -> bool:
    """Checks if swipl executable is available in PATH."""
    return shutil.which("swipl") is not None


class PrologBattleshipSolver:
    """Executes Battleship AI queries via SWI-Prolog subprocess with robust fallback."""

    def __init__(self, pl_path: str = PROLOG_FILE_PATH):
        self.pl_path = pl_path
        self.has_swipl = check_swipl_installed()
        if not self.has_swipl:
            logger.warning("SWI-Prolog (swipl) not found in PATH. Will use built-in Python AI fallback.")

    def solve(
        self,
        rows: int,
        cols: int,
        shots_history: List[Dict[str, Any]],
        remaining_lengths: List[int],
        difficulty: str = "tactical"
    ) -> Tuple[int, int, str, str, float]:
        """
        Solves next move returning (row, col, mode, heuristic, inference_time_ms).
        """
        # Raises ValueError for malformed input (deliberately NOT swallowed by the fallback)
        rows, cols, shots_history, remaining_lengths, difficulty = sanitize_request(
            rows, cols, shots_history, remaining_lengths, difficulty
        )
        start_time = time.perf_counter()

        if self.has_swipl and os.path.exists(self.pl_path):
            try:
                row, col, mode, heuristic = self._solve_with_swipl(
                    rows, cols, shots_history, remaining_lengths, difficulty
                )
                elapsed_ms = (time.perf_counter() - start_time) * 1000.0
                return row, col, mode, heuristic, round(elapsed_ms, 2)
            except Exception as e:
                logger.error(f"Error executing swipl query: {e}. Falling back to Python solver.")

        # Fallback to Python solver
        row, col, mode, heuristic = self._solve_python_fallback(
            rows, cols, shots_history, remaining_lengths, difficulty
        )
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        return row, col, mode, f"{heuristic}_PY", round(elapsed_ms, 2)

    def _solve_with_swipl(
        self,
        rows: int,
        cols: int,
        shots_history: List[Dict[str, Any]],
        remaining_lengths: List[int],
        difficulty: str
    ) -> Tuple[int, int, str, str]:
        """Runs SWI-Prolog query via swipl CLI."""
        # Inputs were validated by sanitize_request(); atoms are still escaped on top of that.
        shots_terms = []
        for s in shots_history:
            sunk = s.get("shipSunk")
            sunk_term = _pl_atom(sunk) if sunk else "null"
            shots_terms.append(
                f"shot({int(s['row'])},{int(s['col'])},{_pl_atom(s['result'])},{sunk_term})"
            )

        shots_str = "[" + ",".join(shots_terms) + "]"
        lengths_str = "[" + ",".join(str(int(l)) for l in remaining_lengths) + "]"
        diff_str = _pl_atom(difficulty)

        goal = (
            f"solve_move({int(rows)}, {int(cols)}, {shots_str}, {lengths_str}, {diff_str}, "
            f"Row, Col, Mode, Heuristic), "
            f"format('~w,~w,~w,~w~n', [Row, Col, Mode, Heuristic])"
        )

        pl_posix = self.pl_path.replace("\\", "/")
        cmd = [
            "swipl",
            "-q",
            "-s", pl_posix,
            "-g", goal,
            "-t", "halt"
        ]

        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=3.0,
            check=True
        )

        stdout = proc.stdout.strip()
        if not stdout:
            raise ValueError(f"Empty output from swipl. Stderr: {proc.stderr}")

        # The last line of stdout should contain Row,Col,Mode,Heuristic
        lines = [line.strip() for line in stdout.splitlines() if line.strip()]
        last_line = lines[-1]
        parts = last_line.split(",")
        if len(parts) != 4:
            raise ValueError(f"Unexpected output format from swipl: {last_line}")

        row = int(parts[0].strip())
        col = int(parts[1].strip())
        mode = parts[2].strip()
        heuristic = parts[3].strip()
        return row, col, mode, heuristic

    def _solve_python_fallback(
        self,
        rows: int,
        cols: int,
        shots_history: List[Dict[str, Any]],
        remaining_lengths: List[int],
        difficulty: str
    ) -> Tuple[int, int, str, str]:
        """Pure Python fallback implementing the exact same logic as battleship_ai.pl."""
        shot_map = {}
        for s in shots_history:
            r = int(s.get("row", 0))
            c = int(s.get("col", 0))
            res = s.get("result", "MISS").upper()
            sunk = s.get("shipSunk")
            shot_map[(r, c)] = {"result": res, "shipSunk": sunk}

        # 1. Active hits: HITs that do not belong to a sunk ship
        all_sunk = compute_sunk_cells(shots_history)

        active_hits = [
            coord for coord, data in shot_map.items()
            if data["result"] == "HIT" and coord not in all_sunk
        ]

        min_len = min(remaining_lengths) if remaining_lengths else 2

        # TARGET MODE: If active hits exist
        if active_hits:
            active_set = set(active_hits)
            # Try line extremities
            # Horizontal lines
            for r, c1 in active_hits:
                c2 = c1 + 1
                if (r, c2) in active_set:
                    # Contiguous horizontal line found
                    # Look right
                    c_right = c2 + 1
                    while (r, c_right) in active_set:
                        c_right += 1
                    if 0 <= c_right < cols and (r, c_right) not in shot_map:
                        return r, c_right, "TARGET", "TARGET_LINE_HORIZONTAL_EXTREME"
                    # Look left
                    c_left = c1 - 1
                    while (r, c_left) in active_set:
                        c_left -= 1
                    if 0 <= c_left < cols and (r, c_left) not in shot_map:
                        return r, c_left, "TARGET", "TARGET_LINE_HORIZONTAL_EXTREME"

            # Vertical lines
            for r1, c in active_hits:
                r2 = r1 + 1
                if (r2, c) in active_set:
                    # Look down
                    r_down = r2 + 1
                    while (r_down, c) in active_set:
                        r_down += 1
                    if 0 <= r_down < rows and (r_down, c) not in shot_map:
                        return r_down, c, "TARGET", "TARGET_LINE_VERTICAL_EXTREME"
                    # Look up
                    r_up = r1 - 1
                    while (r_up, c) in active_set:
                        r_up -= 1
                    if 0 <= r_up < rows and (r_up, c) not in shot_map:
                        return r_up, c, "TARGET", "TARGET_LINE_VERTICAL_EXTREME"

            # Single hit or broken line: Orthogonal neighbors
            for hr, hc in active_hits:
                for dr, dc in [(-1, 0), (1, 0), (0, 1), (0, -1)]:
                    nr, nc = hr + dr, hc + dc
                    if 0 <= nr < rows and 0 <= nc < cols and (nr, nc) not in shot_map:
                        if difficulty in ("hard", "tactical"):
                            if self._ship_fits(nr, nc, min_len, rows, cols, shot_map, all_sunk):
                                return nr, nc, "TARGET", "TARGET_ORTHOGONAL_NEIGHBOR"
                        else:
                            return nr, nc, "TARGET", "TARGET_ORTHOGONAL_NEIGHBOR"

            # If fit check filtered out all neighbors, pick any unshot orthogonal neighbor
            for hr, hc in active_hits:
                for dr, dc in [(-1, 0), (1, 0), (0, 1), (0, -1)]:
                    nr, nc = hr + dr, hc + dc
                    if 0 <= nr < rows and 0 <= nc < cols and (nr, nc) not in shot_map:
                        return nr, nc, "TARGET", "TARGET_ORTHOGONAL_NEIGHBOR"

        # HUNT MODE
        # 1. Parity and fit
        parity_candidates = []
        center_r, center_c = (rows - 1) / 2.0, (cols - 1) / 2.0
        for r in range(rows):
            for c in range(cols):
                if (r + c) % 2 == 0 and (r, c) not in shot_map:
                    if self._ship_fits(r, c, min_len, rows, cols, shot_map, all_sunk):
                        dist = abs(r - center_r) + abs(c - center_c)
                        parity_candidates.append(((r, c), dist))

        if parity_candidates:
            if difficulty in ("hard", "tactical"):
                parity_candidates.sort(key=lambda item: item[1])
            best = parity_candidates[0][0]
            return best[0], best[1], "HUNT", "HUNT_PARITY_FIT"

        # 2. Relaxed: Ship fits without parity
        fit_candidates = []
        for r in range(rows):
            for c in range(cols):
                if (r, c) not in shot_map:
                    if self._ship_fits(r, c, min_len, rows, cols, shot_map, all_sunk):
                        dist = abs(r - center_r) + abs(c - center_c)
                        fit_candidates.append(((r, c), dist))

        if fit_candidates:
            if difficulty in ("hard", "tactical"):
                fit_candidates.sort(key=lambda item: item[1])
            best = fit_candidates[0][0]
            return best[0], best[1], "HUNT", "HUNT_ANY_FIT"

        # 3. Any unshot cell
        for r in range(rows):
            for c in range(cols):
                if (r, c) not in shot_map:
                    return r, c, "HUNT", "HUNT_FALLBACK_UNSHOT"

        return 0, 0, "HUNT", "HUNT_FALLBACK_NONE"

    def _ship_fits(
        self,
        r: int,
        c: int,
        length: int,
        rows: int,
        cols: int,
        shot_map: Dict[Tuple[int, int], Dict[str, Any]],
        all_sunk: set
    ) -> bool:
        """Checks if a ship of length fits horizontally or vertically through (r, c)."""
        if length <= 1:
            return True

        def is_blocked(row: int, col: int) -> bool:
            if (row, col) in all_sunk:
                return True
            data = shot_map.get((row, col))
            if data and data["result"] == "MISS":
                return True
            return False

        # Horizontal check
        for offset in range(length):
            start_col = c - offset
            end_col = start_col + length - 1
            if 0 <= start_col and end_col < cols:
                span_ok = True
                for col_idx in range(start_col, end_col + 1):
                    if is_blocked(r, col_idx):
                        span_ok = False
                        break
                if span_ok:
                    return True

        # Vertical check
        for offset in range(length):
            start_row = r - offset
            end_row = start_row + length - 1
            if 0 <= start_row and end_row < rows:
                span_ok = True
                for row_idx in range(start_row, end_row + 1):
                    if is_blocked(row_idx, c):
                        span_ok = False
                        break
                if span_ok:
                    return True

        return False
