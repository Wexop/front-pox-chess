import { GameColor, type Piece, PieceName, type PieceOnTray, type ThinkResponse } from "../core/type.ts"

// --- V7 Configuration ---
const MAX_SEARCH_TIME = 3000;
const MATE_SCORE = 100000;
const MATE_THRESHOLD = MATE_SCORE - 100;
const TABLE_SIZE = 1e7;

// --- V7 Piece Values & PSQTs ---
const PIECE_VALUE: Record<PieceName, number> = {
  [PieceName.pion]: 100, [PieceName.cavalier]: 320, [PieceName.fou]: 330, [PieceName.tour]: 500, [PieceName.queen]: 950, [PieceName.king]: 20000
};

const BISHOP_PAIR_BONUS = 50;
const KING_SAFETY_PENALTY_PER_ATTACKER = 25;

// NOUVEAU: Marge pour le Delta Pruning
const DELTA_PRUNING_MARGIN = 200; // (une tour vaut 500, un pion 100)

// PSQTs (identiques à V6)
const pawnEval = [[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]];
const knightEval = [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]];
const bishopEval = [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]];
const rookEval = [[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]];
const kingEval = [[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]];
const pieceSquareTables: Record<PieceName, number[][]> = {
  [PieceName.pion]: pawnEval, [PieceName.cavalier]: knightEval, [PieceName.fou]: bishopEval, [PieceName.tour]: rookEval,
  [PieceName.queen]: bishopEval.map(row => row.map(val => val * 3)), [PieceName.king]: kingEval
};

// --- V7 Interfaces ---
interface Move {
  fromX: number; fromY: number; toX: number; toY: number;
  piece: PieceName; capturedPiece?: PieceName; promotion?: PieceName;
  score: number; // Pour le tri
}
type TTFlag = 'EXACT' | 'LOWER' | 'UPPER';
interface TTEntry {
  depth: number; score: number; flag: TTFlag; bestMove?: Move;
}

// --- V7 Board Class (Identique à V6) ---
class Board {
  grid: (Piece | null)[][];
  turn: GameColor = GameColor.WHITE;
  history: { move: Move, captured: Piece | null }[] = [];
  kingPos: { [GameColor.WHITE]: { x: number, y: number }, [GameColor.BLACK]: { x: number, y: number } };

  constructor(pieces: PieceOnTray[]) {
    this.grid = Array(8).fill(null).map(() => Array(8).fill(null));
    this.kingPos = { [GameColor.WHITE]: { x: -1, y: -1 }, [GameColor.BLACK]: { x: -1, y: -1 } };
    for (const piece of pieces) {
      if (piece) {
        this.grid[piece.posY][piece.posX] = piece;
        if (piece.name === PieceName.king) {
          this.kingPos[piece.color] = { x: piece.posX, y: piece.posY };
        }
      }
    }
  }

  getPositionKey(): string {
    let key = this.turn === GameColor.WHITE ? 'w' : 'b';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const p = this.grid[y][x];
        if (p) { key += `${p.id}@${y}${x}`; }
      }
    }
    return key;
  }

  makeMove(move: Move): void {
    const piece = this.grid[move.fromY][move.fromX]!;
    const captured = this.grid[move.toY][move.toX];
    this.history.push({ move, captured });
    if (piece.name === PieceName.king) {
      this.kingPos[piece.color] = { x: move.toX, y: move.toY };
    }
    this.grid[move.toY][move.toX] = piece;
    this.grid[move.fromY][move.fromX] = null;
    if (move.promotion) {
      this.grid[move.toY][move.toX] = { ...piece, name: move.promotion };
    }
    this.turn = this.turn === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE;
  }

  unmakeMove(): void {
    const lastMove = this.history.pop();
    if (!lastMove) return;
    const { move, captured } = lastMove;
    this.turn = this.turn === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE;
    const pieceOnToSquare = this.grid[move.toY][move.toX]!;
    const originalPiece = { ...pieceOnToSquare, name: move.piece };
    if (originalPiece.name === PieceName.king) {
      this.kingPos[originalPiece.color] = { x: move.fromX, y: move.fromY };
    }
    this.grid[move.fromY][move.fromX] = originalPiece;
    this.grid[move.toY][move.toX] = captured;
  }
}

