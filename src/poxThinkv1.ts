import { GameColor, type Movement, PieceName, type PieceOnTray, type ThinkResponse } from "./core/type.ts"


export const PoxThinkV1 = (pieces: PieceOnTray[], depth = 2): ThinkResponse => {

  const thinkFor = (color: GameColor) => {
    const moves = getAllMovesForColor(pieces, color)

    let bestMove = moves[0]
    let bestScore = color === GameColor.WHITE ? -Infinity : +Infinity

    for (const m of moves) {
      const newPieces = applyMove(pieces, m.index, m.toX, m.toY)
      const score = minimax(newPieces, depth, color,
        color === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE
      )

      if (color === GameColor.WHITE && score > bestScore) {
        bestScore = score
        bestMove = m
      }
      if (color === GameColor.BLACK && score < bestScore) {
        bestScore = score
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


const applyMove = (
  pieces: PieceOnTray[],
  index: number,
  toX: number,
  toY: number
): PieceOnTray[] => {

  const newPieces = pieces.map(p => ({...p}))

  const piece = newPieces[index]

  // remove éventuelle capture
  const targetIndex = newPieces.findIndex(p => p.posX === toX && p.posY === toY)
  if (targetIndex !== -1) newPieces.splice(targetIndex, 1)

  // move
  piece.posX = toX
  piece.posY = toY
  piece.position = `x${toX}y${toY}`

  return newPieces
}

const getAllMovesForColor = (pieces: PieceOnTray[], color: GameColor) => {
  const moves: {
    index: number,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  }[] = []

  pieces.forEach((p, index) => {
    if (p.color !== color) return
    const movement = getPieceMovement(p.name, color, pieces, p.posX, p.posY)
    movement.forEach(m => {
      moves.push({
        index,
        fromX: p.posX,
        fromY: p.posY,
        toX: m.posX,
        toY: m.posY
      })
    })
  })

  return moves
}

const minimax = (
  pieces: PieceOnTray[],
  depth: number,
  maximizingColor: GameColor,
  currentColor: GameColor
): number => {

  if (depth === 0) return getTrayScoreV1(pieces, maximizingColor)

  const moves = getAllMovesForColor(pieces, currentColor)

  if (moves.length === 0) return getTrayScoreV1(pieces, maximizingColor)

  if (currentColor === maximizingColor) {
    let best = -Infinity
    for (const m of moves) {
      const newPieces = applyMove(pieces, m.index, m.toX, m.toY)
      const val = minimax(newPieces, depth - 1, maximizingColor,
        maximizingColor === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE
      )
      if (val > best) best = val
    }
    return best
  } else {
    let best = +Infinity
    for (const m of moves) {
      const newPieces = applyMove(pieces, m.index, m.toX, m.toY)
      const val = minimax(newPieces, depth - 1, maximizingColor,
        maximizingColor === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE
      )
      if (val < best) best = val
    }
    return best
  }
}


const PIECE_VALUE: Record<PieceName, number> = {
  pion: 1,
  cavalier: 3,
  fou: 3,
  tour: 5,
  queen: 9,
  king: 0
}

export const getTrayScoreV1 = (pieces: PieceOnTray[], color: GameColor) => {

  const enemyColor = color === GameColor.BLACK ? GameColor.WHITE : GameColor.BLACK

  // check mate : on gagne
  const enemyKing = pieces.find(p => p.name === PieceName.king && p.color === enemyColor)!
  const enemyMoves = getPieceMovement(
    PieceName.king,
    enemyColor,
    pieces,
    enemyKing?.posX,
    enemyKing?.posY
  )

  if (enemyMoves?.length === 0) {
    return 9999
  }

  let score = 0

  // Matériel
  for (const p of pieces) {
    const val = PIECE_VALUE[p.name]
    if (p.color === color) score += val
    else score -= val
  }

  // Mobilité
  const myPieces = pieces.filter(p => p.color === color)
  const enemyPieces = pieces.filter(p => p.color === enemyColor)

  let myMoves = 0
  let enemyMovesCount = 0

  for (const p of myPieces) {
    myMoves += getPieceMovement(p.name, color, pieces, p.posX, p.posY).length
  }

  for (const p of enemyPieces) {
    enemyMovesCount += getPieceMovement(p.name, enemyColor, pieces, p.posX, p.posY).length
  }

  // pondération mobilité → faible pour ne pas dominer le score matériel
  score += (myMoves - enemyMovesCount) * 0.1

  return score
}

const canMoveOnCase = (pieces: PieceOnTray[], color: GameColor, posX: number, posY: number, stopEnemyLook?: boolean) => {

  if(posY > 7 || posY < 0) return false;
  if(posX > 7 || posX < 0) return false;
  if(pieces.filter(p => p.color === color).find(p => p.posX === posX && p.posY === posY)) return false
  return true;

}

const eatPiecePoint = (piece: PieceName) => {
  switch ( piece ) {
    case PieceName.king: {
      return 100
    }
    case PieceName.pion: {
      return 1
    }
    case PieceName.tour: {
      return 7
    }
    case PieceName.cavalier: {
      return 5
    }
    case PieceName.fou: {
      return 7
    }
    case PieceName.queen: {
      return 10
    }
  }
}



const inside = (x: number, y: number) =>
  x >= 0 && x < 8 && y >= 0 && y < 8

const ray = (
  pieces: PieceOnTray[],
  color: GameColor,
  posX: number,
  posY: number,
  directions: [number, number][]
) => {
  const moves: { posX: number; posY: number }[] = []

  for (const [dx, dy] of directions) {
    let x = posX + dx
    let y = posY + dy

    while (inside(x, y)) {

      if (!canMoveOnCase(pieces, color, x, y)) break

      moves.push({ posX: x, posY: y })

      // si on tombe sur une pièce (même ennemie), on s'arrête
      if (pieces.find(p => p.posX === x && p.posY === y)) break

      x += dx
      y += dy
    }
  }

  return moves
}

export const getPieceMovement = (
  piece: PieceName,
  color: GameColor,
  pieces: PieceOnTray[],
  posX: number,
  posY: number,
): Movement[] => {

  let moves: {posX:number, posY:number}[] = []

  switch (piece) {

    case PieceName.king:
      moves = [
        [1,0],[-1,0],[0,1],[0,-1],
        [1,1],[1,-1],[-1,1],[-1,-1]
      ].map(([dx, dy]) => ({posX: posX+dx, posY: posY+dy}))
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
      ].map(([dx, dy]) => ({posX: posX+dx, posY: posY+dy}))
      break

    case PieceName.pion: {
      const dir = (color === GameColor.WHITE) ? -1 : 1

      // avance simple
      if (
        inside(posX, posY + dir) &&
        !pieces.find(p => p.posX === posX && p.posY === posY + dir)
      ) {
        moves.push({posX, posY: posY + dir})
      }

      // avance double si sur ligne de départ
      const start = (color === GameColor.WHITE) ? 6 : 1
      if (posY === start &&
        !pieces.find(p => p.posX===posX && p.posY===posY+dir) &&
        !pieces.find(p => p.posX===posX && p.posY===posY+2*dir)
      ) {
        moves.push({posX, posY: posY + 2*dir})
      }

      // captures
      for (const dx of [-1, 1]) {
        const target = pieces.find(p =>
          p.posX === posX + dx &&
          p.posY === posY + dir &&
          p.color !== color
        )
        if (target) moves.push({posX: posX + dx, posY: posY + dir})
      }

      break
    }

    default:
      return []
  }

  return moves
    .filter(m => inside(m.posX, m.posY))
    .filter(m => canMoveOnCase(pieces, color, m.posX, m.posY))
    .map(m => ({position: `x${m.posX}y${m.posY}`, ...m}))
}


