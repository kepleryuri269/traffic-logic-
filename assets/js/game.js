"use strict";

// ══════════════════════════════════════════════
//  TRAFFIC LOGIC — game.js
//  Etapa 2: Semáforos desenhados no canvas
// ══════════════════════════════════════════════

let gameLoop    = null;
let carros      = [];
let semaforos   = [];
let nivelAtual  = 1;
let gameCanvas  = null;
let ctx         = null;
let carImagens  = {};
let imgCarregadas = 0;
let totalImgs     = 0;
let carrosPassaram = 0;
let pontos = 0;
let tempoRestante = 300; // 5 minutos
let timerFase = null;
let jogoEncerrado = false;
let explosoes = [];
let congestionamentos = {}; // { 'EAST': count, 'WEST': count, ... }
const crashAudio = new Audio('assets/audio/crash.mp3');
window.crashAudio = crashAudio;
crashAudio.volume = window.cfgVolume ?? 1;

const META_FASE = {
  1: 30,
  2: 30,
  3: 30
};

const CONFIG_NIVEL = {
  1: { intervaloSpawn: 3000, velocidade: 1.5, maxCarros: 12 },
  2: { intervaloSpawn: 2000, velocidade: 2.2, maxCarros: 18 },
  3: { intervaloSpawn: 1200, velocidade: 3.0, maxCarros: 26 }
};

const BASE_W = 1672;
const BASE_H = 941;

// ══════════════════════════════════════════════
//  ROTAS (coordenadas do mapa original 1672×941)
// ══════════════════════════════════════════════
const ROTAS_MAPA = {
  1: [
    { direcao: 'EAST',  waypoints: [{ x: 0,    y: 525 }, { x: 1670, y: 525 }] },
    { direcao: 'WEST',  waypoints: [{ x: 1668, y: 442 }, { x: 1,    y: 442 }] },
    { direcao: 'SOUTH', waypoints: [{ x: 746,  y: 0   }, { x: 746,  y: 940 }] },
    { direcao: 'NORTH', waypoints: [{ x: 919,  y: 940 }, { x: 919,  y: 1   }] }
  ]
};

// ══════════════════════════════════════════════
//  SEMÁFOROS — posição no mapa original
//  Cada semáforo controla uma direção de tráfego
//  estado: 'green' | 'red'
//  Os 4 semáforos ficam nos 4 cantos do cruzamento
// ══════════════════════════════════════════════
const SEMAFOROS_MAPA = {
  1: [
    { id: 'SEM_SOUTH', controla: 'SOUTH', grupo: 1, x: 630, y: 275, stopX: 746, stopY: 330, estado: 'green' },
    { id: 'SEM_NORTH', controla: 'NORTH', grupo: 1, x: 1030, y: 620, stopX: 919, stopY: 650, estado: 'green' },

    { id: 'SEM_EAST', controla: 'EAST', grupo: 2, x: 550, y: 565, stopX: 528, stopY: 480, estado: 'red' },
    { id: 'SEM_WEST', controla: 'WEST', grupo: 2, x: 1120, y: 355, stopX: 1115, stopY: 442, estado: 'red' }
  ]
};

