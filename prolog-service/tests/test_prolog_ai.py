"""
test_prolog_ai.py - Unit tests for Prolog AI logic (HUNT and TARGET heuristics).
"""

import sys
import os
import pytest

# Add parent directory to sys.path so we can import solver
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from solver import PrologBattleshipSolver


@pytest.fixture
def solver():
    return PrologBattleshipSolver()


def test_hunt_mode_empty_board(solver):
    """Empty board should select HUNT mode with parity (row + col % 2 == 0)."""
    r, c, mode, heuristic, elapsed = solver.solve(
        rows=10, cols=10,
        shots_history=[],
        remaining_lengths=[5, 4, 3, 3, 2],
        difficulty="tactical"
    )
    assert mode == "HUNT"
    assert (r + c) % 2 == 0
    assert 0 <= r < 10
    assert 0 <= c < 10
    assert "PARITY" in heuristic
    assert elapsed >= 0.0


def test_hunt_avoids_shot_cells(solver):
    """Solver should never pick a cell that was already shot."""
    shots = [
        {"row": 4, "col": 4, "result": "MISS", "shipSunk": None},
        {"row": 5, "col": 5, "result": "MISS", "shipSunk": None},
    ]
    r, c, mode, _, _ = solver.solve(
        rows=10, cols=10,
        shots_history=shots,
        remaining_lengths=[5, 4, 3, 3, 2],
        difficulty="tactical"
    )
    assert mode == "HUNT"
    assert (r, c) not in [(4, 4), (5, 5)]
    assert (r + c) % 2 == 0


def test_hunt_fit_filter_discards_trapped_cell(solver):
    """Cell (0, 0) trapped by MISS at (0, 1) and (1, 0) cannot fit a ship of length 2."""
    shots = [
        {"row": 0, "col": 1, "result": "MISS", "shipSunk": None},
        {"row": 1, "col": 0, "result": "MISS", "shipSunk": None},
    ]
    r, c, mode, _, _ = solver.solve(
        rows=10, cols=10,
        shots_history=shots,
        remaining_lengths=[2],
        difficulty="tactical"
    )
    assert mode == "HUNT"
    assert (r, c) != (0, 0)


def test_target_mode_single_hit(solver):
    """Single active hit triggers TARGET mode and selects orthogonal neighbor."""
    shots = [
        {"row": 4, "col": 4, "result": "HIT", "shipSunk": None}
    ]
    r, c, mode, heuristic, _ = solver.solve(
        rows=10, cols=10,
        shots_history=shots,
        remaining_lengths=[5, 4, 3, 3, 2],
        difficulty="tactical"
    )
    assert mode == "TARGET"
    assert "ORTHOGONAL" in heuristic
    assert (r, c) in [(3, 4), (5, 4), (4, 3), (4, 5)]


def test_target_mode_horizontal_line_extremities(solver):
    """Two contiguous horizontal hits detect line orientation and prioritize endpoints."""
    shots = [
        {"row": 3, "col": 4, "result": "HIT", "shipSunk": None},
        {"row": 3, "col": 5, "result": "HIT", "shipSunk": None},
    ]
    r, c, mode, heuristic, _ = solver.solve(
        rows=10, cols=10,
        shots_history=shots,
        remaining_lengths=[5, 4, 3, 3, 2],
        difficulty="tactical"
    )
    assert mode == "TARGET"
    assert "HORIZONTAL_EXTREME" in heuristic
    assert (r, c) in [(3, 6), (3, 3)]


def test_target_mode_horizontal_line_endpoint_blocked(solver):
    """If right endpoint is blocked, selects left endpoint."""
    shots = [
        {"row": 3, "col": 4, "result": "HIT", "shipSunk": None},
        {"row": 3, "col": 5, "result": "HIT", "shipSunk": None},
        {"row": 3, "col": 6, "result": "MISS", "shipSunk": None},
    ]
    r, c, mode, heuristic, _ = solver.solve(
        rows=10, cols=10,
        shots_history=shots,
        remaining_lengths=[5, 4, 3, 3, 2],
        difficulty="tactical"
    )
    assert mode == "TARGET"
    assert "HORIZONTAL_EXTREME" in heuristic
    assert (r, c) == (3, 3)


