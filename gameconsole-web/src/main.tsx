import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { GameSessionManager } from './core/GameSessionManager';
import { eventDispatcher } from './services/EventDispatcher';
import { registerAllGames } from './core/GameRegistry';

// 1. Conectar despachador estricto de telemetría Go/Scala
GameSessionManager.getInstance().setDispatcher(eventDispatcher);

// 2. Registrar motores de juegos POO (Snake, Battleship, Head Football)
registerAllGames();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
