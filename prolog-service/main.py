"""
main.py - FastAPI Microservice for Battleship AI (SWI-Prolog Engine)
GameConsole - Carril C (Microservicio Prolog IA)
"""

import logging
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from solver import PrologBattleshipSolver, check_swipl_installed

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("prolog_service")

# Initialize AI Solver
solver = PrologBattleshipSolver()


@asynccontextmanager
async def lifespan(app: FastAPI):
    swipl_ok = check_swipl_installed()
    logger.info(f"Prolog AI Microservice starting up. SWI-Prolog available: {swipl_ok}")
    yield
    logger.info("Prolog AI Microservice shutting down.")


app = FastAPI(
    title="GameConsole Prolog Battleship AI Service",
    description="Intelligent Battleship move generator using SWI-Prolog (Hunt & Target strategies)",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for cross-origin requests from gameconsole-web and other services
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Data Contracts (Aligned with gameconsole-web/src/types/contracts.ts)
# -----------------------------------------------------------------------------

class ShotHistoryItem(BaseModel):
    row: int = Field(..., ge=0, description="Row index (0-based)")
    col: int = Field(..., ge=0, description="Column index (0-based)")
    result: str = Field(..., description="'HIT' or 'MISS'")
    shipSunk: Optional[str] = Field(None, description="Name of ship sunk or null")


class BoardDimensions(BaseModel):
    rows: int = Field(10, ge=1, le=26, description="Number of rows")
    cols: int = Field(10, ge=1, le=26, description="Number of columns")


class PrologMoveRequest(BaseModel):
    matchId: str = Field(..., description="UUID of the match")
    difficulty: Optional[str] = Field("tactical", description="'easy' | 'tactical' | 'hard'")
    boardDimensions: Optional[BoardDimensions] = Field(default_factory=BoardDimensions)
    shotsHistory: List[ShotHistoryItem] = Field(default_factory=list)
    remainingShipsLengths: List[int] = Field(default_factory=lambda: [5, 4, 3, 3, 2])


class DecisionCoord(BaseModel):
    row: int
    col: int


class PrologMoveResponse(BaseModel):
    decision: DecisionCoord
    mode: str = Field(..., description="'HUNT' or 'TARGET'")
    heuristic: str
    inferenceTimeMs: float


class PrologHealthResponse(BaseModel):
    status: str
    service: str
    prologEngine: str


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@app.get("/health", response_model=PrologHealthResponse, tags=["Health"])
@app.get("/api/ai/health", response_model=PrologHealthResponse, include_in_schema=False)
async def health_check():
    """Returns the health status and engine info of the Prolog AI service."""
    engine_name = "SWI-Prolog" if solver.has_swipl else "SWI-Prolog (Emulated Python Engine)"
    return PrologHealthResponse(
        status="ok",
        service="gameconsole-prolog-ai",
        prologEngine=engine_name
    )


@app.post("/api/ai/battleship/next-move", response_model=PrologMoveResponse, tags=["Battleship AI"])
@app.post("/next-move", response_model=PrologMoveResponse, include_in_schema=False)
async def next_move(request: PrologMoveRequest):
    """
    Computes the next optimal move for Battleship using SWI-Prolog Hunt/Target heuristics.
    """
    try:
        dims = request.boardDimensions or BoardDimensions(rows=10, cols=10)
        shots = [s.model_dump() for s in request.shotsHistory]
        remaining = request.remainingShipsLengths if request.remainingShipsLengths else [5, 4, 3, 3, 2]
        difficulty = request.difficulty or "tactical"

        row, col, mode, heuristic, inference_time_ms = solver.solve(
            rows=dims.rows,
            cols=dims.cols,
            shots_history=shots,
            remaining_lengths=remaining,
            difficulty=difficulty
        )

        return PrologMoveResponse(
            decision=DecisionCoord(row=row, col=col),
            mode=mode,
            heuristic=heuristic,
            inferenceTimeMs=inference_time_ms
        )
    except Exception as e:
        logger.exception("Failed to compute next move")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI inference error: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=False)
