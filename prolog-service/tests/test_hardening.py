"""
test_hardening.py - sunk-ship reconstruction, Prolog/Python parity and input validation.
"""

import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from solver import PrologBattleshipSolver, compute_sunk_cells, sanitize_request

client = TestClient(app)
ALL_SHIPS = [5, 4, 3, 3, 2]


@pytest.fixture
def solver():
    return PrologBattleshipSolver()


def shot(r, c, res="HIT", sunk=None):
    return {"row": r, "col": c, "result": res, "shipSunk": sunk}


ADJACENT = [shot(2, 2), shot(2, 3, sunk="Destroyer"), shot(3, 3)]


def test_adjacent_ship_hit_is_not_marked_sunk():
    sunk = compute_sunk_cells(ADJACENT)
    assert sunk == {(2, 2), (2, 3)}


def test_adjacent_ship_keeps_target_mode(solver):
    r, c, mode, _, _ = solver.solve(10, 10, ADJACENT, [5, 4, 3, 3], "tactical")
    assert mode == "TARGET"
    assert abs(r - 3) + abs(c - 3) == 1


def test_swipl_path_does_not_fall_back_to_python(solver):
    """If swipl is installed the answer must come from Prolog (no _PY suffix)."""
    if not solver.has_swipl:
        pytest.skip("swipl not installed")
    _, _, _, heuristic, _ = solver.solve(10, 10, [], ALL_SHIPS, "tactical")
    assert not heuristic.endswith("_PY")


@pytest.mark.parametrize("shots", [
    [],
    [shot(4, 4)],
    [shot(3, 4), shot(3, 5)],
    ADJACENT,
    [shot(1, 1), shot(1, 2), shot(1, 3, sunk="Cruiser"), shot(5, 5, "MISS")],
])
def test_prolog_and_python_engines_agree(solver, shots):
    if not solver.has_swipl:
        pytest.skip("swipl not installed")
    args = sanitize_request(10, 10, shots, ALL_SHIPS, "tactical")
    pl = solver._solve_with_swipl(*args[:4], args[4])
    py = solver._solve_python_fallback(*args[:4], args[4])
    assert pl[2] == py[2]  # same mode
    assert pl[3] == py[3]  # same heuristic family


def test_orthogonal_neighbour_prefers_cells_where_ship_fits(solver):
    shots = [shot(0, 0), shot(0, 2, "MISS"), shot(1, 1, "MISS")]
    r, c, mode, _, _ = solver.solve(10, 10, shots, [3], "tactical")
    assert (mode, r, c) == ("TARGET", 1, 0)


# ---------------------------------------------------------------- injection / validation
INJECTION = "x'), shell(calc), foo('"


def test_solver_rejects_malicious_ship_name(solver):
    with pytest.raises(ValueError):
        solver.solve(10, 10, [shot(0, 0, sunk=INJECTION)], ALL_SHIPS, "tactical")


def test_solver_rejects_malicious_result_and_difficulty(solver):
    with pytest.raises(ValueError):
        solver.solve(10, 10, [shot(0, 0, res=INJECTION)], ALL_SHIPS, "tactical")
    with pytest.raises(ValueError):
        solver.solve(10, 10, [], ALL_SHIPS, INJECTION)


def _payload(**over):
    body = {
        "matchId": "00000000-0000-4000-8000-000000000000",
        "difficulty": "tactical",
        "boardDimensions": {"rows": 10, "cols": 10},
        "shotsHistory": [],
        "remainingShipsLengths": ALL_SHIPS,
    }
    body.update(over)
    return body


@pytest.mark.parametrize("over", [
    {"shotsHistory": [shot(0, 0, sunk=INJECTION)]},
    {"shotsHistory": [shot(0, 0, res="HIT'); halt;('")]},
    {"difficulty": INJECTION},
    {"shotsHistory": [shot(10, 0)]},          # outside a 10x10 board
    {"remainingShipsLengths": [0]},
    {"remainingShipsLengths": [999]},
])
def test_api_rejects_invalid_payloads(over):
    resp = client.post("/api/ai/battleship/next-move", json=_payload(**over))
    assert resp.status_code == 422


def test_api_accepts_valid_payload():
    resp = client.post("/api/ai/battleship/next-move", json=_payload(shotsHistory=ADJACENT))
    assert resp.status_code == 200
    assert resp.json()["mode"] == "TARGET"
