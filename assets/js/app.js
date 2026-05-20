"use strict";

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.toggle("active", s.id === id);
  });
}

function showSobre() { showScreen("screen-sobre"); }
function showMenu()  { showScreen("screen-menu");  }
function showFases() { showScreen("screen-fases"); }

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