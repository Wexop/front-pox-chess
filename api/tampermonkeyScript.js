// ==UserScript==
// @name         Chess.com AutoFEN from HTML to Server
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Récupère le FEN depuis le plateau et envoie au serveur dès qu'il change
// @match        https://www.chess.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
  'use strict';
  const LOG = (...a) => console.info('[AutoFEN]', ...a);
  const WARN = (...a) => console.warn('[AutoFEN]', ...a);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const pieceMap = {
    'wp': 'P', 'wn': 'N', 'wb': 'B', 'wr': 'R', 'wq': 'Q', 'wk': 'K',
    'bp': 'p', 'bn': 'n', 'bb': 'b', 'br': 'r', 'bq': 'q', 'bk': 'k'
  };

  let lastFen = '';

  function getFenFromBoard() {
    // initialiser 8x8 vide
    const board = Array.from({length: 8}, () => Array(8).fill(''));

    // récupérer toutes les pièces
    const pieces = document.querySelectorAll('wc-chess-board .piece');

    pieces.forEach(p => {
      const classes = p.className.split(' ');
      const pieceCls = classes.find(c => pieceMap[c]);
      const squareCls = classes.find(c => c.startsWith('square-'));
      if (!pieceCls || !squareCls) return;

      const sqNum = squareCls.split('-')[1]; // ex: "65"
      const col = parseInt(sqNum[0], 10) - 1; // 1-indexed → 0-indexed
      const row = parseInt(sqNum[1], 10) - 1; // 1-indexed → 0-indexed depuis le bas

      // rowIndex = 7 - row si on veut que FEN commence du top
      const rowIndex = 7 - row;

      board[rowIndex][col] = pieceMap[pieceCls];
    });

    // construire FEN
    const fenRows = board.map(r => {
      let str = '';
      let empty = 0;
      r.forEach(c => {
        if (!c) empty++;
        else {
          if (empty) { str += empty; empty = 0; }
          str += c;
        }
      });
      if (empty) str += empty;
      return str;
    });
    const fen = fenRows.join('/') + ' w - - 0 1';
    return fen;
  }

  async function sendFen(fen) {
    try {
      await fetch('http://localhost:4000/fen', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({fen})
      });
      LOG('FEN envoyé:', fen);
    } catch(e) { WARN('Erreur fetch FEN', e); }
  }

  async function loop() {
    while(true) {
      try {
        const fen = getFenFromBoard();
        if (fen && fen !== lastFen) {
          lastFen = fen;
          sendFen(fen);
        }
      } catch(e) {
        WARN('Erreur loop', e);
      }
      await sleep(500); // vérifie toutes les 0.5s
    }
  }

  loop();
})();
