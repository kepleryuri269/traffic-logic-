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
// Escala dos sprites em relação ao mapa da fase atual — carro e pedestre
// separados, porque às vezes um precisa encolher mais que o outro. Cada
// fase define em CONFIG_NIVEL[nivel]:
//   escalaSprite:    1 = carro tamanho normal, 0.8 = 20% menor, etc.
//   escalaPedestre:  idem, mas só pro pedestre (se não definir, usa o
//                    mesmo valor de escalaSprite).
// Ver iniciarLoop().
let escalaSpriteAtual   = 1;
let escalaPedestreAtual = 1;
// Escala do semáforo desenhado (1 = tamanho normal) e distância (px do mapa)
// entre o para-choque e a linha de parada. Ver iniciarLoop().
let escalaSemaforoAtual = 1;
let distParadaAtual     = 35;
// Duração total da fase atual em segundos (CONFIG_NIVEL[n].tempo, padrão 300)
let tempoTotalFase      = 300;
// Contador para dar um id único a cada carro (desempate na fila)
let proximoIdCarro      = 1;
const crashAudio = new Audio('assets/audio/crash.mp3');
window.crashAudio = crashAudio;
crashAudio.volume = window.cfgVolume ?? 1;

// META_FASE e CONFIG_NIVEL começam vazios aqui. Cada fase (game1.js,
// game2.js, game3.js...) preenche a sua própria chave, ex:
//   META_FASE[2]    = 30;
//   CONFIG_NIVEL[2]  = { intervaloSpawn: 2000, velocidade: 2.2, maxCarros: 18 };
const META_FASE = {};
const CONFIG_NIVEL = {};

const BASE_W = 1672;
const BASE_H = 941;

// Distância mínima "genérica" (fallback) entre carros da mesma via.
// A distância real usada no jogo é calculada dinamicamente por par de
// carros através de distanciaMinimaEntre() — ver mais abaixo. Isso é
// necessário porque os sprites virados para EAST/WEST mostram o carro
// de perfil (bem mais "compridos") enquanto os sprites NORTH/SOUTH
// mostram o carro de cima (mais "curtos"), então uma distância fixa
// deixava as vias horizontais com os carros colados/sobrepostos.
const DIST_FILA_VIA = 65;

// Comprimento visível (em px, na escala de desenho tamanho=96) de cada
// tipo de veículo, separado por orientação horizontal (EAST/WEST) e
// vertical (NORTH/SOUTH) — medido a partir da área não-transparente
// de cada sprite.
const COMPRIMENTO_VEICULO = {
  AMBULANCE:       { horizontal: 71, vertical: 66 },
  BROWN_CIVIC:      { horizontal: 54, vertical: 46 },
  TAXI:             { horizontal: 80, vertical: 64 },
  WHITE_HATCHBACK:  { horizontal: 76, vertical: 62 }
};

// Largura visível (em px, na escala tamanho=96) de cada veículo, medida
// na direção PERPENDICULAR à viagem — é o que precisa caber dentro da
// faixa. Horizontal = sprites EAST/WEST, vertical = sprites NORTH/SOUTH.
const LARGURA_VEICULO = {
  AMBULANCE:       { horizontal: 35, vertical: 26 },
  BROWN_CIVIC:      { horizontal: 35, vertical: 35 },
  TAXI:             { horizontal: 39, vertical: 37 },
  WHITE_HATCHBACK:  { horizontal: 39, vertical: 41 }
};

// Espaço extra (px) entre o para-choque de um carro e o do carro da frente,
// além do comprimento dos dois veículos — evita que fiquem "colados".
// Também é reduzido junto com o tamanho do carro.
const MARGEM_ENTRE_CARROS = 16;

function ehHorizontal(direcao) {
  return direcao === 'EAST' || direcao === 'WEST';
}

// Retorna o comprimento do carro na direção em que ele está viajando.
function comprimentoCarro(carro) {
  const tabela = COMPRIMENTO_VEICULO[carro.tipoVeiculo] || COMPRIMENTO_VEICULO.AMBULANCE;
  const base = ehHorizontal(carro.direcao) ? tabela.horizontal : tabela.vertical;
  // A tabela foi medida na escala "tamanho=96"; se a fase usa uma escala
  // diferente (carro.tamanho já vem multiplicado), ajusta na mesma proporção.
  const escala = (carro.tamanho || 96) / 96;
  return base * escala;
}

// Largura do carro (lado a lado na faixa), na mesma escala do desenho.
function larguraCarro(carro) {
  const tabela = LARGURA_VEICULO[carro.tipoVeiculo] || LARGURA_VEICULO.AMBULANCE;
  const base = ehHorizontal(carro.direcao) ? tabela.horizontal : tabela.vertical;
  return base * (carro.tamanho || 96) / 96;
}

// Distância mínima (centro-a-centro) entre dois carros específicos,
// considerando o comprimento real de cada um na sua direção de viagem.
function distanciaMinimaEntre(carroA, carroB) {
  const escala = (carroA.tamanho || 96) / 96;
  return comprimentoCarro(carroA) / 2 + comprimentoCarro(carroB) / 2 + MARGEM_ENTRE_CARROS * escala;
}

// Escala do mapa na tela: o mapa (1672×941) é esticado para caber na tela,
// então os carros precisam acompanhar essa escala — senão, numa tela
// menor, o carro continua com 96px e fica maior que a própria rua.
function escalaMapaTela() {
  if (!gameCanvas) return 1;
  return Math.min(gameCanvas.width / BASE_W, gameCanvas.height / BASE_H) || 1;
}

