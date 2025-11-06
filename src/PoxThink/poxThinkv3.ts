import { GameColor, type Movement, PieceName, type PieceOnTray, type ThinkResponse } from "../core/type.ts"

const PIECE_VALUE: Record<PieceName, number> = {
  pion: 100,
  cavalier: 320,
  fou: 330,
  tour: 500,
  queen: 900,
  king: 20000
}

// Piece-Square Tables for each piece type
// Values are higher for center squares and change based on piece position
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
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
];

const bishopEvalWhite = [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
];
const bishopEvalBlack = bishopEvalWhite.slice().reverse();

const rookEvalWhite = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [0,  0,  0,  5,  5,  0,  0,  0]
];
const rookEvalBlack = rookEvalWhite.slice().reverse();

const queenEval = [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [-5,  0,  5,  5,  5,  5,  0, -5],
    [0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
];

const kingEvalWhite = [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [20, 20,  0,  0,  0,  0, 20, 20],
    [20, 30, 10,  0,  0, 10, 30, 20]
];
const kingEvalBlack = kingEvalWhite.slice().reverse();


const inside = (x: number, y: number) => x >= 0 && x < 8 && y >= 0 && y < 8

const opposite = (color: GameColor) => color === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE

const applyMove = (pieces: PieceOnTray[], index: number, toX: number, toY: number): PieceOnTray[] => {
  const newPieces = pieces.map(p => ({ ...p }))
  const piece = newPieces[index]
  const targetIndex = newPieces.findIndex(p => p.posX === toX && p.posY === toY)
  if (targetIndex !== -1) newPieces.splice(targetIndex, 1)
  piece.posX = toX
  piece.posY = toY
  piece.position = `x${toX}y${toY}`
  return newPieces
}

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
  const moves: { index: number; fromX: number; fromY: number; toX: number; toY: number, score: number }[] = []
  pieces.forEach((p, index) => {
    if (p.color !== color) return
    const movement = getPieceMovement(p.name, color, pieces, p.posX, p.posY)
    movement.forEach(m => {
        const targetPiece = pieces.find(target => target.posX === m.posX && target.posY === m.posY);
        let score = 0;
        if (targetPiece) {
            score = 10 * PIECE_VALUE[targetPiece.name] - PIECE_VALUE[p.name];
        }
      moves.push({ index, fromX: p.posX, fromY: p.posY, toX: m.posX, toY: m.posY, score })
    })
  })
  return moves.sort((a, b) => b.score - a.score);
}

const isKingInCheck = (pieces: PieceOnTray[], color: GameColor) => {
  const king = pieces.find(p => p.name === PieceName.king && p.color === color)
  if (!king) return true
  const enemyColor = opposite(color);
  const enemyMoves = pieces.filter(p => p.color === enemyColor).flatMap(p =>
    getPieceMovement(p.name, enemyColor, pieces, p.posX, p.posY)
  )
  return enemyMoves.some(m => m.posX === king.posX && m.posY === king.posY)
}

const getPieceSquareTableValue = (piece: PieceName, color: GameColor, x: number, y: number) => {
    switch(piece) {
        case PieceName.pion: return color === GameColor.WHITE ? pawnEvalWhite[y][x] : pawnEvalBlack[y][x];
        case PieceName.cavalier: return knightEval[y][x];
        case PieceName.fou: return color === GameColor.WHITE ? bishopEvalWhite[y][x] : bishopEvalBlack[y][x];
        case PieceName.tour: return color === GameColor.WHITE ? rookEvalWhite[y][x] : rookEvalBlack[y][x];
        case PieceName.queen: return queenEval[y][x];
        case PieceName.king: return color === GameColor.WHITE ? kingEvalWhite[y][x] : kingEvalBlack[y][x];
    }
    return 0;
}

const getTrayScoreV3 = (pieces: PieceOnTray[], color: GameColor) => {
  const enemyColor = opposite(color)
  const enemyKing = pieces.find(p => p.name === PieceName.king && p.color === enemyColor)
  if (!enemyKing) return 9999
  if (isKingInCheck(pieces, enemyColor) && getAllMovesForColor(pieces, enemyColor).length === 0) return 9999

  let score = 0
  for (const p of pieces) {
    const value = PIECE_VALUE[p.name] + getPieceSquareTableValue(p.name, p.color, p.posX, p.posY);
    score += p.color === color ? value : -value
  }

  return score
}

const quiescenceSearch = (pieces: PieceOnTray[], alpha: number, beta: number, currentColor: GameColor, maximizingColor: GameColor): number => {
    const standPat = getTrayScoreV3(pieces, maximizingColor);
    if (standPat >= beta) {
        return beta;
    }
    if (alpha < standPat) {
        alpha = standPat;
    }

    const moves = getAllMovesForColor(pieces, currentColor).filter(move => {
        const targetPiece = pieces.find(p => p.posX === move.toX && p.posY === move.toY);
        return targetPiece; // Only consider capture moves
    });

    for (const m of moves) {
        const newPieces = applyMove(pieces, m.index, m.toX, m.toY);
        if (isKingInCheck(newPieces, currentColor)) continue;
        const score = -quiescenceSearch(newPieces, -beta, -alpha, opposite(currentColor), maximizingColor);
        if (score >= beta) {
            return beta;
        }
        if (score > alpha) {
            alpha = score;
        }
    }
    return alpha;
}


const minimaxV3 = (pieces: PieceOnTray[], depth: number, alpha: number, beta: number, currentColor: GameColor, maximizingColor: GameColor): number => {
  if (depth === 0) return quiescenceSearch(pieces, alpha, beta, currentColor, maximizingColor);
  const moves = getAllMovesForColor(pieces, currentColor)
  if (!moves.length) {
      if(isKingInCheck(pieces, currentColor)) return -9999 - depth; // Checkmate
      return 0; // Stalemate
  }

  for (const m of moves) {
      const newPieces = applyMove(pieces, m.index, m.toX, m.toY)
      if (isKingInCheck(newPieces, currentColor)) continue
      const val = -minimaxV3(newPieces, depth - 1, -beta, -alpha, opposite(currentColor), maximizingColor)
      if (val >= beta) {
          return beta; // Beta cutoff
      }
      if (val > alpha) {
          alpha = val;
      }
  }
  return alpha
}

export const PoxThinkV3 = (pieces: PieceOnTray[], depth = 3): ThinkResponse => {
  const thinkFor = (color: GameColor) => {
    const moves = getAllMovesForColor(pieces, color)
    let bestMove = moves[0]
    let bestScore = -Infinity
    for (const m of moves) {
      const newPieces = applyMove(pieces, m.index, m.toX, m.toY)
      if (isKingInCheck(newPieces, color)) continue
      const score = -minimaxV3(newPieces, depth - 1, -Infinity, Infinity, opposite(color), color)
      if (score > bestScore) {
          bestScore = score;
          bestMove = m
      }
    }
    const p = pieces[bestMove?.index ?? 0]
    return {
      index: bestMove?.index,
      oldPosition: `x${p.posX}y${p.posY}`,
      posX: bestMove?.toX,
      posY: bestMove?.toY,
      position: `x${bestMove?.toX}y${bestMove?.toY}`
    }
  }

  return {
    white: thinkFor(GameColor.WHITE),
    black: thinkFor(GameColor.BLACK)
  }
}