// ══════════════════════════════════════════════
//  INICIALIZAR JOGO
// ══════════════════════════════════════════════
function iniciarJogo(nivel, restaurando = false) {
  nivelAtual = nivel;
  sessionStorage.setItem('nivelAtual', nivel);
  showScreen('screen-game');

  pararJogo();

  carros = [];
  semaforos = [];
  carrosPassaram = 0;
  pontos = 0;
  tempoRestante = 300;
  jogoEncerrado = false;
  explosoes = [];
  congestionamentos = {};

  if (timerFase) {
    clearInterval(timerFase);
    timerFase = null;
    function reiniciarFase() {
  console.log("CLICOU NO BOTÃO");

  const msg = document.querySelector(".game-message");
  if (msg) msg.remove();

  iniciarJogo(nivelAtual);
}
  }

  const screen = document.getElementById('screen-game');
  screen.style.position   = 'relative';
  screen.style.overflow   = 'hidden';
  screen.style.backgroundImage    = `url('assets/img/mapas/mapa${nivel}.png')`;
  screen.style.backgroundSize     = 'cover';
  screen.style.backgroundPosition = 'center';
  screen.style.backgroundRepeat   = 'no-repeat';

  const canvasAntigo = document.getElementById('game-canvas');
  if (canvasAntigo) canvasAntigo.remove();

  gameCanvas = document.createElement('canvas');
  gameCanvas.id = 'game-canvas';
  gameCanvas.style.cssText = `
    position: absolute; top: 0; left: 0;
    width: 100%; height: 100%;
    z-index: 10; cursor: pointer;
  `;
  screen.appendChild(gameCanvas);
  ctx = gameCanvas.getContext('2d');
  redimensionarCanvas();
  const hudAntigo = document.getElementById("hud");
if (hudAntigo) hudAntigo.remove();

const hud = document.createElement("div");
hud.id = "hud";

hud.innerHTML = `
  <div id="tempo">Tempo: 05:00</div>
  <div id="meta">Carros: 0/${META_FASE[nivel]}</div>
  <div id="fase">Fase: ${nivel}</div>
`;

screen.appendChild(hud);

  // Inicializa semáforos
 const defsem = SEMAFOROS_MAPA[nivel] || [];
semaforos = defsem.map(s => ({ ...s }));

  // Clique para alternar semáforo
  gameCanvas.addEventListener('click', onClickCanvas);

  // Carrega sprites — múltiplos tipos de veículo
  const tiposVeiculos = [
    {
      id: 'AMBULANCE',
      sprites: {
        EAST:  'assets/img/veiculos/AMBULANCE_CLEAN_EAST_011.png',
        WEST:  'assets/img/veiculos/AMBULANCE_CLEAN_WEST_011.png',
        NORTH: 'assets/img/veiculos/AMBULANCE_CLEAN_NORTH_011.png',
        SOUTH: 'assets/img/veiculos/AMBULANCE_CLEAN_SOUTH_011.png'
      }
    },
    {
      id: 'BROWN_CIVIC',
      sprites: {
        EAST:  'assets/img/veiculos/Brown_CIVIC_CLEAN_EAST_011.png',
        WEST:  'assets/img/veiculos/Brown_CIVIC_CLEAN_WEST_011.png',
        NORTH: 'assets/img/veiculos/Brown_CIVIC_CLEAN_NORTH_011.png',
        SOUTH: 'assets/img/veiculos/Brown_CIVIC_CLEAN_SOUTH_011.png'
      }
    },
    {
      id: 'TAXI',
      sprites: {
        EAST:  'assets/img/veiculos/TAXI_CLEAN_EAST_011.png',
        WEST:  'assets/img/veiculos/TAXI_CLEAN_WEST_011.png',
        NORTH: 'assets/img/veiculos/TAXI_CLEAN_NORTH_011.png',
        SOUTH: 'assets/img/veiculos/TAXI_CLEAN_SOUTH_011.png'
      }
    },
    {
      id: 'WHITE_HATCHBACK',
      sprites: {
        EAST:  'assets/img/veiculos/White_HatchBack_CLEAN_EAST_011.png',
        WEST:  'assets/img/veiculos/White_HatchBack_CLEAN_WEST_011.png',
        NORTH: 'assets/img/veiculos/White_HatchBack_CLEAN_NORTH_011.png',
        SOUTH: 'assets/img/veiculos/White_HatchBack_CLEAN_SOUTH_011.png'
      }
    }
  ];

  // carImagens agora é { AMBULANCE: { EAST: img, ... }, BROWN_CIVIC: { ... } }
  const todasSprites = {};
  tiposVeiculos.forEach(tipo => { todasSprites[tipo.id] = {}; });

  totalImgs     = tiposVeiculos.reduce((acc, t) => acc + Object.keys(t.sprites).length, 0);
  imgCarregadas = 0;
  carImagens    = todasSprites;
  let loopIniciado = false;

  tiposVeiculos.forEach(tipo => {
    Object.entries(tipo.sprites).forEach(([dir, src]) => {
      const img = new Image();
      const done = () => {
        imgCarregadas++;
        if (imgCarregadas === totalImgs && !loopIniciado) {
          loopIniciado = true;
          iniciarLoop(nivel);
        }
      };
      img.onload  = done;
      img.onerror = done;
      img.src = src;
      carImagens[tipo.id][dir] = img;
    });
  });

  // Guarda lista de IDs para sortear no spawn
  window._tiposVeiculosIds = tiposVeiculos.map(t => t.id);
}

