import { GameColor, type Movement, PieceName, type PieceOnTray, type ThinkResponse } from "../core/type.ts"

// --- CONFIGURATION ---
const MAX_SEARCH_TIME = 2500; // milliseconds
const BEAM_WIDTH = 5; // Number of best moves to explore at each node
const CHECK_EXTENSION_DEPTH = 1; // How many extra plies to search when in check

// --- PIECE VALUES & EVALUATION TABLES ---
const PIECE_VALUE: Record<PieceName, number> = {
  pion: 100,
  cavalier: 320,
  fou: 330,
  tour: 500,
  queen: 900,
  king: 20000
}

const pawnEvalWhite = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5,  5, 10, 25, 25, 10,  5,  5],
    [0,  0,  0, 20, 20,  0,  0,  0],
    [5, -5,-10,  0,  0,-10, -5,  5],
    [5, 10, 10,-20,-20, 10, 10,  5],
    [0,  0,  0,  0,  0,  0,  0,  0]
];
const pawnEvalBlack = pawnEvalWhite.slice().reverse();

const knightEval = [
    [-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,  0,  5,  5,  0,-20,-40],[-30,  5, 10, 15, 15, 10,  5,-30],[-30,  0, 15, 20, 20, 15,  0,-30],[-30,  5, 15, 20, 20, 15,  5,-30],[-30,  0, 10, 15, 15, 10,  0,-30],[-40,-20,  0,  0,  0,  0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]
];

const bishopEvalWhite = [
    [-20,-10,-10,-10,-10,-10,-10,-20],[-10,  5,  0,  0,  0,  0,  5,-10],[-10, 10, 10, 10, 10, 10, 10,-10],[-10,  0, 10, 10, 10, 10,  0,-10],[-10,  5,  5, 10, 10,  5,  5,-10],[-10,  0,  5, 10, 10,  5,  0,-10],[-10,  0,  0,  0,  0,  0,  0,-10],[-20,-10,-10,-10,-10,-10,-10,-20]
];
const bishopEvalBlack = bishopEvalWhite.slice().reverse();

const rookEvalWhite = [
    [0,  0,  0,  5,  5,  0,  0,  0],[-5,  0,  0,  0,  0,  0,  0, -5],[-5,  0,  0,  0,  0,  0,  0, -5],[-5,  0,  0,  0,  0,  0,  0, -5],[-5,  0,  0,  0,  0,  0,  0, -5],[-5,  0,  0,  0,  0,  0,  0, -5],[5, 10, 10, 10, 10, 10, 10,  5],[0,  0,  0,  0,  0,  0,  0,  0]
];
const rookEvalBlack = rookEvalWhite.slice().reverse();

const kingEvalWhite = [
    [20, 30, 10,  0,  0, 10, 30, 20],[20, 20,  0,  0,  0,  0, 20, 20],[-10,-20,-20,-20,-20,-20,-20,-10],[-20,-30,-30,-40,-40,-30,-30,-20],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30]
];
const kingEvalBlack = kingEvalWhite.slice().reverse();

// --- CORE LOGIC ---
const inside = (x: number, y: number) => x >= 0 && x < 8 && y >= 0 && y < 8;
const opposite = (color: GameColor) => color === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE;

// Transposition Table to store evaluated positions
const transpositionTable = new Map<string, { score: number, depth: number }>();

const generatePositionKey = (pieces: PieceOnTray[]): string => {
    return pieces.map(p => `${p.id}@${p.position}`).sort().join(',');
};

const applyMove = (pieces: PieceOnTray[], move: { fromIndex: number, toX: number, toY: number }): PieceOnTray[] => {
    const newPieces = pieces.map(p => ({ ...p }));
    const pieceToMove = { ...newPieces[move.fromIndex] };

    // Efficiently remove the captured piece
    const targetIndex = newPieces.findIndex(p => p.posX === move.toX && p.posY === move.toY);
    if (targetIndex !== -1) {
        newPieces.splice(targetIndex, 1);
    }
    
    pieceToMove.posX = move.toX;
    pieceToMove.posY = move.toY;
    pieceToMove.position = `x${move.toX}y${move.toY}`;
    newPieces[move.fromIndex] = pieceToMove;

    return newPieces;
};

const ray = (pieces: PieceOnTray[], color: GameColor, posX: number, posY: number, directions: [number, number][]) => {
  const moves: { posX: number; posY: number }[] = []
  for (const [dx, dy] of directions) {
    let x = posX + dx
    let y = posY + dy
    while (inside(x, y)) {
      if (!canMoveOnCase(pieces, color, x, y)) break
      moves.push({ posX: x, posY: y })
      if (pieces.find(p => p.posX === x && p.posY === y)) break
      x += dx
      y += dy
    }
  }
  return moves
}

