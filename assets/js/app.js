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
  const validScreens = ["screen-menu", "screen-fases", "screen-sobre", "screen-game"];
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