// ══════════════════════════════════════════════
//  CLIQUE NO CANVAS — alterna semáforo clicado
// ══════════════════════════════════════════════
function onClickCanvas(e) {
  const rect = gameCanvas.getBoundingClientRect();
  const mx   = (e.clientX - rect.left) / (rect.width  / BASE_W);
  const my   = (e.clientY - rect.top)  / (rect.height / BASE_H);
  const RAIO = 60;

  // Verifica se clicou em algum semáforo
  const clicado = semaforos.find(s => {
    const dx = mx - s.x, dy = my - s.y;
    return Math.sqrt(dx*dx + dy*dy) < RAIO;
  });

  if (!clicado) return;

  // Alterna grupos: o grupo clicado vai pra verde, o outro pra vermelho
  const grupoAtivo = clicado.grupo === 1 ? 1 : 2;
  semaforos.forEach(s => {
    s.estado = s.grupo === grupoAtivo ? 'green' : 'red';
  });
}

// ══════════════════════════════════════════════
//  LOOP PRINCIPAL
// ══════════════════════════════════════════════
function iniciarLoop(nivel) {
  timerFase = setInterval(() => {
  tempoRestante--;

if (tempoRestante <= 0) {
    clearInterval(timerFase);

    pararJogo();

    mostrarMensagemDerrota("O tempo acabou.");

    return;
}
}, 1000);
  redimensionarCanvas();
  window.addEventListener('resize', redimensionarCanvas);

  const cfg = CONFIG_NIVEL[nivel] || CONFIG_NIVEL[1];

  let spawnTimer = setInterval(() => {
    const ativos = carros.filter(c => c.ativo).length;
    if (ativos < cfg.maxCarros) spawnCarro(nivel, cfg.velocidade);
  }, cfg.intervaloSpawn);
  spawnCarro(nivel, cfg.velocidade);

  let lastTime = 0;
  function loop(ts) {
    const dt = Math.min((ts - lastTime) / 16.67, 3);
    lastTime = ts;
    atualizarCarros(dt);
    renderizar();
    gameLoop = requestAnimationFrame(loop);
  }
  gameLoop = requestAnimationFrame(loop);
  gameCanvas._spawnTimer = spawnTimer;
}

// ══════════════════════════════════════════════
//  SPAWN
// ══════════════════════════════════════════════
function spawnCarro(nivel, velocidade) {
  const rotasDisponiveis = ROTAS_MAPA[nivel];

if (!rotasDisponiveis) {
  console.error("Rotas não configuradas para a fase:", nivel);
  return;
}
  const rotaBase = rotasDisponiveis[Math.floor(Math.random() * rotasDisponiveis.length)];
  const scaleX   = gameCanvas.width  / BASE_W;
  const scaleY   = gameCanvas.height / BASE_H;
  const waypoints = rotaBase.waypoints.map(w => ({ x: w.x * scaleX, y: w.y * scaleY }));

  const ids = window._tiposVeiculosIds || ['AMBULANCE'];
  const tipoVeiculo = ids[Math.floor(Math.random() * ids.length)];

  carros.push({
    x: waypoints[0].x,
    y: waypoints[0].y,
    direcao:    rotaBase.direcao,
    waypoints,
    wpIndex:    1,
    velocidade: velocidade,
    tamanho:    96,
    ativo:      true,
    parado:     false,
    tipoVeiculo
  });
}