export const canMoveOnCase = (pieces: PieceOnTray[], color: GameColor, posX: number, posY: number) => {
  if (!inside(posX, posY)) return false
  if (pieces.find(p => p.color === color && p.posX === posX && p.posY === posY)) return false
  return true
}

export const getPieceMovement = (piece: PieceName, color: GameColor, pieces: PieceOnTray[], posX: number, posY: number): Movement[] => {
  let moves: { posX: number; posY: number }[] = []

  switch (piece) {
    case PieceName.king:
      moves = [
        [1,0],[-1,0],[0,1],[0,-1],
        [1,1],[1,-1],[-1,1],[-1,-1]
      ].map(([dx, dy]) => ({ posX: posX + dx, posY: posY + dy }))
      break

    case PieceName.queen:
      moves = ray(pieces, color, posX, posY, [
        [1,0],[-1,0],[0,1],[0,-1],
        [1,1],[1,-1],[-1,1],[-1,-1]
      ])
      break

    case PieceName.tour:
      moves = ray(pieces, color, posX, posY, [
        [1,0],[-1,0],[0,1],[0,-1]
      ])
      break

    case PieceName.fou:
      moves = ray(pieces, color, posX, posY, [
        [1,1],[1,-1],[-1,1],[-1,-1]
      ])
      break

    case PieceName.cavalier:
      moves = [
        [1,2],[2,1],[-1,2],[-2,1],
        [1,-2],[2,-1],[-1,-2],[-2,-1]
      ].map(([dx, dy]) => ({ posX: posX + dx, posY: posY + dy }))
      break

    case PieceName.pion: {
      const dir = color === GameColor.WHITE ? -1 : 1
      if (inside(posX, posY + dir) && !pieces.find(p => p.posX === posX && p.posY === posY + dir)) {
        moves.push({ posX, posY: posY + dir })
      }
      const start = color === GameColor.WHITE ? 6 : 1
      if (posY === start && !pieces.find(p => p.posX === posX && p.posY === posY + dir) &&
        !pieces.find(p => p.posX === posX && p.posY === posY + 2*dir)) {
        moves.push({ posX, posY: posY + 2*dir })
      }
      for (const dx of [-1,1]) {
        const target = pieces.find(p => p.posX === posX + dx && p.posY === posY + dir && p.color !== color)
        if (target) moves.push({ posX: posX + dx, posY: posY + dir })
      }
      break
    }
  }

  return moves
    .filter(m => canMoveOnCase(pieces, color, m.posX, m.posY))
    .map(m => ({ position: `x${m.posX}y${m.posY}`, ...m }))
}

const getAllMovesForColor = (pieces: PieceOnTray[], color: GameColor) => {
    const moves: { fromIndex: number; toX: number; toY: number, score: number }[] = [];
    for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        if (p.color !== color) continue;

        const movement = getPieceMovement(p.name, color, pieces, p.posX, p.posY);
        for (const m of movement) {
            const targetPiece = pieces.find(target => target.posX === m.posX && target.posY === m.posY);
            let score = 0;
            if (targetPiece) {
                score = 10 * PIECE_VALUE[targetPiece.name] - PIECE_VALUE[p.name];
            }
            moves.push({ fromIndex: i, toX: m.posX, toY: m.posY, score });
        }
    }
    return moves.sort((a, b) => b.score - a.score);
};

const isKingInCheck = (pieces: PieceOnTray[], color: GameColor) => {
    const king = pieces.find(p => p.name === PieceName.king && p.color === color);
    if (!king) return true;
    const enemyColor = opposite(color);
    const enemyMoves = getAllMovesForColor(pieces, enemyColor);
    for (const m of enemyMoves) {
        if (m.toX === king.posX && m.toY === king.posY) return true;
    }
    return false;
};

