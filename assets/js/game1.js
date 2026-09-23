"use strict";

// ══════════════════════════════════════════════
//  DADOS DA FASE 1 — mapa1.png
//  Carrega DEPOIS do game.js (que define os
//  containers ROTAS_MAPA, SEMAFOROS_MAPA, etc.)
// ══════════════════════════════════════════════

// Meta de carros e dificuldade da fase
META_FASE[1]    = 30;
CONFIG_NIVEL[1] = { intervaloSpawn: 3000, velocidade: 1.5, maxCarros: 12 };

// Retângulo do asfalto do cruzamento (coordenadas do mapa 1672×941)
AREA_VIA_MAPA[1] = { xMin: 660, xMax: 1010, yMin: 400, yMax: 575 };

// Rotas dos carros
ROTAS_MAPA[1] = [
  { direcao: 'EAST',  waypoints: [{ x: 0,    y: 525 }, { x: 1670, y: 525 }] },
  { direcao: 'WEST',  waypoints: [{ x: 1668, y: 442 }, { x: 1,    y: 442 }] },
  { direcao: 'SOUTH', waypoints: [{ x: 746,  y: 0   }, { x: 746,  y: 940 }] },
  { direcao: 'NORTH', waypoints: [{ x: 919,  y: 940 }, { x: 919,  y: 1   }] }
];

// Semáforos — 4 cantos do cruzamento
SEMAFOROS_MAPA[1] = [
  { id: 'SEM_SOUTH', controla: 'SOUTH', grupo: 1, x: 630,  y: 275, stopX: 746,  stopY: 330, estado: 'green' },
  { id: 'SEM_NORTH', controla: 'NORTH', grupo: 1, x: 1030, y: 620, stopX: 919,  stopY: 650, estado: 'green' },

  { id: 'SEM_EAST',  controla: 'EAST',  grupo: 2, x: 550,  y: 565, stopX: 528,  stopY: 480, estado: 'red' },
  { id: 'SEM_WEST',  controla: 'WEST',  grupo: 2, x: 1120, y: 355, stopX: 1115, stopY: 442, estado: 'red' }
];

// Rotas de pedestre (calçadas + faixa de pedestre)
ROTAS_PEDESTRES_MAPA[1] = [
  // calçadas horizontais (acima e abaixo da via horizontal), passam pela faixa
  { waypoints: [{ x: -40,  y: 372 }, { x: 1710, y: 372 }] },
  { waypoints: [{ x: 1710, y: 618 }, { x: -40,  y: 618 }] },
  // calçadas verticais (esquerda e direita da via vertical), passam pela faixa
  { waypoints: [{ x: 610,  y: -40 }, { x: 610,  y: 980 }] },
  { waypoints: [{ x: 1052, y: 980 }, { x: 1052, y: -40 }] },
  // rotas em "L": seguem a calçada, atravessam pela faixa e viram a esquina
  { waypoints: [{ x: 1052, y: 980 }, { x: 1052, y: 372 }, { x: 1710, y: 372 }] }, // sul → leste
  { waypoints: [{ x: 1052, y: 980 }, { x: 1052, y: 618 }, { x: -40,  y: 618 }] }, // sul → oeste
  { waypoints: [{ x: 610,  y: -40 }, { x: 610,  y: 618 }, { x: -40,  y: 618 }] }, // norte → oeste
  { waypoints: [{ x: 610,  y: -40 }, { x: 610,  y: 372 }, { x: 1710, y: 372 }] }, // norte → leste
  { waypoints: [{ x: -40,  y: 372 }, { x: 610,  y: 372 }, { x: 610,  y: 980 }] }, // oeste → sul
  { waypoints: [{ x: 1710, y: 618 }, { x: 1052, y: 618 }, { x: 1052, y: -40 }] }  // leste → norte
];