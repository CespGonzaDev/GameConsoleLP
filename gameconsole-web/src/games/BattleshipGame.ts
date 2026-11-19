import { BaseGame, IEventDispatcher, BaseGameOptions } from '../core/BaseGame';
import {
  BattleshipFireShotPayload,
  BattleshipAiDecisionPayload,
  PrologShotHistoryItem
} from '../types/contracts';
import {
  FLEET_CONFIG,
  PlacedShip,
  ShipDefinition,
  ShipOrientation,
  toGameStatsCoord,
  toPrologShotHistory
} from './battleship/BattleshipTypes';
import { BattleshipAi } from './battleship/BattleshipAi';

export type BattleshipPhase =
  | 'PLACEMENT_P1'
  | 'PLACEMENT_P2'
  | 'TURN_TRANSITION'
  | 'COMBAT'
  | 'FINISHED';

export type TurnOwner = 'PLAYER' | 'PLAYER2' | 'AI';

export type TransitionTarget = 'PLACEMENT_P2' | 'COMBAT';

export interface ShotRecord {
  shooter: TurnOwner;
  row: number; // 0-9
  col: number; // 0-9
  result: 'HIT' | 'MISS';
  shipSunk: string | null;
  turn: number;
}

export type StateChangeListener = () => void;

export class BattleshipGame extends BaseGame {
  private readonly isTwoPlayers: boolean;
  private readonly p1Id: string;
  private readonly p2Id: string;

  private phase: BattleshipPhase = 'PLACEMENT_P1';
  private transitionTarget: TransitionTarget | null = null;
  private currentTurn: number = 0;
  private activeTurn: TurnOwner = 'PLAYER';

  // Player 1 Fleet & Shots received (from AI or Player 2)
  private playerShips: PlacedShip[] = [];
  private playerShotsReceived: ShotRecord[] = [];

  // Player 2 / AI Fleet & Shots fired by Player 1
  private p2Ships: PlacedShip[] = [];
  private aiShips: PlacedShip[] = [];
  private playerShotsFired: ShotRecord[] = [];

  // Scores & Winner tracking
  private p1Score: number = 0;
  private p2Score: number = 0;
  private winnerId: string | null = null;

  // Selected ship during placement
  private selectedShipToPlace: ShipDefinition | null = FLEET_CONFIG[0];
  private placementOrientation: ShipOrientation = 'HORIZONTAL';

  // Latest AI telemetry decision
  private latestAiDecision: { mode: 'HUNT' | 'TARGET'; heuristic: string; inferenceTimeMs: number } | null = null;
  private isAiThinking: boolean = false;
  private isDestroyed: boolean = false;

  // React synchronization listener
  private listeners: Set<StateChangeListener> = new Set();

  constructor(
    playerId: string,
    dispatcher: IEventDispatcher,
    options: BaseGameOptions = {}
  ) {
    const resolvedGameMode = options.gameMode || 'SINGLE_VS_AI';
    const isTwoPlayersMode = resolvedGameMode === 'TWO_PLAYERS_LOCAL';
    const resolvedAdditionalPlayers =
      options.additionalPlayers && options.additionalPlayers.length > 0
        ? options.additionalPlayers
        : [isTwoPlayersMode ? 'Player2' : 'CPU_AI'];

    super('battleship', playerId, dispatcher, {
      ...options,
      gameVersion: options.gameVersion || '1.0.0',
      gameMode: resolvedGameMode,
      additionalPlayers: resolvedAdditionalPlayers
    });

    this.isTwoPlayers = this.gameMode === 'TWO_PLAYERS_LOCAL';
    this.p1Id = this.playerId;
    this.p2Id = this.isTwoPlayers ? (this.players[1] || 'Player2') : 'CPU_AI';

    this.resetPlacement();
  }

