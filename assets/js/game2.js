"use strict";

// ══════════════════════════════════════════════
//  DADOS DA FASE 2 — mapa2.png
//  Carrega DEPOIS do game.js (que define os
//  containers ROTAS_MAPA, SEMAFOROS_MAPA, etc.)
//
//  O mapa2.png (1671×941) é um bairro com UMA rua
//  vertical cortando DUAS ruas horizontais, ou seja,
//  são DOIS cruzamentos na mesma fase:
//
//        rua vertical  x 795 – 878  (faixa amarela no x≈836)
//        rua de cima   y 228 – 289  (cruzamento 1)
//        rua de baixo  y 726 – 787  (cruzamento 2)
//
//  Cada faixa tem ~30px (ruas horizontais) e ~41px
//  (rua vertical), bem mais estreitas que na fase 1,
//  por isso o carro é redimensionado automaticamente
//  pela "larguraFaixa" para caber dentro da faixa.
//
//  Todas as coordenadas foram medidas em pixel
//  direto na imagem mapa2.png.
// ══════════════════════════════════════════════

// Meta de carros e dificuldade da fase (um pouco mais difícil que a fase 1)
META_FASE[2] = 35;

CONFIG_NIVEL[2] = {
  intervaloSpawn: 1800,   // ms entre carros
  velocidade:     1.8,    // px/frame
  maxCarros:      16,     // carros simultâneos na tela
  tempo:          420,    // 7 minutos (igual ao card da fase)

  // Largura de UMA faixa em px do mapa. O jogo calcula sozinho a escala
  // do carro para ele ocupar ~90% da faixa (ver calcularEscalaSprite).
  larguraFaixa:   { horizontal: 30, vertical: 41 },
  ocupacaoFaixa:  0.92,

  escalaPedestre: 0.6,    // pedestre proporcional à calçada (~30px)
  escalaSemaforo: 0.7,    // semáforo menor, cabe na esquina
  distParada:     4       // carro para colado na faixa de pedestre
};

// Retângulo do asfalto de CADA cruzamento (os pedestres usam isso para
// saber quando estão em cima da rua e qual semáforo respeitar)
AREA_VIA_MAPA[2] = [
  { cruzamento: 1, xMin: 795, xMax: 878, yMin: 228, yMax: 289 },
  { cruzamento: 2, xMin: 795, xMax: 878, yMin: 726, yMax: 787 }
];

// Rotas dos carros — cada rua horizontal tem sua própria via (id) para
// que os carros de uma rua não formem fila com os da outra.
// Mão de direção igual à fase 1: EAST na faixa de baixo, WEST na de cima,
// SOUTH à esquerda da faixa amarela e NORTH à direita.
ROTAS_MAPA[2] = [
  // Rua de cima (cruzamento 1)
  { id: 'EAST_1', direcao: 'EAST',  waypoints: [{ x: 0,    y: 274 }, { x: 1670, y: 274 }] },
  { id: 'WEST_1', direcao: 'WEST',  waypoints: [{ x: 1670, y: 243 }, { x: 1,    y: 243 }] },
  // Rua de baixo (cruzamento 2)
  { id: 'EAST_2', direcao: 'EAST',  waypoints: [{ x: 0,    y: 772 }, { x: 1670, y: 772 }] },
  { id: 'WEST_2', direcao: 'WEST',  waypoints: [{ x: 1670, y: 741 }, { x: 1,    y: 741 }] },
  // Rua vertical — passa pelos DOIS cruzamentos
  { id: 'SOUTH',  direcao: 'SOUTH', waypoints: [{ x: 815,  y: 0   }, { x: 815,  y: 940 }] },
  { id: 'NORTH',  direcao: 'NORTH', waypoints: [{ x: 858,  y: 940 }, { x: 858,  y: 1   }] }
];

