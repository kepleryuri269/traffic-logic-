"use strict";

function iniciarJogo(nivel) {
  showScreen('screen-game');

  const mapas = {
    1: 'assets/img/mapas/mapa1.png',
    2: 'assets/img/mapas/mapa2.png',
    3: 'assets/img/mapas/mapa3.png'
  };

  const screen = document.getElementById('screen-game');
  screen.style.backgroundImage = `url('${mapas[nivel]}')`;
  screen.style.backgroundSize = 'cover';
  screen.style.backgroundPosition = 'center';
}