// ══════════════════════════════════════════════
//  ATUALIZAR CARROS — respeita semáforo vermelho
// ══════════════════════════════════════════════
function atualizarCarros(dt) {
  const scaleX = gameCanvas.width  / BASE_W;
  const scaleY = gameCanvas.height / BASE_H;
  const STOP_DIST  = 50 * Math.min(scaleX, scaleY);
  const DIST_FILA  = 90; // distância mínima entre carros da mesma via

  carros.forEach(carro => {
    if (!carro.ativo) return;

    // ── 1. Semáforo vermelho ──
    const sem = semaforos.find(s => s.controla === carro.direcao);
    if (sem && sem.estado === 'red') {
      const stopX = (sem.stopX ?? sem.x) * scaleX;
      const stopY = (sem.stopY ?? sem.y) * scaleY;
      const dsx   = stopX - carro.x;
      const dsy   = stopY - carro.y;
      const dist  = Math.sqrt(dsx*dsx + dsy*dsy);

      if (dist < STOP_DIST) {
        carro.parado = true;
        return;
      }

      const alvoFinal = carro.waypoints[carro.waypoints.length - 1];
      const totalDX   = alvoFinal.x - carro.waypoints[0].x;
      const totalDY   = alvoFinal.y - carro.waypoints[0].y;
      const dot = dsx * totalDX + dsy * totalDY;
      carro.parado = dot >= 0 ? false : false;
    } else {
      carro.parado = false;
    }

    // ── 2. Respeitar distância de carros à frente na mesma via ──
    for (const outro of carros) {
      if (outro === carro || !outro.ativo || outro.direcao !== carro.direcao) continue;

      const dx   = outro.x - carro.x;
      const dy   = outro.y - carro.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < DIST_FILA && dist > 1) {
        // Verifica se "outro" está à frente (mais avançado na rota)
        // usando produto escalar com a direção de movimento do carro atual
        const alvoAtual = carro.waypoints[carro.wpIndex];
        if (!alvoAtual) continue;
        const dirX = alvoAtual.x - carro.x;
        const dirY = alvoAtual.y - carro.y;
        const dot  = dx * dirX + dy * dirY;
        // Só bloqueia se o outro está À FRENTE na direção de movimento
        // E se o outro está parado ou muito lento (também parado)
        if (dot > 0 && outro.parado) {
          carro.parado = true;
          break;
        }
      }
    }

    if (carro.parado) return;

    // ── 3. Mover ──
    const alvo = carro.waypoints[carro.wpIndex];
    if (!alvo) { carro.ativo = false; return; }

    const dx    = alvo.x - carro.x;
    const dy    = alvo.y - carro.y;
    const dist  = Math.sqrt(dx*dx + dy*dy);
    const passo = carro.velocidade * dt;

    if (dist <= passo) {
      carro.x = alvo.x;
      carro.y = alvo.y;
      carro.wpIndex++;
      if (carro.wpIndex >= carro.waypoints.length) {
        carro.ativo = false;
        carrosPassaram++;
        if (carrosPassaram >= META_FASE[nivelAtual] && !jogoEncerrado) {
          jogoEncerrado = true;
          finalizarFase();
        }
      }
    } else {
      carro.x += (dx / dist) * passo;
      carro.y += (dy / dist) * passo;
    }
  });

  // Resetar flag congestionado para carros que não têm mais ninguém próximo na mesma via
  carros.forEach(carro => {
    if (!carro.congestionado) return;
    const temVizinho = carros.some(outro =>
      outro !== carro &&
      outro.ativo &&
      outro.direcao === carro.direcao &&
      Math.hypot(outro.x - carro.x, outro.y - carro.y) < DIST_FILA
    );
    if (!temVizinho) carro.congestionado = false;
  });

  verificarColisoes();
  carros = carros.filter(c => c.ativo);
}
function verificarColisoes() {
  if (jogoEncerrado) return;

  const DIST_COLISAO          = 45;
  const DIST_CONGESTIONAMENTO = 90;

  for (let i = 0; i < carros.length; i++) {
    for (let j = i + 1; j < carros.length; j++) {
      const a = carros[i];
      const b = carros[j];

      const dx   = a.x - b.x;
      const dy   = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const mesmaVia = a.direcao === b.direcao;

      // Vias diferentes muito próximos → colisão real
      if (!mesmaVia && dist < DIST_COLISAO) {
        dispararColisao(a, b);
        return;
      }

      // Mesma via em fila → apenas marca como congestionado (sem colisão)
      if (mesmaVia && dist < DIST_CONGESTIONAMENTO) {
        a.congestionado = true;
        b.congestionado = true;
      } else if (mesmaVia && dist >= DIST_CONGESTIONAMENTO) {
        a.congestionado = false;
        b.congestionado = false;
      }
    }
  }

  // ── Verificar se alguma via tem 3+ carros congestionados simultaneamente ──
  const vias = ['EAST', 'WEST', 'NORTH', 'SOUTH'];
  vias.forEach(via => {
    // Conta carros parados OU marcados como congestionados na mesma via
    const qtd = carros.filter(c => c.ativo && (c.congestionado || c.parado) && c.direcao === via).length;
    if (qtd >= 3) {
      if (!congestionamentos[via + '_avisado']) {
        congestionamentos[via + '_avisado'] = true;
        congestionamentos[via + '_tick']    = 0;
        tempoRestante = Math.max(0, tempoRestante - 30);
        mostrarAviso('-30s — Congestionamento!');
      }
    }
    // Só reseta o aviso depois que a fila se desfez completamente por alguns frames
    if (qtd < 3 && congestionamentos[via + '_avisado']) {
      congestionamentos[via + '_tick'] = (congestionamentos[via + '_tick'] || 0) + 1;
      if (congestionamentos[via + '_tick'] > 60) { // ~1 segundo de graça
        congestionamentos[via + '_avisado'] = false;
        congestionamentos[via + '_tick']    = 0;
      }
    } else if (qtd >= 3) {
      congestionamentos[via + '_tick'] = 0;
    }
  });
}

