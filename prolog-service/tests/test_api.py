"""
test_api.py - Integration tests for FastAPI endpoints in main.py.
"""

import sys
import os
import pytest
from fastapi.testclient import TestClient

# Add parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app

client = TestClient(app)


def test_health_endpoint():
    """GET /health must return 200 with service name and prolog engine."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "gameconsole-prolog-ai"
    assert "Prolog" in data["prologEngine"]


def test_health_alias_endpoint():
    """GET /api/ai/health should also return 200."""
    response = client.get("/api/ai/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_next_move_empty_board():
    """POST /api/ai/battleship/next-move returns valid HUNT move."""
    payload = {
        "matchId": "123e4567-e89b-12d3-a456-426614174000",
        "difficulty": "tactical",
        "boardDimensions": {"rows": 10, "cols": 10},
        "shotsHistory": [],
        "remainingShipsLengths": [5, 4, 3, 3, 2]
    }
    response = client.post("/api/ai/battleship/next-move", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "decision" in data
    assert 0 <= data["decision"]["row"] < 10
    assert 0 <= data["decision"]["col"] < 10
    assert data["mode"] == "HUNT"
    assert data["heuristic"] != ""
    assert data["inferenceTimeMs"] >= 0.0


def test_next_move_target_single_hit():
    """POST /api/ai/battleship/next-move with single hit triggers TARGET mode."""
    payload = {
        "matchId": "test-match-1",
        "difficulty": "tactical",
        "boardDimensions": {"rows": 10, "cols": 10},
        "shotsHistory": [
            {"row": 4, "col": 4, "result": "HIT", "shipSunk": None}
        ],
        "remainingShipsLengths": [5, 4, 3, 3, 2]
    }
    response = client.post("/api/ai/battleship/next-move", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "TARGET"
    assert "ORTHOGONAL" in data["heuristic"]
    decision = data["decision"]
    assert (decision["row"], decision["col"]) in [(3, 4), (5, 4), (4, 3), (4, 5)]


def test_next_move_target_line_extreme():
    """POST /api/ai/battleship/next-move with 2 horizontal hits targets extreme."""
    payload = {
        "matchId": "test-match-2",
        "difficulty": "hard",
        "boardDimensions": {"rows": 10, "cols": 10},
        "shotsHistory": [
            {"row": 6, "col": 6, "result": "HIT", "shipSunk": None},
            {"row": 6, "col": 7, "result": "HIT", "shipSunk": None}
        ],
        "remainingShipsLengths": [4, 3, 2]
    }
    response = client.post("/api/ai/battleship/next-move", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "TARGET"
    assert "HORIZONTAL_EXTREME" in data["heuristic"]
    assert (data["decision"]["row"], data["decision"]["col"]) in [(6, 8), (6, 5)]


def test_next_move_validation_error():
    """Omitting required matchId should trigger 422 Unprocessable Entity."""
    payload = {
        "shotsHistory": []
    }
    response = client.post("/api/ai/battleship/next-move", json=payload)
    assert response.status_code == 422


def test_next_move_alias_endpoint():
    """POST /next-move alias should work identically."""
    payload = {
        "matchId": "test-match-alias",
        "shotsHistory": []
    }
    response = client.post("/next-move", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "HUNT"