  // --- Listener Subscription ---
  public subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyChange(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('[BattleshipGame] Error in listener callback:', err);
      }
    }
  }

  // --- Active Placement Fleet Helpers ---
  private getActivePlacingFleet(): PlacedShip[] {
    return this.phase === 'PLACEMENT_P2' ? this.p2Ships : this.playerShips;
  }

  private setActivePlacingFleet(fleet: PlacedShip[]): void {
    if (this.phase === 'PLACEMENT_P2') {
      this.p2Ships = fleet;
    } else {
      this.playerShips = fleet;
    }
  }

  // --- Placement Phase Methods ---
  public resetPlacement(): void {
    this.phase = 'PLACEMENT_P1';
    this.transitionTarget = null;
    this.playerShips = [];
    this.p2Ships = [];
    this.aiShips = [];
    this.playerShotsFired = [];
    this.playerShotsReceived = [];
    this.currentTurn = 0;
    this.activeTurn = 'PLAYER';
    this.p1Score = 0;
    this.p2Score = 0;
    this.currentScore = 0;
    this.winnerId = null;
    this.latestAiDecision = null;
    this.isAiThinking = false;
    this.selectedShipToPlace = FLEET_CONFIG[0];
    this.placementOrientation = 'HORIZONTAL';
    this.notifyChange();
  }

  public isTwoPlayerMode(): boolean {
    return this.isTwoPlayers;
  }

  public isPlacementPhase(): boolean {
    return this.phase === 'PLACEMENT_P1' || this.phase === 'PLACEMENT_P2';
  }

  public getPlacedShips(): PlacedShip[] {
    if (this.phase === 'PLACEMENT_P2') {
      return [...this.p2Ships];
    }
    return [...this.playerShips];
  }

  public getP1Ships(): PlacedShip[] {
    return [...this.playerShips];
  }

  public getP2Ships(): PlacedShip[] {
    return [...(this.isTwoPlayers ? this.p2Ships : this.aiShips)];
  }

  public getSelectedShip(): ShipDefinition | null {
    return this.selectedShipToPlace;
  }

  public setSelectedShip(ship: ShipDefinition | null): void {
    this.selectedShipToPlace = ship;
    this.notifyChange();
  }

  public getOrientation(): ShipOrientation {
    return this.placementOrientation;
  }

  public toggleOrientation(): void {
    this.placementOrientation = this.placementOrientation === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL';
    this.notifyChange();
  }

  public canPlaceShip(
    shipDef: ShipDefinition,
    originRow: number,
    originCol: number,
    orientation: ShipOrientation
  ): boolean {
    if (!this.isPlacementPhase()) return false;

    const coords: Array<{ row: number; col: number }> = [];
    for (let i = 0; i < shipDef.length; i++) {
      const r = orientation === 'HORIZONTAL' ? originRow : originRow + i;
      const c = orientation === 'HORIZONTAL' ? originCol + i : originCol;
      if (r < 0 || r >= 10 || c < 0 || c >= 10) return false;
      coords.push({ row: r, col: c });
    }

    // Check overlap with existing placed ships (excluding self if re-placing)
    const activeFleet = this.getActivePlacingFleet();
    for (const ship of activeFleet) {
      if (ship.id === shipDef.id) continue;
      for (const sc of ship.coords) {
        if (coords.some(c => c.row === sc.row && c.col === sc.col)) {
          return false;
        }
      }
    }

    return true;
  }

  public placePlayerShip(
    shipDef: ShipDefinition,
    originRow: number,
    originCol: number,
    orientation: ShipOrientation
  ): boolean {
    if (!this.isPlacementPhase()) return false;
    if (!this.canPlaceShip(shipDef, originRow, originCol, orientation)) {
      return false;
    }

    const activeFleet = this.getActivePlacingFleet().filter(s => s.id !== shipDef.id);

    const coords: Array<{ row: number; col: number }> = [];
    for (let i = 0; i < shipDef.length; i++) {
      const r = orientation === 'HORIZONTAL' ? originRow : originRow + i;
      const c = orientation === 'HORIZONTAL' ? originCol + i : originCol;
      coords.push({ row: r, col: c });
    }

    activeFleet.push({
      id: shipDef.id,
      name: shipDef.name,
      length: shipDef.length,
      color: shipDef.color,
      orientation,
      originRow,
      originCol,
      coords,
      hits: 0,
      sunk: false
    });

    this.setActivePlacingFleet(activeFleet);

    // Auto-select next unplaced ship
    const placedIds = new Set(activeFleet.map(s => s.id));
    const nextUnplaced = FLEET_CONFIG.find(s => !placedIds.has(s.id));
    this.selectedShipToPlace = nextUnplaced || null;

    this.notifyChange();
    return true;
  }

  public removePlayerShip(shipId: string): boolean {
    if (!this.isPlacementPhase()) return false;

    const activeFleet = this.getActivePlacingFleet();
    const nextFleet = activeFleet.filter(s => s.id !== shipId);
    if (nextFleet.length === activeFleet.length) {
      return false;
    }

    this.setActivePlacingFleet(nextFleet);
    const removedDef = FLEET_CONFIG.find(s => s.id === shipId) || null;
    if (removedDef) {
      this.selectedShipToPlace = removedDef;
    }
    this.notifyChange();
    return true;
  }

  public clearCurrentPlacement(): void {
    if (!this.isPlacementPhase()) return;
    this.setActivePlacingFleet([]);
    this.selectedShipToPlace = FLEET_CONFIG[0];
    this.notifyChange();
  }

  public autoPlacePlayerFleet(): void {
    if (!this.isPlacementPhase()) return;
    this.setActivePlacingFleet(this.generateRandomFleet());
    this.selectedShipToPlace = null;
    this.notifyChange();
  }

  public isP1FleetComplete(): boolean {
    return this.playerShips.length === FLEET_CONFIG.length;
  }

  public isP2FleetComplete(): boolean {
    return this.p2Ships.length === FLEET_CONFIG.length;
  }

  public isFleetComplete(): boolean {
    if (this.phase === 'PLACEMENT_P2') {
      return this.isP2FleetComplete();
    }
    return this.isP1FleetComplete();
  }

  private generateRandomFleet(): PlacedShip[] {
    const fleet: PlacedShip[] = [];
    const occupied = new Set<string>();

    for (const shipDef of FLEET_CONFIG) {
      let placed = false;
      let attempts = 0;

      while (!placed && attempts < 200) {
        attempts++;
        const orientation: ShipOrientation = Math.random() > 0.5 ? 'HORIZONTAL' : 'VERTICAL';
        const maxRow = orientation === 'HORIZONTAL' ? 10 : 11 - shipDef.length;
        const maxCol = orientation === 'HORIZONTAL' ? 11 - shipDef.length : 10;
        const r = Math.floor(Math.random() * maxRow);
        const c = Math.floor(Math.random() * maxCol);

        const coords: Array<{ row: number; col: number }> = [];
        let valid = true;
        for (let i = 0; i < shipDef.length; i++) {
          const cr = orientation === 'HORIZONTAL' ? r : r + i;
          const cc = orientation === 'HORIZONTAL' ? c + i : c;
          if (occupied.has(`${cr},${cc}`)) {
            valid = false;
            break;
          }
          coords.push({ row: cr, col: cc });
        }

        if (valid) {
          coords.forEach(p => occupied.add(`${p.row},${p.col}`));
          fleet.push({
            id: shipDef.id,
            name: shipDef.name,
            length: shipDef.length,
            color: shipDef.color,
            orientation,
            originRow: r,
            originCol: c,
            coords,
            hits: 0,
            sunk: false
          });
          placed = true;
        }
      }
    }

    return fleet;
  }

  // --- 2-Player Turn Transition Flow ---
  public confirmP1Placement(): boolean {
    if (!this.isTwoPlayers || this.phase !== 'PLACEMENT_P1' || !this.isP1FleetComplete()) {
      return false;
    }

    this.phase = 'TURN_TRANSITION';
    this.transitionTarget = 'PLACEMENT_P2';
    this.selectedShipToPlace = null;
    this.notifyChange();
    return true;
  }

  public continueFromTransition(): boolean {
    if (this.phase !== 'TURN_TRANSITION') return false;

    if (this.transitionTarget === 'PLACEMENT_P2') {
      this.phase = 'PLACEMENT_P2';
      this.transitionTarget = null;
      this.selectedShipToPlace = FLEET_CONFIG[0];
      this.placementOrientation = 'HORIZONTAL';
      this.notifyChange();
      return true;
    }

    if (this.transitionTarget === 'COMBAT') {
      this.transitionTarget = null;
      return this.beginCombat();
    }

    return false;
  }

  // --- Combat Phase ---
  public beginCombat(): boolean {
    if (this.isTwoPlayers) {
      if (this.phase !== 'PLACEMENT_P2' || !this.isP2FleetComplete()) {
        return false;
      }
    } else {
      if (this.phase !== 'PLACEMENT_P1' || !this.isP1FleetComplete()) {
        return false;
      }
      // Generate AI fleet randomly
      this.aiShips = this.generateRandomFleet();
    }

    this.phase = 'COMBAT';
    this.transitionTarget = null;
    this.currentTurn = 1;
    this.activeTurn = 'PLAYER';
    this.selectedShipToPlace = null;

    // Start lifecycle if not already started
    this.start();
    this.notifyChange();
    return true;
  }

  private resolveShotAgainstFleet(
    defenderFleet: PlacedShip[],
    row: number,
    col: number
  ): { result: 'HIT' | 'MISS'; shipSunk: string | null; updatedFleet: PlacedShip[] } {
    let result: 'HIT' | 'MISS' = 'MISS';
    let shipSunk: string | null = null;

    const updatedFleet = defenderFleet.map(ship => {
      if (!ship.coords.some(c => c.row === row && c.col === col)) {
        return ship;
      }

      result = 'HIT';
      const hits = ship.hits + 1;
      const sunk = hits >= ship.length;
      if (sunk) {
        shipSunk = ship.name; // Critical for Scala DEADLY_STREAK
      }
      return {
        ...ship,
        hits,
        sunk
      };
    });

    return { result, shipSunk, updatedFleet };
  }

  public async playerFire(row: number, col: number): Promise<ShotRecord | null> {
    if (this.phase !== 'COMBAT' || this.activeTurn !== 'PLAYER' || this.isAiThinking) {
      return null;
    }

    // Check if cell was already fired upon
    const alreadyShot = this.playerShotsFired.some(s => s.row === row && s.col === col);
    if (alreadyShot) return null;

    const defenderFleet = this.isTwoPlayers ? this.p2Ships : this.aiShips;
    const { result, shipSunk, updatedFleet } = this.resolveShotAgainstFleet(defenderFleet, row, col);

    if (result === 'HIT') {
      if (this.isTwoPlayers) {
        this.p2Ships = updatedFleet;
      } else {
        this.aiShips = updatedFleet;
      }
      this.p1Score += 100 + (shipSunk ? 250 : 0);
      this.currentScore = this.isTwoPlayers ? Math.max(this.p1Score, this.p2Score) : this.p1Score;
    }

    const shotRecord: ShotRecord = {
      shooter: 'PLAYER',
      row,
      col,
      result,
      shipSunk,
      turn: this.currentTurn
    };
    this.playerShotsFired = [...this.playerShotsFired, shotRecord];

    // Telemetry: FIRE_SHOT by Player 1
    this.emit<BattleshipFireShotPayload>('ACTION', 'FIRE_SHOT', {
      coord: toGameStatsCoord(row, col),
      turn: this.currentTurn,
      result,
      shipSunk
    }, this.p1Id);

    this.notifyChange();

    // Check if all defender ships sunk -> Player 1 wins!
    if (updatedFleet.every(s => s.sunk)) {
      this.phase = 'FINISHED';
      this.winnerId = this.p1Id;
      this.finish(this.p1Id, this.p1Score, 'ALL_ENEMY_SHIPS_SUNK');
      this.notifyChange();
      return shotRecord;
    }

    if (this.isTwoPlayers) {
      // Switch to Player 2's turn
      this.activeTurn = 'PLAYER2';
      this.notifyChange();
      return shotRecord;
    }

    // Switch to AI turn
    this.activeTurn = 'AI';
    this.notifyChange();
    await this.executeAiTurn();

    return shotRecord;
  }

  public player2Fire(row: number, col: number): ShotRecord | null {
    if (!this.isTwoPlayers || this.phase !== 'COMBAT' || this.activeTurn !== 'PLAYER2') {
      return null;
    }

    // Check if cell on P1's board was already fired upon
    const alreadyShot = this.playerShotsReceived.some(s => s.row === row && s.col === col);
    if (alreadyShot) return null;

    const { result, shipSunk, updatedFleet } = this.resolveShotAgainstFleet(this.playerShips, row, col);

    if (result === 'HIT') {
      this.playerShips = updatedFleet;
      this.p2Score += 100 + (shipSunk ? 250 : 0);
      this.currentScore = Math.max(this.p1Score, this.p2Score);
    }

    const shotRecord: ShotRecord = {
      shooter: 'PLAYER2',
      row,
      col,
      result,
      shipSunk,
      turn: this.currentTurn
    };
    this.playerShotsReceived = [...this.playerShotsReceived, shotRecord];

    // Telemetry: FIRE_SHOT by Player 2
    this.emit<BattleshipFireShotPayload>('ACTION', 'FIRE_SHOT', {
      coord: toGameStatsCoord(row, col),
      turn: this.currentTurn,
      result,
      shipSunk
    }, this.p2Id);

    // Check if all Player 1 ships sunk -> Player 2 wins!
    if (this.playerShips.every(s => s.sunk)) {
      this.phase = 'FINISHED';
      this.winnerId = this.p2Id;
      this.finish(this.p2Id, this.p2Score, 'ALL_ENEMY_SHIPS_SUNK');
      this.notifyChange();
      return shotRecord;
    }

    this.currentTurn += 1;
    this.activeTurn = 'PLAYER';
    this.notifyChange();
    return shotRecord;
  }

  private async executeAiTurn(): Promise<void> {
    if (this.isDestroyed || this.phase !== 'COMBAT') return;

    this.isAiThinking = true;
    this.notifyChange();

    // Small atmospheric delay for radar feeling
    await new Promise(r => setTimeout(r, 650));
    if (this.isDestroyed || this.phase !== 'COMBAT') return;

    // Prepare Prolog Shot History
    const shotsHistory: PrologShotHistoryItem[] = toPrologShotHistory(
      this.playerShotsReceived.map(s => ({
        row: s.row,
        col: s.col,
        result: s.result,
        shipSunk: s.shipSunk
      }))
    );

    // Remaining unsunk player ships lengths
    const remainingLengths = this.playerShips
      .filter(s => !s.sunk)
      .map(s => s.length);

    // Call Prolog AI or Fallback
    const aiResponse = await BattleshipAi.getNextMove(
      this.matchId,
      shotsHistory,
      remainingLengths,
      'tactical'
    );
    if (this.isDestroyed || this.phase !== 'COMBAT') return;

    this.latestAiDecision = {
      mode: aiResponse.mode,
      heuristic: aiResponse.heuristic,
      inferenceTimeMs: aiResponse.inferenceTimeMs
    };

    const targetRow = aiResponse.decision.row;
    const targetCol = aiResponse.decision.col;

    // Telemetry: AI_DECISION
    this.emit<BattleshipAiDecisionPayload>('ACTION', 'AI_DECISION', {
      turn: this.currentTurn,
      mode: aiResponse.mode,
      coord: toGameStatsCoord(targetRow, targetCol),
      heuristic: aiResponse.heuristic
    }, 'CPU_AI');

    // Evaluate AI hit against Player Fleet
    const { result, shipSunk, updatedFleet } = this.resolveShotAgainstFleet(this.playerShips, targetRow, targetCol);

    if (result === 'HIT') {
      this.playerShips = updatedFleet;
    }

    const aiShotRecord: ShotRecord = {
      shooter: 'AI',
      row: targetRow,
      col: targetCol,
      result,
      shipSunk,
      turn: this.currentTurn
    };
    this.playerShotsReceived = [...this.playerShotsReceived, aiShotRecord];

    // Telemetry: FIRE_SHOT by AI
    this.emit<BattleshipFireShotPayload>('ACTION', 'FIRE_SHOT', {
      coord: toGameStatsCoord(targetRow, targetCol),
      turn: this.currentTurn,
      result,
      shipSunk
    }, 'CPU_AI');

    this.isAiThinking = false;
    this.currentTurn += 1;

    // Check if all Player ships sunk -> AI wins
    if (this.playerShips.every(s => s.sunk)) {
      this.phase = 'FINISHED';
      this.winnerId = 'CPU_AI';
      this.finish('CPU_AI', this.p1Score, 'PLAYER_FLEET_DESTROYED');
      this.notifyChange();
      return;
    }

    this.activeTurn = 'PLAYER';
    this.notifyChange();
  }

  // --- Getters for React UI ---
  public getPhase(): BattleshipPhase {
    return this.phase;
  }

  public getTransitionTarget(): TransitionTarget | null {
    return this.transitionTarget;
  }

  public getActiveTurn(): TurnOwner {
    return this.activeTurn;
  }

  public getCurrentTurn(): number {
    return this.currentTurn;
  }

  public getP1Id(): string {
    return this.p1Id;
  }

  public getP2Id(): string {
    return this.p2Id;
  }

  public getCurrentPlacingPlayerId(): string {
    return this.phase === 'PLACEMENT_P2' ? this.p2Id : this.p1Id;
  }

  public getP1Score(): number {
    return this.p1Score;
  }

  public getP2Score(): number {
    return this.p2Score;
  }

  public getWinnerId(): string | null {
    return this.winnerId;
  }

  public getPlayerShotsFired(): ShotRecord[] {
    return [...this.playerShotsFired];
  }

  public getPlayerShotsReceived(): ShotRecord[] {
    return [...this.playerShotsReceived];
  }

  public getAiShips(): PlacedShip[] {
    return this.getP2Ships();
  }

  public getLatestAiDecision() {
    return this.latestAiDecision;
  }

  public getIsAiThinking(): boolean {
    return this.isAiThinking;
  }

  // --- BaseGame Lifecycle implementation ---
  public override update(_deltaTime: number): void {
    // Battleship is turn-based event driven
  }

  public override render(_target: HTMLElement | HTMLCanvasElement): void {
    // Render is handled by BattleshipBoard.tsx component via state subscription
  }

  public override destroy(): void {
    this.isDestroyed = true;
    this.listeners.clear();
  }
}