const getTrayScoreV4 = (pieces: PieceOnTray[], color: GameColor) => {
    let score = 0;
    let myKing: PieceOnTray | undefined;

    for (const p of pieces) {
        const value = PIECE_VALUE[p.name] + (p.color === GameColor.WHITE ? pawnEvalWhite[p.posY][p.posX] : pawnEvalBlack[p.posY][p.posX]);
        score += p.color === color ? value : -value;
        if (p.name === PieceName.king && p.color === color) {
            myKing = p;
        }
    }

    // King safety evaluation
    if (myKing) {
        const enemyMoves = getAllMovesForColor(pieces, opposite(color));
        let attackers = 0;
        for (const move of enemyMoves) {
            const dx = Math.abs(myKing.posX - move.toX);
            const dy = Math.abs(myKing.posY - move.toY);
            if (dx <= 2 && dy <= 2) { // If move is near the king
                attackers++;
            }
        }
        score -= attackers * 10; // Penalty for each enemy piece near the king
    }

    return score;
};

const minimaxV4 = (pieces: PieceOnTray[], depth: number, alpha: number, beta: number, currentColor: GameColor, maximizingColor: GameColor, startTime: number): number => {
    if (Date.now() - startTime > MAX_SEARCH_TIME) {
        return 0; // Time's up
    }

    const positionKey = generatePositionKey(pieces);
    const cached = transpositionTable.get(positionKey);
    if (cached && cached.depth >= depth) {
        return cached.score;
    }

    let currentDepth = depth;
    if (isKingInCheck(pieces, currentColor)) {
        currentDepth += CHECK_EXTENSION_DEPTH;
    }

    if (currentDepth <= 0) {
        return getTrayScoreV4(pieces, maximizingColor);
    }

    const moves = getAllMovesForColor(pieces, currentColor);
    if (moves.length === 0) {
        if (isKingInCheck(pieces, currentColor)) return -99999 - depth; // Checkmate
        return 0; // Stalemate
    }

    const movesToSearch = moves.slice(0, BEAM_WIDTH);

    if (currentColor === maximizingColor) {
        let best = -Infinity;
        for (const m of movesToSearch) {
            const newPieces = applyMove(pieces, m);
            if (isKingInCheck(newPieces, maximizingColor)) continue;
            const val = minimaxV4(newPieces, currentDepth - 1, alpha, beta, opposite(currentColor), maximizingColor, startTime);
            best = Math.max(best, val);
            alpha = Math.max(alpha, val);
            if (beta <= alpha) break;
        }
        transpositionTable.set(positionKey, { score: best, depth });
        return best;
    } else {
        let best = Infinity;
        for (const m of movesToSearch) {
            const newPieces = applyMove(pieces, m);
            if (isKingInCheck(newPieces, currentColor)) continue;
            const val = minimaxV4(newPieces, currentDepth - 1, alpha, beta, opposite(currentColor), maximizingColor, startTime);
            best = Math.min(best, val);
            beta = Math.min(beta, val);
            if (beta <= alpha) break;
        }
        transpositionTable.set(positionKey, { score: best, depth });
        return best;
    }
};

export const PoxThinkV4 = (pieces: PieceOnTray[], maxDepth = 5): ThinkResponse => {
    const thinkFor = (color: GameColor) => {
        const startTime = Date.now();
        let bestMove: any = null;
        let bestScore = -Infinity;

        const moves = getAllMovesForColor(pieces, color);
        if(moves.length === 0) return {}; // No moves available

        // Iterative Deepening
        for (let depth = 1; depth <= maxDepth; depth++) {
            let currentBestMoveForDepth: any = null;
            let currentBestScoreForDepth = -Infinity;

            for (const m of moves) {
                const newPieces = applyMove(pieces, m);
                if (isKingInCheck(newPieces, color)) continue;

                const score = minimaxV4(newPieces, depth - 1, -Infinity, Infinity, opposite(color), color, startTime);
                
                if (score > currentBestScoreForDepth) {
                    currentBestScoreForDepth = score;
                    currentBestMoveForDepth = m;
                }
            }

            if (Date.now() - startTime > MAX_SEARCH_TIME) {
                console.log(`Time limit reached at depth ${depth}`);
                break; // Exit iterative deepening loop
            }
            
            // If search for this depth completed, update the overall best move
            bestMove = currentBestMoveForDepth;
            bestScore = currentBestScoreForDepth;
        }
        
        if (!bestMove) bestMove = moves[0]; // Failsafe

        const p = pieces[bestMove.fromIndex];
        return {
            index: bestMove.fromIndex,
            oldPosition: `x${p.posX}y${p.posY}`,
            posX: bestMove.toX,
            posY: bestMove.toY,
            position: `x${bestMove.toX}y${bestMove.toY}`
        };
    };

    transpositionTable.clear(); // Clear cache for each new top-level call
    return {
        white: thinkFor(GameColor.WHITE),
        black: thinkFor(GameColor.BLACK)
    };
};