// Calcula a escala do carro para que ele caiba na largura da faixa.
// CONFIG_NIVEL[n].larguraFaixa pode ser um número (mesma largura para
// todas as faixas) ou { horizontal: px, vertical: px } — medidas em px
// do mapa 1672×941. Se não for informado, usa escalaSprite (ou 1).
function calcularEscalaSprite(cfg) {
  if (!cfg.larguraFaixa) return cfg.escalaSprite || 1;

  const faixaH = typeof cfg.larguraFaixa === 'number' ? cfg.larguraFaixa : cfg.larguraFaixa.horizontal;
  const faixaV = typeof cfg.larguraFaixa === 'number' ? cfg.larguraFaixa : cfg.larguraFaixa.vertical;
  const maiorH = Math.max(...Object.values(LARGURA_VEICULO).map(v => v.horizontal));
  const maiorV = Math.max(...Object.values(LARGURA_VEICULO).map(v => v.vertical));
  const ocupacao = cfg.ocupacaoFaixa || 0.9; // carro ocupa 90% da faixa

  const escalas = [];
  if (faixaH) escalas.push((faixaH * ocupacao) / maiorH);
  if (faixaV) escalas.push((faixaV * ocupacao) / maiorV);
  return escalas.length ? Math.min(...escalas) : (cfg.escalaSprite || 1);
}

// Identificador da via (faixa) do carro. Fases com mais de uma rua na
// mesma direção (ex: duas ruas indo para EAST) usam rota.id para separar
// as filas; sem id, a via é a própria direção (como na fase 1).
function viaDaRota(rota) {
  return rota.id || rota.direcao;
}