function dispararColisao(a, b) {
  jogoEncerrado = true;

  crashAudio.currentTime = 0;
  crashAudio.play().catch(() => {});

  explosoes.push({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    frame: 0,
    maxFrames: 40,
    particulas: Array.from({ length: 18 }, () => ({
      angulo: Math.random() * Math.PI * 2,
      vel: 2 + Math.random() * 5,
      raio: 4 + Math.random() * 6,
      alpha: 1,
      cor: ['#ff4500','#ff8c00','#ffd700','#fff'][Math.floor(Math.random() * 4)]
    }))
  });

  setTimeout(() => {
    pararJogo();
    mostrarMensagemDerrota("Os carros colidiram.");
  }, 400);
}


// ══════════════════════════════════════════════
//  RENDERIZAR
// ══════════════════════════════════════════════
const DEBUG_ROTAS = false;

function renderizar() {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  atualizarHUD();

  if (DEBUG_ROTAS) desenharDebugRotas();

  desenharSemaforos();
  desenharCarros();
  desenharExplosoes();
}

// ── Semáforos ────────────────────────────────
function desenharSemaforos() {
  const scaleX = gameCanvas.width  / BASE_W;
  const scaleY = gameCanvas.height / BASE_H;
  const scale  = Math.min(scaleX, scaleY);

  semaforos.forEach(sem => {
    const cx = sem.x * scaleX;
    const cy = sem.y * scaleY;
    desenharSemaforo(ctx, cx, cy, scale, sem.estado, sem.controla);
  });
}