def test_target_mode_vertical_line_extremities(solver):
    """Two contiguous vertical hits detect line orientation and prioritize endpoints."""
    shots = [
        {"row": 5, "col": 2, "result": "HIT", "shipSunk": None},
        {"row": 6, "col": 2, "result": "HIT", "shipSunk": None},
    ]
    r, c, mode, heuristic, _ = solver.solve(
        rows=10, cols=10,
        shots_history=shots,
        remaining_lengths=[5, 4, 3, 3, 2],
        difficulty="tactical"
    )
    assert mode == "TARGET"
    assert "VERTICAL_EXTREME" in heuristic
    assert (r, c) in [(7, 2), (4, 2)]


def test_target_resets_to_hunt_when_ship_sunk(solver):
    """When a ship is sunk, active hits are cleared and mode transitions back to HUNT."""
    shots = [
        {"row": 2, "col": 2, "result": "HIT", "shipSunk": None},
        {"row": 2, "col": 3, "result": "HIT", "shipSunk": "Patrol Boat"},
    ]
    r, c, mode, heuristic, _ = solver.solve(
        rows=10, cols=10,
        shots_history=shots,
        remaining_lengths=[5, 4, 3, 3],
        difficulty="tactical"
    )
    assert mode == "HUNT"
    assert "HUNT" in heuristic
    assert (r, c) not in [(2, 2), (2, 3)]


def test_python_fallback_mode(solver):
    """Forcing Python fallback should produce identical consistent decisions."""
    saved_has_swipl = solver.has_swipl
    try:
        solver.has_swipl = False
        r, c, mode, heuristic, _ = solver.solve(
            rows=10, cols=10,
            shots_history=[],
            remaining_lengths=[5, 4, 3, 3, 2],
            difficulty="tactical"
        )
        assert mode == "HUNT"
        assert (r + c) % 2 == 0
        assert "PY" in heuristic
    finally:
        solver.has_swipl = saved_has_swipl


def test_target_mode_board_edge_limits(solver):
    """When a line hit reaches the board boundary, it chooses the opposite in-bounds end."""
    # Top edge vertical hit: (0, 3) and (1, 3). Above (0, 3) is -1 (off-board). Must pick (2, 3).
    shots = [
        {"row": 0, "col": 3, "result": "HIT", "shipSunk": None},
        {"row": 1, "col": 3, "result": "HIT", "shipSunk": None},
    ]
    r, c, mode, heuristic, _ = solver.solve(
        rows=10, cols=10,
        shots_history=shots,
        remaining_lengths=[5, 4, 3, 3, 2],
        difficulty="tactical"
    )
    assert mode == "TARGET"
    assert (r, c) == (2, 3)


def test_target_mode_three_contiguous_hits(solver):
    """A 3-hit horizontal line should pick endpoints outside the 3 hits."""
    shots = [
        {"row": 4, "col": 4, "result": "HIT", "shipSunk": None},
        {"row": 4, "col": 5, "result": "HIT", "shipSunk": None},
        {"row": 4, "col": 6, "result": "HIT", "shipSunk": None},
    ]
    r, c, mode, heuristic, _ = solver.solve(
        rows=10, cols=10,
        shots_history=shots,
        remaining_lengths=[5, 4],
        difficulty="tactical"
    )
    assert mode == "TARGET"
    assert (r, c) in [(4, 7), (4, 3)]


def test_custom_board_dimensions(solver):
    """Respects arbitrary board dimensions like 8x8."""
    r, c, mode, heuristic, _ = solver.solve(
        rows=8, cols=8,
        shots_history=[],
        remaining_lengths=[3, 2],
        difficulty="tactical"
    )
    assert 0 <= r < 8
    assert 0 <= c < 8
    assert mode == "HUNT"