// Semáforos — 4 por cruzamento, nos cantos, como na fase 1.
//   controla:   id da via (rota) que o semáforo controla
//   direcao:    sentido dos carros (seta desenhada no semáforo)
//   cruzamento: 1 = de cima, 2 = de baixo (teclas 1 e 2 do teclado)
//   grupo:      1 = rua vertical, 2 = rua horizontal (abrem alternados)
//   stopX/Y:    onde o para-choque para (borda da faixa de pedestre /
//               linha de retenção branca)
//   saidaX/Y:   fim do cruzamento. Com o sinal verde o carro só entra se
//               houver espaço depois desse ponto — não trava o cruzamento
//               quando a fila do outro cruzamento chega até ali.
SEMAFOROS_MAPA[2] = [
  // ── Cruzamento 1 (rua de cima) ──
  { id: 'SEM_SOUTH_1', controla: 'SOUTH',  direcao: 'SOUTH', cruzamento: 1, grupo: 1,
    x: 758, y: 170, stopX: 815, stopY: 198, saidaX: 815, saidaY: 324, estado: 'green' },
  { id: 'SEM_NORTH_1', controla: 'NORTH',  direcao: 'NORTH', cruzamento: 1, grupo: 1,
    x: 918, y: 328, stopX: 858, stopY: 324, saidaX: 858, saidaY: 198, estado: 'green' },
  { id: 'SEM_EAST_1',  controla: 'EAST_1', direcao: 'EAST',  cruzamento: 1, grupo: 2,
    x: 758, y: 328, stopX: 779, stopY: 274, saidaX: 893, saidaY: 274, estado: 'red' },
  { id: 'SEM_WEST_1',  controla: 'WEST_1', direcao: 'WEST',  cruzamento: 1, grupo: 2,
    x: 918, y: 170, stopX: 893, stopY: 243, saidaX: 779, saidaY: 243, estado: 'red' },

  // ── Cruzamento 2 (rua de baixo) ──
  { id: 'SEM_SOUTH_2', controla: 'SOUTH',  direcao: 'SOUTH', cruzamento: 2, grupo: 1,
    x: 758, y: 667, stopX: 815, stopY: 697, saidaX: 815, saidaY: 820, estado: 'green' },
  { id: 'SEM_NORTH_2', controla: 'NORTH',  direcao: 'NORTH', cruzamento: 2, grupo: 1,
    x: 918, y: 826, stopX: 858, stopY: 820, saidaX: 858, saidaY: 697, estado: 'green' },
  { id: 'SEM_EAST_2',  controla: 'EAST_2', direcao: 'EAST',  cruzamento: 2, grupo: 2,
    x: 758, y: 826, stopX: 779, stopY: 772, saidaX: 893, saidaY: 772, estado: 'red' },
  { id: 'SEM_WEST_2',  controla: 'WEST_2', direcao: 'WEST',  cruzamento: 2, grupo: 2,
    x: 918, y: 667, stopX: 893, stopY: 741, saidaX: 779, saidaY: 741, estado: 'red' }
];

// Rotas de pedestre — o mapa 2 só tem faixa de pedestre atravessando a
// rua VERTICAL (acima e abaixo de cada cruzamento), então os pedestres
// andam pelas calçadas e atravessam por essas 4 faixas.
//   calçadas horizontais: y 212, 314 (rua de cima) e 711, 806 (rua de baixo)
//   calçadas verticais:   x 777 (esquerda) e 897 (direita)
ROTAS_PEDESTRES_MAPA[2] = [
  // calçadas horizontais, atravessando a rua vertical pela faixa
  { waypoints: [{ x: -40,  y: 212 }, { x: 1710, y: 212 }] },
  { waypoints: [{ x: 1710, y: 314 }, { x: -40,  y: 314 }] },
  { waypoints: [{ x: -40,  y: 711 }, { x: 1710, y: 711 }] },
  { waypoints: [{ x: 1710, y: 806 }, { x: -40,  y: 806 }] },
  // rotas em "L": descem/sobem pela calçada da rua vertical e atravessam
  { waypoints: [{ x: 777,  y: -40 }, { x: 777, y: 212 }, { x: 1710, y: 212 }] }, // norte → leste
  { waypoints: [{ x: 897,  y: 980 }, { x: 897, y: 806 }, { x: -40,  y: 806 }] }, // sul → oeste
  // entre os dois cruzamentos: calçada vertical + faixa do outro cruzamento
  { waypoints: [{ x: -40,  y: 314 }, { x: 777, y: 314 }, { x: 777, y: 711 }, { x: 1710, y: 711 }] },
  { waypoints: [{ x: 1710, y: 711 }, { x: 897, y: 711 }, { x: 897, y: 314 }, { x: -40,  y: 314 }] }
];
