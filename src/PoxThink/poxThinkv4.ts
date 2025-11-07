import { GameColor, type Movement, PieceName, type PieceOnTray, type ThinkResponse } from "../core/type.ts"

// --- CONFIGURATION ---
const MAX_SEARCH_TIME = 2500; // milliseconds
const BEAM_WIDTH = 7;
const CHECK_EXTENSION_DEPTH = 1;

// --- PIECE VALUES & EVALUATION TABLES ---
const PIECE_VALUE: Record<PieceName, number> = {
  pion: 100,
  cavalier: 320,
  fou: 330,
  tour: 500,
  queen: 900,
  king: 20000
}

const ATTACK_VALUE: Record<PieceName, number> = {
    pion: 1,
    cavalier: 2,
    fou: 2,
    tour: 4,
    queen: 8,
    king: 0
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

// --- CORE LOGIC ---
const inside = (x: number, y: number) => x >= 0 && x < 8 && y >= 0 && y < 8;
const opposite = (color: GameColor) => color === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE;

const transpositionTable = new Map<string, { score: number, depth: number }>();

const generatePositionKey = (pieces: PieceOnTray[]): string => {
    return pieces.map(p => `${p.id}@${p.position}`).sort().join(',');
};

const applyMove = (pieces: PieceOnTray[], move: { fromIndex: number, toX: number, toY: number }): PieceOnTray[] => {
    const newPieces = pieces.map(p => ({ ...p }));
    const pieceToMove = { ...newPieces[move.fromIndex] };

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

// V4 REVISED: MVV-LVA move ordering
const getAllMovesForColor = (pieces: PieceOnTray[], color: GameColor, capturesOnly = false) => {
    const moves: { fromIndex: number; toX: number; toY: number, score: number }[] = [];
    for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        if (p.color !== color) continue;

        const movement = getPieceMovement(p.name, color, pieces, p.posX, p.posY);
        for (const m of movement) {
            const targetPiece = pieces.find(target => target.posX === m.posX && target.posY === m.posY);
            if (capturesOnly && !targetPiece) continue;

            let score = 0;
            if (targetPiece) {
                // MVV-LVA: Most Valuable Victim - Least Valuable Attacker
                score = PIECE_VALUE[targetPiece.name] - PIECE_VALUE[p.name] + 1000;
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
    const enemyPieces = pieces.filter(p => p.color === enemyColor);

    for (const p of enemyPieces) {
        const moves = getPieceMovement(p.name, p.color, pieces, p.posX, p.posY);
        if (moves.some(m => m.posX === king.posX && m.posY === king.posY)) return true;
    }
    return false;
};

// V4 REVISED: Evaluation with King Safety and Pawn Shield
const getTrayScoreV4 = (pieces: PieceOnTray[], color: GameColor) => {
    let score = 0;
    const myKing = pieces.find(p => p.name === PieceName.king && p.color === color);
    const opponentKing = pieces.find(p => p.name === PieceName.king && p.color === opposite(color));

    if (!myKing) return -99999;
    if (!opponentKing) return 99999;

    // Material and positional score
    for (const p of pieces) {
        const value = PIECE_VALUE[p.name] + (p.color === GameColor.WHITE ? pawnEvalWhite[p.posY][p.posX] : pawnEvalBlack[p.posY][p.posX]);
        score += p.color === color ? value : -value;
    }

    // King safety evaluation
    let myKingThreats = 0;
    const enemyPieces = pieces.filter(p => p.color === opposite(color));
    
    for (const enemy of enemyPieces) {
        const moves = getPieceMovement(enemy.name, enemy.color, pieces, enemy.posX, enemy.posY);
        for (const move of moves) {
            const dx = Math.abs(myKing.posX - move.posX);
            const dy = Math.abs(myKing.posY - move.posY);
            if (dx <= 1 && dy <= 1) {
                myKingThreats += ATTACK_VALUE[enemy.name];
            }
        }
    }
    score -= myKingThreats * myKingThreats * 10;

    // Pawn shield evaluation
    const myPawns = pieces.filter(p => p.name === PieceName.pion && p.color === color);
    let pawnShieldScore = 0;
    const kingRank = myKing.posY;
    const kingFile = myKing.posX;
    const pawnShieldRanks = color === GameColor.WHITE ? [kingRank - 1, kingRank - 2] : [kingRank + 1, kingRank + 2];
    
    for (const pawn of myPawns) {
        if (pawnShieldRanks.includes(pawn.posY) && Math.abs(pawn.posX - kingFile) <= 1) {
            pawnShieldScore += 10;
        }
    }
    score += pawnShieldScore;

    return score;
};

// V4 REVISED: Quiescence Search with SEE-lite
const quiescenceSearch = (pieces: PieceOnTray[], alpha: number, beta: number, currentColor: GameColor, maximizingColor: GameColor, startTime: number): number => {
    if (Date.now() - startTime > MAX_SEARCH_TIME) return 0;

    const standPat = getTrayScoreV4(pieces, maximizingColor);
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;

    const moves = getAllMovesForColor(pieces, currentColor, true); // Captures only

    for (const m of moves) {
        const newPieces = applyMove(pieces, m);
        if (isKingInCheck(newPieces, currentColor)) continue;

        // SEE-lite: Check for immediate recapture
        const recaptures = getAllMovesForColor(newPieces, opposite(currentColor), true);
        let isBadExchange = false;
        for (const recap of recaptures) {
            if (recap.toX === m.toX && recap.toY === m.toY) {
                const recapturedValue = PIECE_VALUE[pieces[m.fromIndex].name];
                if (recapturedValue > PIECE_VALUE[pieces.find(p=>p.posX === m.toX && p.posY === m.toY)!.name]) {
                    isBadExchange = true;
                    break;
                }
            }
        }
        if (isBadExchange) continue; // Skip this greedy move

        const score = -quiescenceSearch(newPieces, -beta, -alpha, opposite(currentColor), maximizingColor, startTime);
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

const minimaxV4 = (pieces: PieceOnTray[], depth: number, alpha: number, beta: number, currentColor: GameColor, maximizingColor: GameColor, startTime: number): number => {
    if (Date.now() - startTime > MAX_SEARCH_TIME) return 0;

    const positionKey = generatePositionKey(pieces);
    const cached = transpositionTable.get(positionKey);
    if (cached && cached.depth >= depth) {
        return cached.score;
    }

    if (depth === 0) {
        return quiescenceSearch(pieces, alpha, beta, currentColor, maximizingColor, startTime);
    }

    let currentDepth = depth;
    if (isKingInCheck(pieces, currentColor)) {
        currentDepth += CHECK_EXTENSION_DEPTH;
    }

    const moves = getAllMovesForColor(pieces, currentColor);
    if (moves.length === 0) {
        if (isKingInCheck(pieces, currentColor)) return -99999 - depth;
        return 0;
    }

    const movesToSearch = moves.slice(0, BEAM_WIDTH);

    let best = -Infinity;
    for (const m of movesToSearch) {
        const newPieces = applyMove(pieces, m);
        if (isKingInCheck(newPieces, currentColor)) continue;
        const val = -minimaxV4(newPieces, currentDepth - 1, -beta, -alpha, opposite(currentColor), maximizingColor, startTime);
        if (val > best) best = val;
        if (best > alpha) alpha = best;
        if (alpha >= beta) break;
    }

    transpositionTable.set(positionKey, { score: best, depth });
    return best;
};

export const PoxThinkV4 = (pieces: PieceOnTray[], maxDepth = 7, thinkForColor: 'white' | 'black' | 'both' = 'both'): ThinkResponse => {
    const thinkFor = (color: GameColor) => {
        const startTime = Date.now();
        let bestMove: any = null;

        const moves = getAllMovesForColor(pieces, color);
        if(moves.length === 0) return undefined;

        bestMove = moves[0];

        for (let depth = 1; depth <= maxDepth; depth++) {
            let currentBestMoveForDepth: any = null;
            let currentBestScoreForDepth = -Infinity;

            for (const m of moves) {
                const newPieces = applyMove(pieces, m);
                if (isKingInCheck(newPieces, color)) continue;

                const score = -minimaxV4(newPieces, depth - 1, -Infinity, Infinity, opposite(color), color, startTime);
                
                if (score > currentBestScoreForDepth) {
                    currentBestScoreForDepth = score;
                    currentBestMoveForDepth = m;
                }
            }

            if (Date.now() - startTime > MAX_SEARCH_TIME) {
                console.log(`Time limit reached at depth ${depth}`);
                break; 
            }
            
            if(currentBestMoveForDepth) bestMove = currentBestMoveForDepth;
        }
        
        const p = pieces[bestMove.fromIndex];
        return {
            index: bestMove.fromIndex,
            oldPosition: `x${p.posX}y${p.posY}`,
            posX: bestMove.toX,
            posY: bestMove.toY,
            position: `x${bestMove.toX}y${bestMove.toY}`
        };
    };

    transpositionTable.clear();
    const response: ThinkResponse = {};
    if (thinkForColor === 'white' || thinkForColor === 'both') {
        response.white = thinkFor(GameColor.WHITE);
    }
    if (thinkForColor === 'black' | thinkForColor === 'both') {
        response.black = thinkFor(GameColor.BLACK);
    }
    return response;
};
