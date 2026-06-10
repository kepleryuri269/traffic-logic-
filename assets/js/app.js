"use strict";

function showScreen(id) {
  const atual = document.querySelector(".screen.active");
  const proxima = document.getElementById(id);
  if (!proxima || atual === proxima) return;

  if (atual) {
    atual.classList.add("saindo");
    setTimeout(() => atual.classList.remove("active", "saindo"), 250);
  }

  proxima.classList.add("active", "entrando");
  setTimeout(() => proxima.classList.remove("entrando"), 250);

  history.replaceState(null, "", "#" + id);
}

function showSobre() { showScreen("screen-sobre"); }
function showMenu()  { showScreen("screen-menu");  }
function showFases() { showScreen("screen-fases"); }

function confirmarSairFase() {
  document.getElementById("modal-sair").style.display = "flex";
}

function fecharModal() {
  document.getElementById("modal-sair").style.display = "none";
}

function confirmarSaida() {
  fecharModal();
  sessionStorage.removeItem("nivelAtual");
  showFases();
}

// Fecha o modal se clicar fora da caixa
document.addEventListener("click", function(e) {
  const overlay = document.getElementById("modal-sair");
  if (e.target === overlay) fecharModal();
});

// Ao carregar a página, restaura a tela salva no hash (se houver)
(function restoreScreen() {
  const hash = location.hash.replace("#", "");
  const validScreens = ["screen-menu", "screen-fases", "screen-sobre", "screen-config", "screen-game"];
  if (hash && validScreens.includes(hash)) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const target = document.getElementById(hash);
    if (target) target.classList.add("active");

    // Se estava no jogo, restaura o nível salvo
    if (hash === "screen-game") {
      const nivelSalvo = sessionStorage.getItem("nivelAtual");
      if (nivelSalvo) {
        // game.js ainda não rodou iniciarJogo, mas já está carregado —
        // aguarda o DOM estar pronto e chama
        document.addEventListener("DOMContentLoaded", function() {
          iniciarJogo(Number(nivelSalvo), true);
        });
        // fallback caso DOMContentLoaded já tenha disparado
        if (document.readyState !== "loading") {
          iniciarJogo(Number(nivelSalvo), true);
        }
      } else {
        // Nível desconhecido, manda pro menu de fases
        showFases();
      }
    }
  }
})();

// ══════════════════════════════════════════════
//  CONFIGURAÇÕES
// ══════════════════════════════════════════════

// Carrega configs salvas
(function carregarConfigs() {
  const brilho = localStorage.getItem('cfg-brilho') ?? 100;
  const som    = localStorage.getItem('cfg-som')    ?? 100;

  document.getElementById('cfg-brilho').value = brilho;
  document.getElementById('cfg-som').value    = som;
  document.getElementById('val-brilho').textContent = brilho + '%';
  document.getElementById('val-som').textContent    = som + '%';
  aplicarBrilho(brilho);
  aplicarSom(som);

  if (localStorage.getItem('cfg-daltonismo') === '1')       ativarToggle('daltonismo',      'daltonismo');
  if (localStorage.getItem('cfg-alto-contraste') === '1')   ativarToggle('alto-contraste',  'alto-contraste');
  if (localStorage.getItem('cfg-texto-grande') === '1')     ativarToggle('texto-grande',    'texto-grande');
})();

function aplicarBrilho(val) {
  const overlay = document.getElementById('brilho-overlay');
  overlay.style.opacity = (1 - val / 100) * 0.82;
  document.getElementById('val-brilho').textContent = val + '%';
  localStorage.setItem('cfg-brilho', val);
}

function aplicarSom(val) {
  document.getElementById('val-som').textContent = val + '%';
  localStorage.setItem('cfg-som', val);
  // Expõe volume global para game.js usar
  window.cfgVolume = val / 100;
  if (window.crashAudio) window.crashAudio.volume = window.cfgVolume;
}

function ativarToggle(chave, classeBody) {
  const btn  = document.getElementById('toggle-' + chave);
  const pill = document.getElementById('pill-' + chave);
  if (!btn) return;
  btn.classList.add('ativo');
  document.body.classList.add(classeBody);
}

function desativarToggle(chave, classeBody) {
  const btn = document.getElementById('toggle-' + chave);
  if (!btn) return;
  btn.classList.remove('ativo');
  document.body.classList.remove(classeBody);
}

// Injeta o SVG com filtro de daltonismo (deuteranopia) uma única vez
(function injetarFiltroSVG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'svg-daltonismo-filtro';
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.innerHTML = `
    <defs>
      <filter id="filtro-daltonismo" color-interpolation-filters="linearRGB">
        <feColorMatrix type="matrix" values="
          0.367  0.861 -0.228  0  0
          0.280  0.673  0.047  0  0
         -0.012  0.043  0.969  0  0
          0      0      0      1  0
        "/>
      </filter>
    </defs>
  `;
  document.body.appendChild(svg);
})();

function toggleDaltonismo() {
  const ativo = document.getElementById('toggle-daltonismo').classList.contains('ativo');
  if (ativo) { desativarToggle('daltonismo', 'daltonismo'); localStorage.setItem('cfg-daltonismo', '0'); }
  else       { ativarToggle('daltonismo',    'daltonismo'); localStorage.setItem('cfg-daltonismo', '1'); }
}

function toggleAltoContraste() {
  const ativo = document.getElementById('toggle-alto-contraste').classList.contains('ativo');
  if (ativo) { desativarToggle('alto-contraste', 'alto-contraste');   localStorage.setItem('cfg-alto-contraste', '0'); }
  else       { ativarToggle('alto-contraste', 'alto-contraste');      localStorage.setItem('cfg-alto-contraste', '1'); }
}

function toggleTextoGrande() {
  const ativo = document.getElementById('toggle-texto-grande').classList.contains('ativo');
  if (ativo) { desativarToggle('texto-grande', 'texto-grande');       localStorage.setItem('cfg-texto-grande', '0'); }
  else       { ativarToggle('texto-grande', 'texto-grande');          localStorage.setItem('cfg-texto-grande', '1'); }
}

(function spawnParticles() {
  const container = document.getElementById("particles");
  if (!container) return;

  const colors = ["#e74c3c", "#f0a500", "#27ae60", "#5b6ef5"];

  for (let i = 0; i < 22; i++) {
    const p = document.createElement("span");
    p.className = "particle";

    const size  = Math.random() * 5 + 3;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const left  = Math.random() * 100;
    const delay = Math.random() * 10;
    const dur   = Math.random() * 8 + 7;

    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      box-shadow: 0 0 ${size * 2}px ${color};
      left: ${left}%;
      bottom: -20px;
      animation-duration: ${dur}s;
      animation-delay: ${delay}s;
    `;

    container.appendChild(p);
  }
})();