// ── Explosões ────────────────────────────────
function desenharExplosoes() {
  explosoes = explosoes.filter(exp => exp.frame < exp.maxFrames);

  explosoes.forEach(exp => {
    const prog = exp.frame / exp.maxFrames;

    // Flash central
    if (exp.frame < 10) {
      const flashAlpha = (1 - exp.frame / 10) * 0.8;
      const flashRaio  = 60 * (exp.frame / 10);
      const grad = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, flashRaio);
      grad.addColorStop(0,   `rgba(255,255,200,${flashAlpha})`);
      grad.addColorStop(0.4, `rgba(255,140,0,${flashAlpha * 0.7})`);
      grad.addColorStop(1,   'rgba(255,60,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, flashRaio, 0, Math.PI * 2);
      ctx.fill();
    }

    // Partículas
    exp.particulas.forEach(p => {
      const px = exp.x + Math.cos(p.angulo) * p.vel * exp.frame;
      const py = exp.y + Math.sin(p.angulo) * p.vel * exp.frame;
      const alpha = Math.max(0, 1 - prog * 1.3);
      const raioAtual = p.raio * (1 - prog * 0.5);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.cor;
      ctx.beginPath();
      ctx.arc(px, py, raioAtual, 0, Math.PI * 2);
      ctx.fill();
    });

    // Fumaça
    if (exp.frame > 10) {
      const fumaçaAlpha = Math.max(0, 0.4 - prog * 0.5);
      const fumaçaRaio  = 30 + exp.frame * 1.2;
      ctx.globalAlpha = fumaçaAlpha;
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, fumaçaRaio, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    exp.frame++;
  });
}

function desenharSemaforo(ctx, cx, cy, scale, estado, label) {
  const W  = 26 * scale;   // largura da caixa
  const H  = 48 * scale;   // altura da caixa (só 2 luzes)
  const R  = 10 * scale;   // raio das luzes
  const rx = 6  * scale;   // raio dos cantos da caixa
  const posteH = 18 * scale;
  const posteW =  4 * scale;

  // ── Poste ──
  ctx.fillStyle = '#2a2a2a';
  ctx.beginPath();
  ctx.roundRect(cx - posteW/2, cy + H/2, posteW, posteH, 2);
  ctx.fill();

  // ── Base do poste ──
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(cx, cy + H/2 + posteH, posteW * 2, posteW * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Caixa — sombra ──
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur  = 8 * scale;
  ctx.shadowOffsetY = 3 * scale;

  // Caixa principal
  ctx.fillStyle = '#1c1c1c';
  roundRect(ctx, cx - W/2, cy - H/2, W, H, rx);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetY = 0;

  // Borda metálica
  ctx.strokeStyle = '#444';
  ctx.lineWidth   = 1.5 * scale;
  roundRect(ctx, cx - W/2, cy - H/2, W, H, rx);
  ctx.stroke();

  // Highlight lateral (efeito 3D)
  const grad = ctx.createLinearGradient(cx - W/2, cy, cx + W/2, cy);
  grad.addColorStop(0,   'rgba(255,255,255,0.08)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.02)');
  grad.addColorStop(1,   'rgba(0,0,0,0.1)');
  ctx.fillStyle = grad;
  roundRect(ctx, cx - W/2, cy - H/2, W, H, rx);
  ctx.fill();

  // ── 2 luzes: vermelho no topo, verde embaixo ──
  const posY  = [cy - H/2 + H * 0.28, cy + H/2 - H * 0.28];
  const cores  = ['#e74c3c', '#27ae60'];
  // vermelho aceso quando red, verde aceso quando green — nunca os dois juntos
  const ativas = estado === 'red' ? [true, false] : [false, true];

  posY.forEach((ly, i) => {
    // Alvéolo (fundo escuro da lâmpada)
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cx, ly, R * 1.1, 0, Math.PI * 2);
    ctx.fill();

    if (ativas[i]) {
      // Brilho externo (glow)
      const glow = ctx.createRadialGradient(cx, ly, 0, cx, ly, R * 3);
      glow.addColorStop(0,   cores[i] + 'aa');
      glow.addColorStop(0.4, cores[i] + '44');
      glow.addColorStop(1,   'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, ly, R * 3, 0, Math.PI * 2);
      ctx.fill();

      // Lâmpada acesa
      const lampGrad = ctx.createRadialGradient(cx - R*0.3, ly - R*0.3, 0, cx, ly, R);
      lampGrad.addColorStop(0,   '#fff');
      lampGrad.addColorStop(0.3, cores[i]);
      lampGrad.addColorStop(1,   shadeColor(cores[i], -40));
      ctx.fillStyle = lampGrad;
    } else {
      // Lâmpada apagada
      ctx.fillStyle = shadeColor(cores[i], -70);
    }
    ctx.beginPath();
    ctx.arc(cx, ly, R, 0, Math.PI * 2);
    ctx.fill();

    // Reflexo na lâmpada acesa
    if (ativas[i]) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(cx - R*0.25, ly - R*0.3, R*0.3, R*0.2, -0.5, 0, Math.PI*2);
      ctx.fill();
    }
  });

  // ── Label da direção ──
  const setas = { EAST:'→', WEST:'←', SOUTH:'↓', NORTH:'↑' };
  ctx.fillStyle = estado === 'green' ? '#27ae60' : '#e74c3c';
  ctx.font      = `bold ${11 * scale}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(setas[label] || label, cx, cy + H/2 + posteH + 2*scale);
}

// ── Utilitário roundRect ──────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y,         x + r, y);
  ctx.closePath();
}

// ── Escurece/clareia uma cor hex ─────────────
function shadeColor(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + pct));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + pct));
  const b = Math.max(0, Math.min(255, (n & 0xff) + pct));
  return `rgb(${r},${g},${b})`;
}

// ── Carros ───────────────────────────────────
function desenharCarros() {
  carros.forEach(carro => {
    const tipo = carro.tipoVeiculo || 'AMBULANCE';
    const spriteSet = carImagens[tipo] || carImagens['AMBULANCE'];
    const img = spriteSet ? spriteSet[carro.direcao] : null;
    if (!img || !img.complete) return;
    const half = carro.tamanho / 2;
    ctx.drawImage(img, carro.x - half, carro.y - half, carro.tamanho, carro.tamanho);
  });
}

// ── Debug rotas ──────────────────────────────
function desenharDebugRotas() {
  const scaleX = gameCanvas.width  / BASE_W;
  const scaleY = gameCanvas.height / BASE_H;
  const cores  = { EAST:'#00ff88', WEST:'#ff4466', SOUTH:'#44aaff', NORTH:'#ffcc00' };
  (ROTAS_MAPA[nivelAtual] || ROTAS_MAPA[1]).forEach(rota => {
    ctx.strokeStyle = cores[rota.direcao];
    ctx.lineWidth   = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    rota.waypoints.forEach((wp, i) => {
      i === 0 ? ctx.moveTo(wp.x*scaleX, wp.y*scaleY)
              : ctx.lineTo(wp.x*scaleX, wp.y*scaleY);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

// ══════════════════════════════════════════════
//  REDIMENSIONAR / PARAR
// ══════════════════════════════════════════════
function redimensionarCanvas() {
  if (!gameCanvas) return;
  const screen = document.getElementById('screen-game');
  gameCanvas.width  = screen.clientWidth;
  gameCanvas.height = screen.clientHeight;
}

function pararJogo() {
  if (gameLoop) {
    cancelAnimationFrame(gameLoop);
    gameLoop = null;
  }

  if (timerFase) {
    clearInterval(timerFase);
    timerFase = null;
  }

  if (gameCanvas) {
    if (gameCanvas._spawnTimer) {
      clearInterval(gameCanvas._spawnTimer);
      gameCanvas._spawnTimer = null;
    }
    gameCanvas.removeEventListener('click', onClickCanvas);
  }

  window.removeEventListener('resize', redimensionarCanvas);
}
// ══════════════════════════════════════════════
//  MODAL / NAVEGAÇÃO
// ══════════════════════════════════════════════
function confirmarSairFase() { document.getElementById('modal-sair').style.display = 'flex'; }
function fecharModal()        { document.getElementById('modal-sair').style.display = 'none'; }
function confirmarSaida() {
  pararJogo();
  fecharModal();
  sessionStorage.removeItem('nivelAtual');
  showScreen('screen-fases');
}
function finalizarFase() {
  pararJogo();

  // Remove overlay anterior se existir
  document.querySelectorAll('.fase-concluida-overlay').forEach(el => el.remove());

  // Menos de 3 min jogando (300s - 180s = 120s usados) → 25 pts, senão 15 pts
  const rapido = tempoRestante >= 180;
  const pontosGanhos = rapido ? 25 : 15;
  pontos += pontosGanhos;

  const proximaFase = nivelAtual < 3 ? nivelAtual + 1 : null;

  const overlay = document.createElement('div');
  overlay.className = 'fase-concluida-overlay';

  overlay.innerHTML = `
    <div class="fase-concluida-box">
      <div class="fc-icon">🏆</div>
      <h2 class="fc-titulo">Fase ${nivelAtual} Concluída!</h2>
      <div class="fc-estrelas">
        <span class="fc-estrela ${rapido ? 'ativa' : ''}">⭐</span>
        <span class="fc-estrela ${rapido ? 'ativa' : ''}">⭐</span>
        <span class="fc-estrela ativa">⭐</span>
      </div>
      <div class="fc-pontos">
        <span class="fc-pontos-valor">+${pontosGanhos}</span>
        <span class="fc-pontos-label">pontos</span>
      </div>
      <p class="fc-desc">${rapido ? '🚀 Concluído em menos de 3 minutos! Bônus máximo!' : '✅ Fase concluída! Complete mais rápido para mais pontos.'}</p>
      <div class="fc-btns">
        ${proximaFase ? `<button class="btn btn-play fc-btn" onclick="this.closest('.fase-concluida-overlay').remove(); iniciarJogo(${proximaFase})">PRÓXIMA FASE →</button>` : '<p class="fc-fim">🎉 Você completou todas as fases!</p>'}
        <button class="btn btn-outline fc-btn" onclick="this.closest('.fase-concluida-overlay').remove(); showScreen('screen-fases')">MENU DE FASES</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
}

function atualizarHUD() {
  const tempo = document.getElementById("tempo");
  const meta = document.getElementById("meta");
  const fase = document.getElementById("fase");

  if (!tempo || !meta || !fase) return;

  const minutos = Math.floor(tempoRestante / 60);
  const segundos = tempoRestante % 60;

  tempo.textContent = `Tempo: ${minutos}:${segundos.toString().padStart(2, "0")}`;
  meta.textContent = `Carros: ${carrosPassaram}/${META_FASE[nivelAtual]}`;
  fase.textContent = `Fase: ${nivelAtual}`;
}

function mostrarMensagemDerrota(texto) {
  const antiga = document.querySelector(".game-message");
  if (antiga) antiga.remove();

  const msg = document.createElement("div");
  msg.className = "game-message";

  msg.innerHTML = `
    <div class="game-message-box">
      <h2>Você perdeu!</h2>
      <p>${texto}</p>
      <button id="btn-reiniciar" type="button">Tentar novamente</button>
    </div>
  `;

  document.body.appendChild(msg);

  const botao = document.getElementById("btn-reiniciar");

  botao.onclick = function () {
    msg.remove();
    iniciarJogo(nivelAtual);
  };
}

function mostrarAviso(texto) {
  const aviso = document.createElement("div");
  aviso.className = "game-aviso";
  aviso.textContent = texto;
  document.getElementById("screen-game").appendChild(aviso);
  setTimeout(() => aviso.remove(), 2500);
}