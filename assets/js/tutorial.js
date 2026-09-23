"use strict";

// ══════════════════════════════════════════════
//  TUTORIAL — Traffic Logic
// ══════════════════════════════════════════════

function totalPassosTutorial() {
  const slides = document.querySelectorAll("#screen-tutorial .t-slide");
  return slides.length || 1;
}
let tutorialPasso = 0;
let tutorialOrigem = null;   // 'menu' | 'fase'
let tutorialNivelPendente = null;

// Abre o tutorial. Se vier de um card de fase, guarda o nível para
// iniciar o jogo automaticamente ao final do tutorial.
function abrirTutorial(origem = "menu", nivelPendente = null) {
  tutorialPasso = 0;
  tutorialOrigem = origem;
  tutorialNivelPendente = nivelPendente;

  atualizarPassoTutorial();
  showScreen("screen-tutorial");
}

// Chamada pelo card da Fase 1: pergunta antes de decidir entre
// mostrar o tutorial ou ir direto pro jogo.
let tutorialNivelEmPergunta = null;

function perguntarTutorial(nivel) {
  tutorialNivelEmPergunta = nivel;
  document.getElementById("modal-tutorial").style.display = "flex";
}

function fecharModalTutorial() {
  document.getElementById("modal-tutorial").style.display = "none";
}

function aceitarTutorial() {
  const nivel = tutorialNivelEmPergunta;
  fecharModalTutorial();
  abrirTutorial("fase", nivel);
}

function recusarTutorial() {
  const nivel = tutorialNivelEmPergunta;
  fecharModalTutorial();
  iniciarJogo(nivel);
}

function tutorialNext() {
  if (tutorialPasso >= totalPassosTutorial() - 1) {
    finalizarTutorial();
    return;
  }
  tutorialPasso++;
  atualizarPassoTutorial();
}

function tutorialPrev() {
  if (tutorialPasso <= 0) return;
  tutorialPasso--;
  atualizarPassoTutorial();
}

function pularTutorial() {
  finalizarTutorial();
}

function finalizarTutorial() {
  if (tutorialOrigem === "fase" && tutorialNivelPendente) {
    const nivel = tutorialNivelPendente;
    tutorialNivelPendente = null;
    iniciarJogo(nivel);
  } else {
    showScreen("screen-menu");
  }
}

function atualizarPassoTutorial() {
  // Slides
  document.querySelectorAll(".t-slide").forEach(el => {
    el.classList.toggle("active", Number(el.dataset.step) === tutorialPasso);
  });

  // Dots
  document.querySelectorAll(".t-dot").forEach(el => {
    const step = Number(el.dataset.step);
    el.classList.toggle("active", step === tutorialPasso);
    el.classList.toggle("done", step < tutorialPasso);
  });

  // Botões de navegação
  const btnPrev = document.getElementById("t-btn-prev");
  const btnNext = document.getElementById("t-btn-next");
  if (btnPrev) btnPrev.classList.toggle("hidden", tutorialPasso === 0);
  if (btnNext) {
    const ultimo = tutorialPasso === totalPassosTutorial() - 1;
    btnNext.textContent = ultimo
      ? (tutorialOrigem === "fase" ? "COMEÇAR A JOGAR →" : "ENTENDI ✓")
      : "PRÓXIMO ›";
  }
}