// --- PoxThinkV7 ---
export const PoxThinkV6 = (
  pieces: PieceOnTray[],
  maxDepth = 7,
  thinkForColor: 'white' | 'black' | 'both' = 'both'
): ThinkResponse => {

  const board = new Board(pieces);
  const transpositionTable = new Map<string, TTEntry>();
  const killerMoves: (Move | null)[][] = Array(maxDepth + 10).fill(null).map(() => [null, null]);
  let startTime = 0;
  let nodes = 0;
  let timeUp = false;

  const getPieceAt = (x: number, y: number) => board.grid[y]?.[x];

  // --- Fonctions de génération de coups et d'attaque (Identiques à V6) ---
  // (isSquareAttacked, isKingInCheck, getMovesForPiece, generateAllMoves)

  const isSquareAttacked = (x: number, y: number, attackerColor: GameColor): boolean => {
    // 1. Attaques de pions
    const pawnDir = attackerColor === GameColor.WHITE ? 1 : -1;
    if (getPieceAt(x - 1, y + pawnDir)?.name === PieceName.pion && getPieceAt(x - 1, y + pawnDir)?.color === attackerColor) return true;
    if (getPieceAt(x + 1, y + pawnDir)?.name === PieceName.pion && getPieceAt(x + 1, y + pawnDir)?.color === attackerColor) return true;
    // 2. Attaques de cavaliers
    const knightMoves = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
    for (const [dx, dy] of knightMoves) {
      if (getPieceAt(x + dx, y + dy)?.name === PieceName.cavalier && getPieceAt(x + dx, y + dy)?.color === attackerColor) return true;
    }
    // 3. Attaques en ligne (Tour, Reine)
    const lineDirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dx, dy] of lineDirs) {
      let curX = x + dx, curY = y + dy;
      while (curX >= 0 && curX <= 7 && curY >= 0 && curY <= 7) {
        const p = getPieceAt(curX, curY);
        if (p) {
          if (p.color === attackerColor && (p.name === PieceName.tour || p.name === PieceName.queen)) return true;
          break;
        }
        curX += dx; curY += dy;
      }
    }
    // 4. Attaques en diagonale (Fou, Reine)
    const diagDirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [dx, dy] of diagDirs) {
      let curX = x + dx, curY = y + dy;
      while (curX >= 0 && curX <= 7 && curY >= 0 && curY <= 7) {
        const p = getPieceAt(curX, curY);
        if (p) {
          if (p.color === attackerColor && (p.name === PieceName.fou || p.name === PieceName.queen)) return true;
          break;
        }
        curX += dx; curY += dy;
      }
    }
    // 5. Attaques de Roi
    const kingMoves = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [dx, dy] of kingMoves) {
      if (getPieceAt(x + dx, y + dy)?.name === PieceName.king && getPieceAt(x + dx, y + dy)?.color === attackerColor) return true;
    }
    return false;
  };
  const isKingInCheck = (color: GameColor): boolean => {
    const king = board.kingPos[color];
    if (king.x === -1) return false;
    return isSquareAttacked(king.x, king.y, color === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE);
  };
  const getMovesForPiece = (p: Piece, x: number, y: number): { toX: number, toY: number, promotion?: PieceName }[] => {
    const moves: { toX: number, toY: number, promotion?: PieceName }[] = [];
    const { name, color } = p;
    const add = (toX: number, toY: number) => {
      if (toX < 0 || toX > 7 || toY < 0 || toY > 7) return;
      const target = getPieceAt(toX, toY);
      if (!target || target.color !== color) moves.push({ toX, toY });
    };
    const addRay = (dirs: number[][]) => {
      for (const [dx, dy] of dirs) {
        let curX = x + dx, curY = y + dy;
        while (curX >= 0 && curX <= 7 && curY >= 0 && curY <= 7) {
          const target = getPieceAt(curX, curY);
          if (target) {
            if (target.color !== color) add(curX, curY);
            break;
          }
          add(curX, curY);
          curX += dx; curY += dy;
        }
      }
    };
    if (name === PieceName.pion) {
      const dir = color === GameColor.WHITE ? -1 : 1;
      const promotionRank = color === GameColor.WHITE ? 0 : 7;
      if (!getPieceAt(x, y + dir)) {
        if (y + dir === promotionRank) {
          [PieceName.queen, PieceName.tour, PieceName.fou, PieceName.cavalier].forEach(p => moves.push({ toX: x, toY: y + dir, promotion: p }));
        } else {
          moves.push({ toX: x, toY: y + dir });
        }
        if ((color === GameColor.WHITE ? 6 : 1) === y && !getPieceAt(x, y + 2 * dir)) {
          moves.push({ toX: x, toY: y + 2 * dir });
        }
      }
      for (const dx of [-1, 1]) {
        const target = getPieceAt(x + dx, y + dir);
        if (target && target.color !== color) {
          if (y + dir === promotionRank) {
            [PieceName.queen, PieceName.tour, PieceName.fou, PieceName.cavalier].forEach(p => moves.push({ toX: x + dx, toY: y + dir, promotion: p }));
          } else {
            moves.push({ toX: x + dx, toY: y + dir });
          }
        }
      }
    } else {
      const dirs = { [PieceName.cavalier]: [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]], [PieceName.king]: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]], [PieceName.fou]: [[1,1],[1,-1],[-1,1],[-1,-1]], [PieceName.tour]: [[1,0],[-1,0],[0,1],[-1,0]], [PieceName.queen]: [[1,0],[-1,0],[0,1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]] }[name];
      if ([PieceName.fou, PieceName.tour, PieceName.queen].includes(name)) addRay(dirs as number[][]); else for(const d of dirs) add(x+d[0], y+d[1]);
    }
    return moves;
  };
  const generateAllMoves = (color: GameColor, capturesOnly = false): Move[] => {
    const allMoves: Move[] = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const piece = getPieceAt(x, y);
        if (piece && piece.color === color) {
          for (const m of getMovesForPiece(piece, x, y)) {
            const captured = getPieceAt(m.toX, m.toY);
            if (capturesOnly && !captured) continue;
            let score = 0;
            if (captured) { score = 10000 + (PIECE_VALUE[captured.name] - PIECE_VALUE[piece.name]); } // MVV-LVA
            if (m.promotion) { score += 9000 + PIECE_VALUE[m.promotion]; }
            allMoves.push({ fromX: x, fromY: y, toX: m.toX, toY: m.toY, piece: piece.name, capturedPiece: captured?.name, promotion: m.promotion, score });
          }
        }
      }
    }
    return allMoves;
  };

  // --- Fonctions de tri et d'évaluation (Identiques à V6) ---
  const storeKillerMove = (move: Move, depth: number) => {
    if (depth >= killerMoves.length) return;
    if (killerMoves[depth][0]?.fromX !== move.fromX || killerMoves[depth][0]?.toX !== move.toX) {
      killerMoves[depth][1] = killerMoves[depth][0];
      killerMoves[depth][0] = move;
    }
  };
  const orderMoves = (moves: Move[], ttMove: Move | undefined, depth: number) => {
    const k1 = killerMoves[depth]?.[0];
    const k2 = killerMoves[depth]?.[1];
    for (const move of moves) {
      if (ttMove && move.fromX === ttMove.fromX && move.toX === ttMove.toX) {
        move.score = 2000000;
      } else if (move.capturedPiece) {
        move.score += 1000000;
      } else if (k1 && move.fromX === k1.fromX && move.toX === k1.toX) {
        move.score = 500000;
      } else if (k2 && move.fromX === k2.fromX && move.toX === k2.toX) {
        move.score = 400000;
      }
    }
    moves.sort((a, b) => b.score - a.score);
  };
  const evaluate = (): number => {
    let score = 0;
    let whiteBishops = 0, blackBishops = 0;
    let whiteKingAttackers = 0, blackKingAttackers = 0;
    const wk = board.kingPos[GameColor.WHITE];
    const bk = board.kingPos[GameColor.BLACK];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const p = getPieceAt(x, y);
        if (p) {
          const psqt = pieceSquareTables[p.name];
          const positionalScore = p.color === GameColor.WHITE ? psqt[y][x] : psqt[7 - y][x];
          const pieceScore = PIECE_VALUE[p.name] + positionalScore;
          if (p.color === GameColor.WHITE) {
            score += pieceScore;
            if (p.name === PieceName.fou) whiteBishops++;
            if (Math.abs(x - bk.x) <= 2 && Math.abs(y - bk.y) <= 2) { blackKingAttackers++; }
          } else {
            score -= pieceScore;
            if (p.name === PieceName.fou) blackBishops++;
            if (Math.abs(x - wk.x) <= 2 && Math.abs(y - wk.y) <= 2) { whiteKingAttackers++; }
          }
        }
      }
    }
    if (whiteBishops >= 2) score += BISHOP_PAIR_BONUS;
    if (blackBishops >= 2) score -= BISHOP_PAIR_BONUS;
    score -= whiteKingAttackers * KING_SAFETY_PENALTY_PER_ATTACKER;
    score += blackKingAttackers * KING_SAFETY_PENALTY_PER_ATTACKER;
    return board.turn === GameColor.WHITE ? score : -score;
  };

  // --- V7 Quiescence Search (CORRIGÉE) ---
  const quiescenceSearch = (alpha: number, beta: number): number => {
    nodes++;
    if (nodes % 2048 === 0 && Date.now() - startTime > MAX_SEARCH_TIME) {
      timeUp = true;
      return 0;
    }
    if (timeUp) return 0;

    const standPat = evaluate();
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;

    const moves = generateAllMoves(board.turn, true); // Captures uniquement
    moves.sort((a, b) => b.score - a.score); // Tri MVV-LVA

    for (const move of moves) {

      // ✨ NOUVEAU: Delta Pruning
      // Si le score actuel + la valeur de la pièce capturée + une marge
      // est toujours inférieur à alpha, ce coup ne l'améliorera jamais.
      if (move.capturedPiece) {
        const capturedValue = PIECE_VALUE[move.capturedPiece];
        if (standPat + capturedValue + DELTA_PRUNING_MARGIN < alpha) {
          continue; // Élagage
        }
      }

      board.makeMove(move);

      // ✅ CORRECTION DU BUG SUICIDE (V6)
      // Nous devons nous assurer que le coup de capture lui-même est légal !
      if (isKingInCheck(board.turn === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE)) {
        board.unmakeMove();
        continue; // Ce coup est illégal, on l'ignore
      }

      const score = -quiescenceSearch(-beta, -alpha);
      board.unmakeMove();

      if (timeUp) return 0;

      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };

  // --- V7 Negamax (Avec LMR) ---
  const negamax = (depth: number, alpha: number, beta: number): number => {
    nodes++;
    if (nodes % 2048 === 0 && Date.now() - startTime > MAX_SEARCH_TIME) {
      timeUp = true;
      return 0;
    }
    if (timeUp) return 0;

    const originalAlpha = alpha;
    const positionKey = board.getPositionKey();

    // Lecture TT (identique à V6)
    const ttEntry = transpositionTable.get(positionKey);
    if (ttEntry && ttEntry.depth >= depth) {
      if (ttEntry.score > MATE_THRESHOLD) ttEntry.score -= (maxDepth - depth);
      if (ttEntry.score < -MATE_THRESHOLD) ttEntry.score += (maxDepth - depth);
      if (ttEntry.flag === 'EXACT') return ttEntry.score;
      if (ttEntry.flag === 'LOWER' && ttEntry.score >= beta) return ttEntry.score;
      if (ttEntry.flag === 'UPPER' && ttEntry.score <= alpha) return ttEntry.score;
    }

    const inCheck = isKingInCheck(board.turn);
    if (inCheck) depth++; // Extension d'échec

    if (depth === 0) {
      return quiescenceSearch(alpha, beta);
    }

    const moves = generateAllMoves(board.turn);
    if (moves.length === 0) {
      return inCheck ? -MATE_SCORE + (maxDepth - depth) : 0; // Mat ou Pat
    }

    orderMoves(moves, ttEntry?.bestMove, depth);

    let bestMove: Move | undefined = undefined;
    let moveCount = 0;

    for (const move of moves) {
      board.makeMove(move);
      if (isKingInCheck(board.turn === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE)) {
        board.unmakeMove();
        continue;
      }
      moveCount++; // On a un coup légal

      let score;

      // ✨ NOUVEAU: Late Move Reduction (LMR)
      if (
        moveCount > 3 &&      // Pas sur les 3 premiers "meilleurs" coups
        depth >= 3 &&         // Pas à basse profondeur
        !inCheck &&           // Pas en échec
        !move.capturedPiece && // Pas une capture
        !move.promotion       // Pas une promotion
      ) {
        // Recherche réduite (ex: depth - 2)
        score = -negamax(depth - 2, -alpha - 1, -alpha);
      } else {
        // Recherche complète
        score = -negamax(depth - 1, -beta, -alpha);
      }

      // Si la recherche LMR (réduite) s'avère meilleure que alpha,
      // elle était peut-être prometteuse. On refait une recherche complète.
      if (score > alpha && moveCount > 3) {
        score = -negamax(depth - 1, -beta, -alpha);
      }

      board.unmakeMove();

      if (timeUp) return 0;

      if (score > alpha) {
        alpha = score;
        bestMove = move;
        if (alpha >= beta) {
          if (!move.capturedPiece) {
            storeKillerMove(move, depth);
          }
          break; // Coupure Bêta
        }
      }
    }

    // Écriture TT (identique à V6)
    if (!timeUp) {
      let flag: TTFlag = 'UPPER';
      if (alpha > originalAlpha) { flag = 'EXACT'; }
      if (alpha >= beta) { flag = 'LOWER'; }

      let ttScore = alpha;
      if (ttScore > MATE_THRESHOLD) ttScore += (maxDepth - depth);
      if (ttScore < -MATE_THRESHOLD) ttScore -= (maxDepth - depth);

      transpositionTable.set(positionKey, { depth, score: ttScore, flag, bestMove });

      if (transpositionTable.size > TABLE_SIZE) {
        transpositionTable.delete(transpositionTable.keys().next().value);
      }
    }

    return alpha;
  };

  // --- Fonction principale `thinkFor` (logique V6) ---
  const thinkFor = (color: GameColor): ThinkResponse['white'] => {
    startTime = Date.now();
    nodes = 0;
    timeUp = false;
    board.turn = color;

    let bestMove: Move | null = null;
    let bestScore = -Infinity;

    // Iterative Deepening
    for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
      for (let i = 0; i < killerMoves.length; i++) {
        killerMoves[i] = [null, null];
      }

      const moves = generateAllMoves(color);
      const ttMove = transpositionTable.get(board.getPositionKey())?.bestMove;
      orderMoves(moves, ttMove, currentDepth);

      let currentBestMoveForDepth: Move | undefined = undefined;
      let alpha = -Infinity, beta = Infinity;

      for (const move of moves) {
        board.makeMove(move);
        if (isKingInCheck(color)) {
          board.unmakeMove();
          continue;
        }
        const score = -negamax(currentDepth - 1, -beta, -alpha);
        board.unmakeMove();
        if (timeUp) break;
        if (score > alpha) {
          alpha = score;
          currentBestMoveForDepth = move;
        }
      }

      if (timeUp) {
        console.log(`PoxThinkV7: Time limit reached at depth ${currentDepth}. Nodes: ${nodes}`);
        break;
      }

      if (currentBestMoveForDepth) {
        bestMove = currentBestMoveForDepth;
        bestScore = alpha;
        console.log(`PoxThinkV7: Depth ${currentDepth} complete. Best move: ${bestMove.fromX},${bestMove.fromY} -> ${bestMove.toX},${bestMove.toY}. Score: ${bestScore}. Nodes: ${nodes}`);
      }

      if (bestScore > MATE_THRESHOLD) {
        console.log(`PoxThinkV7: Mate found at depth ${currentDepth}.`);
        break;
      }
    }

    if (!bestMove) {
      const moves = generateAllMoves(color);
      if (moves.length === 0) return undefined;
      // Tenter de trouver le premier coup légal
      for(const move of moves) {
        board.makeMove(move);
        if (!isKingInCheck(color)) {
          board.unmakeMove();
          bestMove = move;
          break;
        }
        board.unmakeMove();
      }
      if (!bestMove) return undefined; // Aucun coup légal
    }

    // Trouver l'index (logique V6)
    const piece = pieces.find(p => p.posX === bestMove!.fromX && p.posY === bestMove!.fromY);
    const index = piece ? pieces.indexOf(piece) : -1;
    if (index === -1) {
      const altIndex = pieces.findIndex(p => p.posX === bestMove!.fromX && p.posY === bestMove!.fromY);
      return { index: altIndex, oldPosition: `x${bestMove!.fromX}y${bestMove!.fromY}`, posX: bestMove!.toX, posY: bestMove!.toY, position: `x${bestMove!.toX}y${bestMove!.toY}` };
    }

    return { index: index, oldPosition: `x${bestMove.fromX}y${bestMove.fromY}`, posX: bestMove.toX, posY: bestMove.toY, position: `x${bestMove.toX}y${bestMove.toY}` };
  };

  // --- Exécution ---
  transpositionTable.clear();
  const response: ThinkResponse = {};
  if (thinkForColor === 'white' || thinkForColor === 'both') response.white = thinkFor(GameColor.WHITE);
  if (thinkForColor === 'black' || thinkForColor === 'both') response.black = thinkFor(GameColor.BLACK);
  return response;
};