// Direção unitária do trecho atual do carro
function vetorDoCarro(carro) {
  const a = carro.waypoints[Math.max(0, carro.wpIndex - 1)];
  const b = carro.waypoints[Math.min(carro.wpIndex, carro.waypoints.length - 1)];
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

// ══════════════════════════════════════════════
//  PEDESTRES
// ══════════════════════════════════════════════
let pedestres          = [];
let pedImagens         = {};   // { skin: { frente: [img, img], costas: [...], lado: [...] } }
let pedImgsCarregadas  = 0;
let pedImgsProntas     = false;

// Skins de pedestre — uma é sorteada a cada nascimento.
// Para adicionar outro personagem, basta copiar o bloco e trocar o nome dos PNGs.
const PED_SPRITES = {
  adolescente: {
    frente: [
      'assets/img/pedestres/adolescente_frente_passo1.png',
      'assets/img/pedestres/adolescente_frente_passo2.png'
    ],
    costas: [
      'assets/img/pedestres/adolescente_costas_passo1.png',
      'assets/img/pedestres/adolescente_costas_passo2.png'
    ],
    lado: [ // perfil olhando para a direita (espelhado para a esquerda)
      'assets/img/pedestres/adolescente_frente_lado_passo1.png',
      'assets/img/pedestres/adolescente_frente_lado_passo2.png'
    ]
  },
  estudante: {
    frente: [
      'assets/img/pedestres/estudante_frente_passo1.png',
      'assets/img/pedestres/estudante_frente_passo2.png'
    ],
    costas: [
      'assets/img/pedestres/estudante_costas_passo1.png',
      'assets/img/pedestres/estudante_costas_passo2.png'
    ],
    lado: [
      'assets/img/pedestres/estudante_frente_lado_passo1.png',
      'assets/img/pedestres/estudante_frente_lado_passo2.png'
    ]
  },
  mulher: {
    frente: [
      'assets/img/pedestres/mulher_frente_passo1.png',
      'assets/img/pedestres/mulher_frente_passo2.png'
    ],
    costas: [
      'assets/img/pedestres/mulher_costas_passo1.png',
      'assets/img/pedestres/mulher_costas_passo2.png'
    ],
    lado: [
      'assets/img/pedestres/mulher_frente_lado_passo1.png',
      'assets/img/pedestres/mulher_frente_lado_passo2.png'
    ]
  }
};

const PED_SKINS = Object.keys(PED_SPRITES);
const PED_TOTAL_IMGS = PED_SKINS.length * 6;

const CONFIG_PEDESTRES = {
  intervaloSpawn: 7000,   // ms entre nascimentos de pedestre
  maxPedestres:   3,      // pedestres simultâneos na tela
  velocidade:     0.55,   // px/frame (bem mais lento que os carros)
  altura:         56,     // altura do sprite desenhado (px)
  larguraProp:    62/103, // proporção largura/altura original do sprite
  frameDuration:  220,    // ms — troca de perna (A/B) a cada intervalo
  distMinima:     45,     // distância mínima entre pedestres na mesma rota
  paciencia:      11000,  // ms esperando o sinal antes de atravessar imprudente
  penalidadeAtropelo: 30, // segundos perdidos ao atropelar quem atravessa na faixa
  penalidadeImprudente: 10 // segundos perdidos ao atropelar quem furou o sinal
};

// Retângulo do asfalto do cruzamento (coordenadas do mapa 1672×941), POR FASE.
// O pedestre só entra aqui pela faixa e quando o sinal dos carros daquela via
// estiver vermelho. Cada fase preenche AREA_VIA_MAPA[nivel] no seu próprio
// arquivo (game1.js, game2.js...), ex:
//   AREA_VIA_MAPA[2] = { xMin: 805, xMax: 879, yMin: 224, yMax: 288 };
const AREA_VIA_MAPA = {};

// Rotas de calçada (coordenadas do mapa original 1672×941).
// IMPORTANTE: estes valores são um ponto de partida — ajuste-os para
// coincidirem com as calçadas/faixas desenhadas na arte de cada mapa
// (mapa1.png, mapa2.png...). Cada rota é uma linha reta: o pedestre
// nasce no primeiro ponto e caminha até o segundo.
// Container vazio — cada fase preenche ROTAS_PEDESTRES_MAPA[nivel] no seu
// próprio arquivo (game1.js, game2.js, game3.js...).
const ROTAS_PEDESTRES_MAPA = {};

// ══════════════════════════════════════════════
//  ROTAS (coordenadas do mapa original 1672×941)
// ══════════════════════════════════════════════
// Container vazio — cada fase preenche ROTAS_MAPA[nivel] no seu próprio
// arquivo (game1.js, game2.js, game3.js...).
const ROTAS_MAPA = {};

// ══════════════════════════════════════════════
//  SEMÁFOROS — posição no mapa original
//  Cada semáforo controla uma direção de tráfego
//  estado: 'green' | 'red'
//  Os 4 semáforos ficam nos 4 cantos do cruzamento
// ══════════════════════════════════════════════
// Container vazio — cada fase preenche SEMAFOROS_MAPA[nivel] no seu próprio
// arquivo (game1.js, game2.js, game3.js...).
const SEMAFOROS_MAPA = {};

// ══════════════════════════════════════════════
//  INICIALIZAR JOGO
// ══════════════════════════════════════════════
function iniciarJogo(nivel, restaurando = false) {
  nivelAtual = nivel;
  sessionStorage.setItem('nivelAtual', nivel);
  showScreen('screen-game');

  pararJogo();

  carros = [];
  pedestres = [];
  semaforos = [];
  carrosPassaram = 0;
  pontos = 0;
  tempoTotalFase = (CONFIG_NIVEL[nivel] && CONFIG_NIVEL[nivel].tempo) || 300;
  tempoRestante = tempoTotalFase;
  jogoEncerrado = false;
  proximoIdCarro = 1;
  explosoes = [];
  atropelamentos = [];
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
  screen.style.backgroundSize     = '100% 100%'; // igual ao canvas: mantém a camada de frente alinhada
  screen.style.backgroundPosition = 'center';
  screen.style.backgroundRepeat   = 'no-repeat';

  carregarCamadaFrente(nivel);

  const canvasAntigo = document.getElementById('game-canvas');
  if (canvasAntigo) canvasAntigo.remove();

  gameCanvas = document.createElement('canvas');
  gameCanvas.id = 'game-canvas';
  gameCanvas.tabIndex = 0;
  gameCanvas.setAttribute('role', 'application');
  gameCanvas.setAttribute('aria-label',
    'Cruzamento. Pressione Espaço para alternar a via verde. ' +
    'Em fases com mais de um cruzamento, as teclas 1 e 2 alternam cada cruzamento.');
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
  <div id="tempo">Tempo: ${Math.floor(tempoTotalFase / 60)}:${String(tempoTotalFase % 60).padStart(2, '0')}</div>
  <div id="meta">Carros: 0/${META_FASE[nivel]}</div>
  <div id="fase">Fase: ${nivel}</div>
`;

screen.appendChild(hud);

  // Inicializa semáforos
 const defsem = SEMAFOROS_MAPA[nivel] || [];
semaforos = defsem.map(s => ({ ...s }));

  // Clique para alternar semáforo
  gameCanvas.addEventListener('click', onClickCanvas);

  // Acessibilidade: teclado controla os mesmos semáforos
  registrarTeclasSemaforo();
  gameCanvas.focus();

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

  // ── Carrega sprites dos pedestres ──
  pedImgsCarregadas = 0;
  pedImgsProntas    = false;
  pedImagens = {};
  PED_SKINS.forEach(skin => {
    pedImagens[skin] = { frente: [null, null], costas: [null, null], lado: [null, null] };
    ['frente', 'costas', 'lado'].forEach(tipo => {
      PED_SPRITES[skin][tipo].forEach((src, i) => {
        const img = new Image();
        const done = () => {
          pedImgsCarregadas++;
          if (pedImgsCarregadas === PED_TOTAL_IMGS) pedImgsProntas = true;
        };
        img.onload  = done;
        img.onerror = done;
        img.src = src;
        pedImagens[skin][tipo][i] = img;
      });
    });
  });
}

// ══════════════════════════════════════════════
//  CLIQUE NO CANVAS — alterna semáforo clicado
// ══════════════════════════════════════════════
function onClickCanvas(e) {
  const rect = gameCanvas.getBoundingClientRect();
  const mx   = (e.clientX - rect.left) / (rect.width  / BASE_W);
  const my   = (e.clientY - rect.top)  / (rect.height / BASE_H);
  const RAIO = 60 * escalaSemaforoAtual;

  // Verifica qual semáforo foi clicado (o mais próximo dentro do raio)
  let clicado = null, menor = Infinity;
  semaforos.forEach(s => {
    const d = Math.hypot(mx - s.x, my - s.y);
    if (d < RAIO && d < menor) { menor = d; clicado = s; }
  });

  if (!clicado) return;

  // Só mexe no cruzamento do semáforo clicado
  ativarGrupoSemaforo(clicado.grupo === 1 ? 1 : 2, cruzamentoDo(clicado));
}

// Cruzamento a que o semáforo pertence (fase 1 só tem o cruzamento 1)
function cruzamentoDo(sem) {
  return sem.cruzamento ?? 1;
}

// Direção (EAST/WEST/NORTH/SOUTH) do tráfego que o semáforo controla
function direcaoDoSemaforo(sem) {
  return sem.direcao || sem.controla;
}

function listaCruzamentos() {
  return [...new Set(semaforos.map(cruzamentoDo))];
}

// ══════════════════════════════════════════════
//  SEMÁFOROS — mouse e teclado usam a mesma lógica
// ══════════════════════════════════════════════
function ativarGrupoSemaforo(grupo, cruzamento = null) {
  // O grupo escolhido vai pra verde, o outro pra vermelho — apenas no
  // cruzamento indicado (ou em todos, se cruzamento for null)
  semaforos.forEach(s => {
    if (cruzamento !== null && cruzamentoDo(s) !== cruzamento) return;
    s.estado = s.grupo === grupo ? 'green' : 'red';
  });
}

// Alterna um cruzamento específico, ou cada cruzamento de forma
// independente quando cruzamento = null (tecla Espaço)
function alternarSemaforos(cruzamento = null) {
  const alvos = cruzamento === null ? listaCruzamentos() : [cruzamento];
  alvos.forEach(c => {
    const verdeAtual = semaforos.find(s => cruzamentoDo(s) === c && s.estado === 'green');
    const grupoAtual = verdeAtual ? verdeAtual.grupo : 2;
    ativarGrupoSemaforo(grupoAtual === 1 ? 2 : 1, c);
  });
}

let teclasSemaforoRegistradas = false;

function registrarTeclasSemaforo() {
  if (teclasSemaforoRegistradas) return;
  teclasSemaforoRegistradas = true;

  window.addEventListener('keydown', e => {
    const tela = document.getElementById('screen-game');
    if (!tela || !tela.classList.contains('active')) return;
    if (jogoEncerrado || !semaforos.length) return;

    if (e.code === 'Space') {
      e.preventDefault();          // evita rolar a página / reclicar botão focado
      alternarSemaforos();
      return;
    }

    // Teclas 1, 2, 3... alternam só o cruzamento correspondente
    const m = /^(Digit|Numpad)(\d)$/.exec(e.code);
    if (m && listaCruzamentos().includes(Number(m[2]))) {
      e.preventDefault();
      alternarSemaforos(Number(m[2]));
    }
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
  escalaSpriteAtual   = calcularEscalaSprite(cfg);
  escalaPedestreAtual = cfg.escalaPedestre || escalaSpriteAtual;
  escalaSemaforoAtual = cfg.escalaSemaforo || 1;
  distParadaAtual     = cfg.distParada ?? 35;

  let spawnTimer = setInterval(() => {
    const ativos = carros.filter(c => c.ativo).length;
    if (ativos < cfg.maxCarros) spawnCarro(nivel, cfg.velocidade);
  }, cfg.intervaloSpawn);
  spawnCarro(nivel, cfg.velocidade);

  // ── Spawn de pedestres (independente dos carros) ──
  let pedSpawnTimer = setInterval(() => {
    const ativos = pedestres.filter(p => p.ativo).length;
    if (ativos < CONFIG_PEDESTRES.maxPedestres) spawnPedestre(nivel);
  }, CONFIG_PEDESTRES.intervaloSpawn);
  spawnPedestre(nivel);

  let lastTime = 0;
  function loop(ts) {
    const dt = Math.min((ts - lastTime) / 16.67, 3);
    lastTime = ts;
    atualizarCarros(dt);
    atualizarPedestres(dt);
    renderizar();
    gameLoop = requestAnimationFrame(loop);
  }
  gameLoop = requestAnimationFrame(loop);
  gameCanvas._spawnTimer    = spawnTimer;
  gameCanvas._pedSpawnTimer = pedSpawnTimer;
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
  const via = viaDaRota(rotaBase);

  // Direção unitária da via (do ponto de spawn em direção à pista)
  const dirX   = waypoints[1].x - waypoints[0].x;
  const dirY   = waypoints[1].y - waypoints[0].y;
  const dirLen = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / dirLen;
  const uy = dirY / dirLen;

  // Tamanho do carro: escala da fase (ajustada à largura da faixa) ×
  // escala do mapa na tela — assim o carro sempre cabe na rua desenhada.
  const tamanho = 96 * escalaSpriteAtual * escalaMapaTela();
  const carroNovo = { direcao: rotaBase.direcao, tipoVeiculo, tamanho };

  // Procura o carro MAIS ATRÁS da fila nessa via (menor posição ao longo
  // da via). O novo carro nasce no ponto de spawn ou, se a fila já chegou
  // até lá, logo atrás do último carro — nunca em cima de outro. (Antes
  // o carro era posicionado em relação ao mais próximo do spawn, e dois
  // carros podiam nascer no mesmo lugar e andar sobrepostos.)
  const sSpawn = waypoints[0].x * ux + waypoints[0].y * uy;
  let sNascer = sSpawn;
  carros.forEach(c => {
    if (!c.ativo || c.via !== via) return;
    const sC = c.x * ux + c.y * uy;
    const limite = sC - distanciaMinimaEntre(carroNovo, c);
    if (limite < sNascer) sNascer = limite;
  });

  // Fila grande demais "fora da tela": não cria mais carros nessa via
  // até ela andar (evita uma fila infinita escondida).
  const recuo = sSpawn - sNascer;
  if (recuo > comprimentoCarro(carroNovo) * 3) return;

  carros.push({
    id:         proximoIdCarro++,
    x: waypoints[0].x - ux * recuo,
    y: waypoints[0].y - uy * recuo,
    direcao:    rotaBase.direcao,
    via,
    waypoints,
    wpIndex:    1,
    velocidade: velocidade,
    tamanho,
    ativo:      true,
    parado:     false,
    tipoVeiculo
  });
}

// ══════════════════════════════════════════════
//  PEDESTRES — spawn, movimento e desenho
// ══════════════════════════════════════════════
function spawnPedestre(nivel) {
  const rotasDisponiveis = ROTAS_PEDESTRES_MAPA[nivel];
  if (!rotasDisponiveis || rotasDisponiveis.length === 0) return;

  // Rodízio entre as rotas: garante que todas recebam pedestres
  spawnPedestre._proxRota = (spawnPedestre._proxRota ?? 0) % rotasDisponiveis.length;
  const rotaBase = rotasDisponiveis[spawnPedestre._proxRota];
  spawnPedestre._proxRota++;
  const scaleX   = gameCanvas.width  / BASE_W;
  const scaleY   = gameCanvas.height / BASE_H;
  const waypoints = rotaBase.waypoints.map(w => ({ x: w.x * scaleX, y: w.y * scaleY }));

  // Evita nascer em cima de outro pedestre na mesma rota
  const jaTemPerto = pedestres.some(p =>
    p.ativo &&
    Math.hypot(p.x - waypoints[0].x, p.y - waypoints[0].y) < CONFIG_PEDESTRES.distMinima
  );
  if (jaTemPerto) return;

  // Direção fixa da rota (calculada uma vez, evita o sprite "girar")
  const dirX = waypoints[1].x - waypoints[0].x;
  const dirY = waypoints[1].y - waypoints[0].y;

  pedestres.push({
    x: waypoints[0].x,
    y: waypoints[0].y,
    dirX, dirY,
    waypoints,
    wpIndex: 1,
    rotaRef: rotaBase,
    skin: PED_SKINS[Math.floor(Math.random() * PED_SKINS.length)],
    ativo: true,
    esperando: false,   // parado no meio-fio pedindo o sinal
    esperaMs: 0,        // há quanto tempo espera
    imprudente: false,  // perdeu a paciência e atravessou no sinal fechado
    naVia: false,       // está em cima do asfalto
    frameIndex: Math.random() < 0.5 ? 0 : 1,
    frameTimer: Math.random() * CONFIG_PEDESTRES.frameDuration
  });
}

// A faixa está liberada para o pedestre quando os carros que cruzam aquela
// faixa estão no vermelho. 'horizontal' = travessia da via horizontal
// (carros EAST/WEST), 'vertical' = travessia da via vertical (NORTH/SOUTH).
// Em fases com vários cruzamentos, só olha os semáforos do cruzamento
// onde o pedestre está atravessando.
function faixaLiberada(tipo, cruzamento = 1) {
  const dirs = tipo === 'horizontal' ? ['EAST', 'WEST'] : ['NORTH', 'SOUTH'];
  return semaforos
    .filter(s => cruzamentoDo(s) === cruzamento && dirs.includes(direcaoDoSemaforo(s)))
    .every(s => s.estado === 'red');
}

// Lista de retângulos de asfalto dos cruzamentos da fase atual.
// AREA_VIA_MAPA[n] pode ser um único retângulo (fase 1) ou uma lista
// com um retângulo por cruzamento (fase 2), cada um com { cruzamento }.
function areasViaAtual() {
  const a = AREA_VIA_MAPA[nivelAtual] || AREA_VIA_MAPA[1];
  if (!a) return [];
  return (Array.isArray(a) ? a : [a]).map((r, i) => ({ ...r, cruzamento: r.cruzamento ?? (i + 1) }));
}

function atualizarPedestres(dt) {
  if (!pedImgsProntas) return;

  const scaleX = gameCanvas.width  / BASE_W;
  const scaleY = gameCanvas.height / BASE_H;

  const AREAS = areasViaAtual();
  const noX = (x, a) => x > a.xMin && x < a.xMax;  // em cima da via vertical
  const noY = (y, a) => y > a.yMin && y < a.yMax;  // em cima da via horizontal

  pedestres.forEach(ped => {
    if (!ped.ativo) return;

    const alvo = ped.waypoints[ped.wpIndex];
    if (!alvo) { ped.ativo = false; return; }

    const dx   = alvo.x - ped.x;
    const dy   = alvo.y - ped.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 0.5) { ped.dirX = dx; ped.dirY = dy; }

    const passo = CONFIG_PEDESTRES.velocidade * dt;

    // ── Semáforo de pedestre: só entra no asfalto com a faixa liberada ──
    const bx = ped.x / scaleX;
    const by = ped.y / scaleY;
    const proxBx = (ped.x + (dx / (dist || 1)) * passo) / scaleX;
    const proxBy = (ped.y + (dy / (dist || 1)) * passo) / scaleY;

    const dentroX = AREAS.some(a => noX(bx, a));
    const dentroY = AREAS.some(a => noY(by, a));
    // As vias atravessam o mapa inteiro: basta estar na faixa de uma delas
    ped.naVia = dentroX || dentroY;

    let bloqueado = false;
    const vertical = Math.abs(dy) >= Math.abs(dx);
    if (vertical) {
      // Vai entrar numa via horizontal: confere o sinal daquele cruzamento
      const area = !dentroY && AREAS.find(a => noY(proxBy, a));
      if (area && !faixaLiberada('horizontal', area.cruzamento)) bloqueado = true;
    } else {
      // Vai entrar na via vertical: usa o cruzamento mais próximo da faixa
      const candidatas = dentroX ? [] : AREAS.filter(a => noX(proxBx, a));
      if (candidatas.length) {
        const area = candidatas.reduce((m, a) =>
          Math.abs(by - (a.yMin + a.yMax) / 2) < Math.abs(by - (m.yMin + m.yMax) / 2) ? a : m);
        if (!faixaLiberada('vertical', area.cruzamento)) bloqueado = true;
      }
    }

    if (bloqueado && !ped.imprudente) {
      ped.esperando = true;
      ped.esperaMs += dt * 16.67;
      // Cansou de esperar: atravessa fora da regra (e vira risco de acidente)
      if (ped.esperaMs >= CONFIG_PEDESTRES.paciencia) {
        ped.imprudente = true;
        ped.esperando  = false;
      }
      return; // fica parado no meio-fio
    }

    ped.esperando = false;
    if (!ped.naVia) { ped.imprudente = false; ped.esperaMs = 0; }

    if (dist <= passo) {
      ped.x = alvo.x;
      ped.y = alvo.y;
      ped.wpIndex++;
      if (ped.wpIndex >= ped.waypoints.length) ped.ativo = false;
    } else {
      ped.x += (dx / dist) * passo;
      ped.y += (dy / dist) * passo;
    }

    // Animação de caminhada — alterna frame A/B periodicamente
    ped.frameTimer += dt * 16.67;
    if (ped.frameTimer >= CONFIG_PEDESTRES.frameDuration) {
      ped.frameTimer = 0;
      ped.frameIndex = ped.frameIndex === 0 ? 1 : 0;
    }
  });

  verificarAtropelamentos();
  pedestres = pedestres.filter(p => p.ativo);
}

// ── Atropelamento ────────────────────────────
function verificarAtropelamentos() {
  if (jogoEncerrado) return;

  const scale = Math.min(gameCanvas.width / BASE_W, gameCanvas.height / BASE_H);
  const DIST_ATROPELO = 34 * scale * escalaPedestreAtual;

  pedestres.forEach(ped => {
    if (!ped.ativo || !ped.naVia) return;

    const carro = carros.find(c =>
      c.ativo && !c.parado &&
      Math.hypot(c.x - ped.x, c.y - ped.y) < DIST_ATROPELO + comprimentoCarro(c) / 3
    );
    if (!carro) return;

    ped.ativo = false;
    criarAtropelamento(ped, carro);

    crashAudio.currentTime = 0;
    crashAudio.play().catch(() => {});

    const perda = ped.imprudente
      ? CONFIG_PEDESTRES.penalidadeImprudente
      : CONFIG_PEDESTRES.penalidadeAtropelo;

    tempoRestante = Math.max(0, tempoRestante - perda);
    mostrarAviso(ped.imprudente
      ? `-${perda}s — Pedestre atravessou fora da hora!`
      : `-${perda}s — Atropelamento na faixa!`);
  });
}

// ══════════════════════════════════════════════
//  ANIMAÇÃO DE ATROPELAMENTO
//  O pedestre é arremessado na direção do carro, girando no ar,
//  com flash de impacto, onda de choque, faíscas e poeira.
// ══════════════════════════════════════════════
let atropelamentos = [];

const DIR_VETOR = {
  EAST:  { x:  1, y:  0 },
  WEST:  { x: -1, y:  0 },
  SOUTH: { x:  0, y:  1 },
  NORTH: { x:  0, y: -1 }
};

function criarAtropelamento(ped, carro) {
  const dir   = DIR_VETOR[carro.direcao] || { x: 1, y: 0 };
  const scale = Math.min(gameCanvas.width / BASE_W, gameCanvas.height / BASE_H);
  const forca = (5.5 + carro.velocidade * 1.6) * scale;

  atropelamentos.push({
    x: ped.x,
    y: ped.y,
    ox: ped.x,  // ponto do impacto (poeira, flash e faíscas ficam aqui)
    oy: ped.y,
    vx: dir.x * forca + (Math.random() - 0.5) * 1.5,
    vy: dir.y * forca + (Math.random() - 0.5) * 1.5 - 1.2,
    rot: 0,
    rotVel: (dir.x !== 0 ? dir.x : 1) * (0.18 + Math.random() * 0.1),
    frame: 0,
    maxFrames: 90,
    escala: scale,
    tipo: Math.abs(ped.dirX) > Math.abs(ped.dirY) ? 'lado' : (ped.dirY >= 0 ? 'frente' : 'costas'),
    skin: ped.skin,
    frameIndex: ped.frameIndex,
    faiscas: Array.from({ length: 14 }, () => ({
      x: 0, y: 0,
      ang: Math.atan2(dir.y, dir.x) + (Math.random() - 0.5) * 2.2,
      vel: (2 + Math.random() * 6) * scale,
      raio: (1.5 + Math.random() * 2.5) * scale,
      cor: ['#fff3c4', '#ffd166', '#ff8c42'][Math.floor(Math.random() * 3)]
    })),
    poeira: Array.from({ length: 12 }, () => ({
      ang: Math.random() * Math.PI * 2,
      vel: (0.6 + Math.random() * 1.8) * scale,
      raio: (5 + Math.random() * 9) * scale
    }))
  });
}

function desenharAtropelamentos() {
  if (atropelamentos.length === 0) return;

  const altura  = CONFIG_PEDESTRES.altura * escalaPedestreAtual * escalaMapaTela();
  const largura = altura * CONFIG_PEDESTRES.larguraProp;

  atropelamentos.forEach(a => {
    const t    = a.frame / a.maxFrames;   // 0 → 1
    const voo  = Math.min(1, a.frame / 34); // fase de voo

    // ── Poeira no chão (sobe primeiro, some depois) ──
    a.poeira.forEach(p => {
      const d  = p.vel * a.frame;
      const px = a.ox + Math.cos(p.ang) * d;
      const py = a.oy + Math.sin(p.ang) * d * 0.5;
      const al = Math.max(0, 0.35 * (1 - t * 1.4));
      if (al <= 0) return;
      ctx.globalAlpha = al;
      ctx.fillStyle = '#c9bda6';
      ctx.beginPath();
      ctx.arc(px, py, p.raio * (1 + t), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // ── Onda de choque do impacto ──
    if (a.frame < 22) {
      const prog = a.frame / 22;
      ctx.globalAlpha = (1 - prog) * 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 4 * (1 - prog) * a.escala;
      ctx.beginPath();
      ctx.arc(a.ox, a.oy, 12 * a.escala + prog * 70 * a.escala, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ── Flash branco/laranja no ponto do impacto ──
    if (a.frame < 12) {
      const prog  = a.frame / 12;
      const raio  = 55 * a.escala * (0.4 + prog);
      const grad  = ctx.createRadialGradient(a.ox, a.oy, 0, a.ox, a.oy, raio);
      grad.addColorStop(0,   `rgba(255,255,255,${(1 - prog) * 0.9})`);
      grad.addColorStop(0.5, `rgba(255,190,80,${(1 - prog) * 0.5})`);
      grad.addColorStop(1,   'rgba(255,120,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(a.ox, a.oy, raio, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Faíscas saindo na direção do carro ──
    a.faiscas.forEach(f => {
      const d  = f.vel * a.frame * 0.55;
      const px = a.ox + Math.cos(f.ang) * d;
      const py = a.oy + Math.sin(f.ang) * d;
      const al = Math.max(0, 1 - t * 2);
      if (al <= 0) return;
      ctx.globalAlpha = al;
      ctx.fillStyle = f.cor;
      ctx.beginPath();
      ctx.arc(px, py, f.raio * (1 - t * 0.6), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // ── Corpo arremessado: sobe, gira e cai ──
    const alturaVoo = Math.sin(voo * Math.PI) * 34 * a.escala; // "pulo" no ar
    const sombraAl  = Math.max(0, 0.35 - alturaVoo / (120 * a.escala));

    ctx.globalAlpha = sombraAl;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(a.x, a.y, largura * 0.45, largura * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    const sprites = pedImagens[a.skin] || pedImagens[PED_SKINS[0]];
    const img = sprites && sprites[a.tipo] && sprites[a.tipo][a.frameIndex];
    if (img && img.complete && img.naturalWidth > 0) {
      const fade  = a.frame > a.maxFrames - 25
        ? Math.max(0, (a.maxFrames - a.frame) / 25)
        : 1;
      const zoom  = 1 + alturaVoo / (90 * a.escala);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(a.x, a.y - alturaVoo);
      ctx.rotate(a.rot);
      ctx.scale(zoom, zoom);
      ctx.drawImage(img, -largura / 2, -altura * 0.9, largura, altura);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // ── Física simples: desacelera até parar caído no chão ──
    a.x   += a.vx;
    a.y   += a.vy;
    a.vx  *= 0.93;
    a.vy  *= 0.93;
    if (a.frame < 34) {
      a.rot += a.rotVel;
    } else {
      // aterrissa deitado (meia volta) e para de girar
      const alvo = a.rotVel > 0 ? Math.PI / 2 : -Math.PI / 2;
      a.rot += (alvo - a.rot) * 0.12;
    }
    a.frame++;
  });

  atropelamentos = atropelamentos.filter(a => a.frame < a.maxFrames);
}

function desenharPedestres() {
  if (!pedImgsProntas) return;

  const altura  = CONFIG_PEDESTRES.altura * escalaPedestreAtual * escalaMapaTela();
  const largura = altura * CONFIG_PEDESTRES.larguraProp;

  pedestres.forEach(ped => {
    // Vertical usa frente/costas; horizontal usa o perfil (espelhado para a
    // esquerda). frameIndex alterna entre passo1/passo2 da mesma pose.
    const horizontal = Math.abs(ped.dirX) > Math.abs(ped.dirY);
    let tipo, espelhar = false;

    if (horizontal) {
      tipo = 'lado';
      espelhar = ped.dirX < 0;
    } else {
      tipo = ped.dirY >= 0 ? 'frente' : 'costas';
    }

    const sprites = pedImagens[ped.skin] || pedImagens[PED_SKINS[0]];
    const img = sprites && sprites[tipo][ped.frameIndex];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const balanco = ped.frameIndex === 0 ? 0 : -1;

    ctx.save();
    ctx.translate(ped.x, ped.y + balanco);
    if (espelhar) ctx.scale(-1, 1);
    // Ancorado pelos pés: o ponto da rota fica logo abaixo dos pés
    ctx.drawImage(img, -largura / 2, -altura * 0.9, largura, altura);
    ctx.restore();

    if (ped.esperando) desenharPedidoTravessia(ped, altura);
  });
}

// Balãozinho "!" acima do pedestre que está esperando o sinal abrir.
// Fica amarelo no começo e vai ficando vermelho conforme perde a paciência.
function desenharPedidoTravessia(ped, altura) {
  const prog = Math.min(1, ped.esperaMs / CONFIG_PEDESTRES.paciencia);
  const piscar = Math.floor(ped.esperaMs / (prog > 0.6 ? 180 : 400)) % 2 === 0;
  if (!piscar) return;

  const raio = altura * 0.17;
  const cx = ped.x;
  const cy = ped.y - altura * 1.05;

  ctx.save();
  ctx.fillStyle   = prog > 0.6 ? '#e63946' : '#ffd166';
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle    = '#1d1d1d';
  ctx.font         = `bold ${Math.round(raio * 1.7)}px sans-serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', cx, cy + 1);
  ctx.restore();
}

// ══════════════════════════════════════════════
//  ATUALIZAR CARROS — respeita semáforo vermelho
// ══════════════════════════════════════════════
function atualizarCarros(dt) {
  const scaleX = gameCanvas.width  / BASE_W;
  const scaleY = gameCanvas.height / BASE_H;
  const STOP_DIST = distParadaAtual * Math.min(scaleX, scaleY);

  // Posição de cada carro ao longo da própria via (projeção no vetor de
  // direção). Com ela dá pra saber exatamente quem está na frente de quem
  // e a distância entre os para-choques, mesmo com 2 carros no mesmo ponto.
  carros.forEach(c => {
    if (!c.ativo) return;
    const u = vetorDoCarro(c);
    c.ux = u.x; c.uy = u.y;
    c.s  = c.x * u.x + c.y * u.y;
  });

  // Carro imediatamente à frente na MESMA via (faixa). Empate de posição
  // é resolvido pelo id (quem nasceu antes está na frente).
  function carroDaFrente(carro) {
    let melhor = null, gap = Infinity;
    for (const outro of carros) {
      if (outro === carro || !outro.ativo || outro.via !== carro.via) continue;
      const d = outro.x * carro.ux + outro.y * carro.uy - carro.s;
      const naFrente = d > 0 || (d === 0 && outro.id < carro.id);
      if (naFrente && d < gap) { gap = d; melhor = outro; }
    }
    return melhor ? { carro: melhor, gap } : null;
  }

  // Verifica se, depois do fim do cruzamento (sSaida), sobra espaço para
  // o carro inteiro. Acha o primeiro carro PARADO à frente na via e soma o
  // comprimento de todos os carros que ainda vão encostar atrás dele; se
  // o fim dessa fila (mais o próprio carro) invade o cruzamento, espera.
  function cabeDepoisDoCruzamento(carro, sSaida) {
    const margem = MARGEM_ENTRE_CARROS * (carro.tamanho / 96);
    const aFrente = carros
      .filter(o => o !== carro && o.ativo && o.via === carro.via &&
                   (o.x * carro.ux + o.y * carro.uy) > carro.s)
      .map(o => ({ c: o, s: o.x * carro.ux + o.y * carro.uy }))
      .sort((a, b) => a.s - b.s);

    const idxParado = aFrente.findIndex(o => o.c.parado);
    if (idxParado === -1) return true; // ninguém parado à frente: pista livre

    const parado = aFrente[idxParado];
    let fimDaFila = parado.s - comprimentoCarro(parado.c) / 2;
    for (let i = 0; i < idxParado; i++) {
      fimDaFila -= comprimentoCarro(aFrente[i].c) + margem;
    }
    return fimDaFila - margem - comprimentoCarro(carro) >= sSaida;
  }

  // Processa do carro mais adiantado para o mais atrasado de cada via,
  // assim cada carro já enxerga a posição atualizada do carro da frente
  // neste mesmo frame e nunca "entra" nele.
  const ordem = carros.filter(c => c.ativo).sort((a, b) => (b.s - a.s) || (a.id - b.id));

  ordem.forEach(carro => {
    if (!carro.ativo) return;
    carro.s = carro.x * carro.ux + carro.y * carro.uy;

    const frenteCarro = comprimentoCarro(carro) / 2;
    const frente = carroDaFrente(carro);
    carro.parado = false;

    // ── 1. Semáforos da via (uma via pode passar por vários cruzamentos) ──
    // Carros maiores têm a frente mais longe do centro do que carros
    // pequenos, então o limite de frenagem soma metade do comprimento.
    let limiteParada = Infinity; // quanto o carro ainda pode andar
    semaforos.forEach(sem => {
      if (sem.controla !== carro.via) return;
      const stopX = (sem.stopX ?? sem.x) * scaleX;
      const stopY = (sem.stopY ?? sem.y) * scaleY;
      const distAteFaixa = (stopX * carro.ux + stopY * carro.uy) - carro.s;
      if (distAteFaixa < 0) return; // já passou dessa faixa: segue em frente

      const folga = distAteFaixa - STOP_DIST - frenteCarro;
      let deveParar = sem.estado === 'red';

      // "Não bloqueie o cruzamento": mesmo no verde, só entra se houver
      // espaço do outro lado para o carro inteiro. Usado quando existe
      // outro cruzamento logo à frente na mesma via (fase 2).
      if (!deveParar && frente && sem.saidaX !== undefined && sem.saidaY !== undefined) {
        const sSaida = sem.saidaX * scaleX * carro.ux + sem.saidaY * scaleY * carro.uy;
        if (!cabeDepoisDoCruzamento(carro, sSaida)) deveParar = true;
      }

      if (deveParar) {
        // Se ainda está antes do ponto de frenagem, anda só até ele
        limiteParada = Math.min(limiteParada, Math.max(0, folga));
      }
    });

    // ── 2. Distância mínima do carro à frente na mesma via ──
    let passoMaxFila = Infinity;
    if (frente) {
      passoMaxFila = Math.max(0, frente.gap - distanciaMinimaEntre(carro, frente.carro));
    }

    const alvo = carro.waypoints[carro.wpIndex];
    if (!alvo) { carro.ativo = false; return; }

    let passo = Math.min(carro.velocidade * dt, limiteParada, passoMaxFila);
    if (passo <= 0.01) {
      carro.parado = true;
      return;
    }

    // ── 3. Mover ──
    const dx   = alvo.x - carro.x;
    const dy   = alvo.y - carro.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

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
    carro.s = carro.x * carro.ux + carro.y * carro.uy;
  });

  verificarColisoes();
  carros = carros.filter(c => c.ativo);
}

// Caixa (retângulo) ocupada pelo carro na tela, do tamanho visível do
// sprite. Usada para detectar colisão entre carros de vias diferentes.
function caixaCarro(carro) {
  const comp = comprimentoCarro(carro) * 0.85; // 15% de tolerância nas bordas
  const larg = larguraCarro(carro) * 0.85;
  const horizontal = ehHorizontal(carro.direcao);
  return {
    hx: (horizontal ? comp : larg) / 2,
    hy: (horizontal ? larg : comp) / 2
  };
}

function verificarColisoes() {
  if (jogoEncerrado) return;

  const ativos = carros.filter(c => c.ativo);
  ativos.forEach(c => { c.congestionado = false; });

  for (let i = 0; i < ativos.length; i++) {
    for (let j = i + 1; j < ativos.length; j++) {
      const a = ativos[i];
      const b = ativos[j];
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);

      if (a.via === b.via) {
        // Mesma via em fila → apenas marca como congestionado (sem colisão;
        // a fila já garante distância mínima entre os para-choques)
        if (Math.hypot(dx, dy) < distanciaMinimaEntre(a, b) * 1.4) {
          a.congestionado = true;
          b.congestionado = true;
        }
        continue;
      }

      // Vias diferentes: colisão real quando as caixas se sobrepõem
      const ca = caixaCarro(a), cb = caixaCarro(b);
      if (dx < ca.hx + cb.hx && dy < ca.hy + cb.hy) {
        dispararColisao(a, b);
        return;
      }
    }
  }

  // ── Verificar se alguma via tem 3+ carros congestionados simultaneamente ──
  const vias = [...new Set((ROTAS_MAPA[nivelAtual] || []).map(viaDaRota))];
  vias.forEach(via => {
    // Conta carros parados OU marcados como congestionados na mesma via
    const qtd = ativos.filter(c => (c.congestionado || c.parado) && c.via === via).length;
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

// Camada de frente do mapa (casas, árvores, cercas com fundo transparente).
// Desenhada por último para que pedestres e carros passem ATRÁS dos objetos.
let imgMapaFrente = null;

function carregarCamadaFrente(nivel) {
  const img = new Image();
  img.src = `assets/img/mapas/mapa${nivel}_frente.png`;
  imgMapaFrente = img;
}

function renderizar() {
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  atualizarHUD();

  if (DEBUG_ROTAS) desenharDebugRotas();

  desenharPedestres();
  desenharSemaforos();
  desenharCarros();
  desenharAtropelamentos();

  if (imgMapaFrente && imgMapaFrente.complete && imgMapaFrente.naturalWidth > 0) {
    ctx.drawImage(imgMapaFrente, 0, 0, gameCanvas.width, gameCanvas.height);
  }

  desenharExplosoes();
}

// ── Semáforos ────────────────────────────────
function desenharSemaforos() {
  const scaleX = gameCanvas.width  / BASE_W;
  const scaleY = gameCanvas.height / BASE_H;
  const scale  = Math.min(scaleX, scaleY) * escalaSemaforoAtual;
  // Com mais de um cruzamento, mostra o número (tecla de atalho) no rótulo
  const variosCruzamentos = listaCruzamentos().length > 1;

  semaforos.forEach(sem => {
    const cx = sem.x * scaleX;
    const cy = sem.y * scaleY;
    const extra = variosCruzamentos ? ' ' + cruzamentoDo(sem) : '';
    desenharSemaforo(ctx, cx, cy, scale, sem.estado, direcaoDoSemaforo(sem), extra);
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

function desenharSemaforo(ctx, cx, cy, scale, estado, label, extra = '') {
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
  ctx.fillText((setas[label] || label) + extra, cx, cy + H/2 + posteH + 2*scale);
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

  // Pontos de parada dos semáforos e caixas de colisão dos carros
  semaforos.forEach(sem => {
    ctx.fillStyle = sem.estado === 'red' ? '#ff0000' : '#00ff00';
    ctx.beginPath();
    ctx.arc((sem.stopX ?? sem.x) * scaleX, (sem.stopY ?? sem.y) * scaleY, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = '#ff00ff';
  ctx.lineWidth = 1;
  carros.forEach(c => {
    const cx = caixaCarro(c);
    ctx.strokeRect(c.x - cx.hx, c.y - cx.hy, cx.hx * 2, cx.hy * 2);
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
    if (gameCanvas._pedSpawnTimer) {
      clearInterval(gameCanvas._pedSpawnTimer);
      gameCanvas._pedSpawnTimer = null;
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
  const rapido = tempoRestante >= tempoTotalFase - 120;
  const pontosGanhos = rapido ? 25 : 15;
  pontos += pontosGanhos;

  // Só oferece a próxima fase se ela já tiver rotas configuradas
  const proximaFase = ROTAS_MAPA[nivelAtual + 1] ? nivelAtual + 1 : null;

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