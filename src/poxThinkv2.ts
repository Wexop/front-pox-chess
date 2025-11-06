import { GameColor, type Movement, PieceName, type PieceOnTray, type ThinkResponse } from "./core/type.ts"


const PIECE_VALUE: Record<PieceName, number> = {
  pion: 1,
  cavalier: 3,
  fou: 3,
  tour: 5,
  queen: 9,
  king: 0
}

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
  const moves: { index: number; fromX: number; fromY: number; toX: number; toY: number }[] = []
  pieces.forEach((p, index) => {
    if (p.color !== color) return
    const movement = getPieceMovement(p.name, color, pieces, p.posX, p.posY)
    movement.forEach(m => {
      moves.push({ index, fromX: p.posX, fromY: p.posY, toX: m.posX, toY: m.posY })
    })
  })
  return moves
}

const isKingInCheck = (pieces: PieceOnTray[], color: GameColor) => {
  const king = pieces.find(p => p.name === PieceName.king && p.color === color)
  if (!king) return true
  const enemyMoves = pieces.filter(p => p.color !== color).flatMap(p =>
    getPieceMovement(p.name, p.color, pieces, p.posX, p.posY)
  )
  return enemyMoves.some(m => m.posX === king.posX && m.posY === king.posY)
}

const getTrayScoreV2 = (pieces: PieceOnTray[], color: GameColor) => {
  const enemyColor = opposite(color)
  const enemyKing = pieces.find(p => p.name === PieceName.king && p.color === enemyColor)
  if (!enemyKing) return 9999
  if (isKingInCheck(pieces, enemyColor) && getAllMovesForColor(pieces, enemyColor).length === 0) return 9999

  let score = 0
  for (const p of pieces) {
    const val = PIECE_VALUE[p.name]
    score += p.color === color ? val : -val
  }

  const myMoves = getAllMovesForColor(pieces, color).length
  const enemyMoves = getAllMovesForColor(pieces, enemyColor).length
  score += (myMoves - enemyMoves) * 0.1
  return score
}

const minimaxV2 = (pieces: PieceOnTray[], depth: number, alpha: number, beta: number, currentColor: GameColor, maximizingColor: GameColor): number => {
  if (depth === 0) return getTrayScoreV2(pieces, maximizingColor)
  const moves = getAllMovesForColor(pieces, currentColor)
  if (!moves.length) return getTrayScoreV2(pieces, maximizingColor)

  if (currentColor === maximizingColor) {
    let best = -Infinity
    for (const m of moves) {
      const newPieces = applyMove(pieces, m.index, m.toX, m.toY)
      if (isKingInCheck(newPieces, maximizingColor)) continue
      const val = minimaxV2(newPieces, depth - 1, alpha, beta, opposite(currentColor), maximizingColor)
      if (val > best) best = val
      if (val > alpha) alpha = val
      if (alpha >= beta) break
    }
    return best
  } else {
    let best = Infinity
    for (const m of moves) {
      const newPieces = applyMove(pieces, m.index, m.toX, m.toY)
      if (isKingInCheck(newPieces, currentColor)) continue
      const val = minimaxV2(newPieces, depth - 1, alpha, beta, opposite(currentColor), maximizingColor)
      if (val < best) best = val
      if (val < beta) beta = val
      if (alpha >= beta) break
    }
    return best
  }
}

export const PoxThinkV2 = (pieces: PieceOnTray[], depth = 3): ThinkResponse => {
  const thinkFor = (color: GameColor) => {
    const moves = getAllMovesForColor(pieces, color)
    let bestMove = moves[0]
    let bestScore = color === GameColor.WHITE ? -Infinity : Infinity
    for (const m of moves) {
      const newPieces = applyMove(pieces, m.index, m.toX, m.toY)
      if (isKingInCheck(newPieces, color)) continue
      const score = minimaxV2(newPieces, depth - 1, -Infinity, Infinity, opposite(color), color)
      if (color === GameColor.WHITE && score > bestScore) { bestScore = score; bestMove = m }
      if (color === GameColor.BLACK && score < bestScore) { bestScore = score; bestMove = m }
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
