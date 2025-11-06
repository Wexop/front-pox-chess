import { GameColor, type Movement, PieceName, type PieceOnTray, type ThinkResponse } from "./core/type.ts"

// ---------- UTILS ----------
const inside = (x: number, y: number) => x >= 0 && x < 8 && y >= 0 && y < 8

const clone = (pieces: PieceOnTray[]) => pieces.map(p => ({...p}))

const applyMove = (pieces: PieceOnTray[], index: number, toX: number, toY: number): PieceOnTray[] => {
  const newP = clone(pieces)
  const p = newP[index]
  const t = newP.findIndex(pp => pp.posX === toX && pp.posY === toY)
  if (t !== -1) newP.splice(t, 1)
  p.posX = toX
  p.posY = toY
  p.position = `x${toX}y${toY}`
  return newP
}

const canMoveOnCase = (pieces: PieceOnTray[], color: GameColor, posX: number, posY: number) => {
  if(!inside(posX,posY)) return false
  return !pieces.some(p=>p.color===color && p.posX===posX && p.posY===posY)
}

// ---------- GET ATTACK PATTERNS ----------
const getAttackSquares = (piece: PieceName, color: GameColor, pieces: PieceOnTray[], x: number, y: number): {x:number,y:number}[] => {
  const res: {x:number,y:number}[] = []

  const add = (xx:number,yy:number)=>inside(xx,yy)&&res.push({x:xx,y:yy})

  const ray = (dirs:[number,number][])=>{
    for(const[dx,dy] of dirs){
      let cx=x+dx, cy=y+dy
      while(inside(cx,cy)){
        res.push({x:cx,y:cy})
        if(pieces.find(p=>p.posX===cx && p.posY===cy)) break
        cx+=dx; cy+=dy
      }
    }
  }

  switch(piece){
    case PieceName.king: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(d=>add(x+d[0],y+d[1])); break
    case PieceName.queen: ray([[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]); break
    case PieceName.tour: ray([[1,0],[-1,0],[0,1],[0,-1]]); break
    case PieceName.fou: ray([[1,1],[1,-1],[-1,1],[-1,-1]]); break
    case PieceName.cavalier:
      [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]
        .forEach(([dx,dy])=>add(x+dx,y+dy))
      break
    case PieceName.pion:
      const d=(color===GameColor.WHITE)?-1:1
      add(x+1,y+d); add(x-1,y+d)
      break
  }
  return res
}

const isSquareAttacked = (pieces: PieceOnTray[], color: GameColor, x:number,y:number) => {
  const enemy = color===GameColor.WHITE?GameColor.BLACK:GameColor.WHITE
  return pieces
    .filter(p=>p.color===enemy)
    .some(p=>getAttackSquares(p.name,p.color,pieces,p.posX,p.posY).some(a=>a.x===x && a.y===y))
}

// ---------- MOVEMENTS ----------
const rayMoves = (pieces: PieceOnTray[], color:GameColor,x:number,y:number,dirs:[number,number][])=>{
  const r=[]
  for(const[dx,dy] of dirs){
    let cx=x+dx, cy=y+dy
    while(inside(cx,cy)){
      if(!canMoveOnCase(pieces,color,cx,cy)) break
      r.push({x:cx,y:cy})
      if(pieces.find(p=>p.posX===cx && p.posY===cy)) break
      cx+=dx; cy+=dy
    }
  }
  return r
}

export const getPieceMovement = (piece: PieceName, color:GameColor,pieces:PieceOnTray[],x:number,y:number):Movement[]=>{
  let m:{x:number,y:number}[]=[]

  switch(piece){
    case PieceName.king:
      m = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].map(d=>({x:x+d[0],y:y+d[1]}))
      break
    case PieceName.queen:
      m = rayMoves(pieces,color,x,y,[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]])
      break
    case PieceName.tour:
      m = rayMoves(pieces,color,x,y,[[1,0],[-1,0],[0,1],[0,-1]])
      break
    case PieceName.fou:
      m = rayMoves(pieces,color,x,y,[[1,1],[1,-1],[-1,1],[-1,-1]])
      break
    case PieceName.cavalier:
      m = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]].map(d=>({x:x+d[0],y:y+d[1]}))
      break
    case PieceName.pion: {
      const d=(color===GameColor.WHITE)?-1:1
      if(inside(x,y+d) && !pieces.some(p=>p.posX===x&&p.posY===y+d)) m.push({x,y:y+d})
      const start=(color===GameColor.WHITE)?6:1
      if(y===start && !pieces.some(p=>p.posX===x&&p.posY===y+d) && !pieces.some(p=>p.posX===x&&p.posY===y+2*d))
        m.push({x,y:y+2*d})
      for(const dx of[-1,1]){
        const t=pieces.find(p=>p.posX===x+dx && p.posY===y+d && p.color!==color)
        if(t) m.push({x:x+dx,y:y+d})
      }
      break
    }
  }

  return m
    .filter(p=>inside(p.x,p.y))
    .filter(p=>canMoveOnCase(pieces,color,p.x,p.y))
    // interdit de se mettre en échec
    .filter(p=>{
      const newP=applyMove(pieces, pieces.findIndex(pp=>pp.posX===x&&pp.posY===y), p.x,p.y)
      const king=newP.find(pp=>pp.color===color && pp.name===PieceName.king)!
      return !isSquareAttacked(newP,color,king.posX,king.posY)
    })
    .map(p=>({position:`x${p.x}y${p.y}`,posX:p.x,posY:p.y}))
}

// ---------- SCORING ----------
const VAL:Record<PieceName,number>={pion:1,cavalier:3,fou:3,tour:5,queen:9,king:0}

const score = (pieces:PieceOnTray[], color:GameColor) => {
  let s=0
  for(const p of pieces){
    const v=VAL[p.name]
    s += (p.color===color? v : -v)
  }
  return s
}

// ---------- MINIMAX + ALPHA-BETA ----------
const getAllMoves = (pieces:PieceOnTray[],color:GameColor)=>{
  const out=[]
  pieces.forEach((p,i)=>{
    if(p.color!==color)return
    getPieceMovement(p.name,color,pieces,p.posX,p.posY).forEach(m=>out.push({index:i,toX:m.posX,toY:m.posY}))
  })
  return out
}

const minimax = (
  pieces:PieceOnTray[],
  depth:number,
  alpha:number,
  beta:number,
  current:GameColor,
  maxColor:GameColor
):number => {

  if(depth===0) return score(pieces,maxColor)

  const moves=getAllMoves(pieces,current)
  if(moves.length===0) return score(pieces,maxColor)

  if(current===maxColor){
    let best=-Infinity
    for(const m of moves){
      const val=minimax(applyMove(pieces,m.index,m.toX,m.toY),depth-1,alpha,beta,current===GameColor.WHITE?GameColor.BLACK:GameColor.WHITE,maxColor)
      if(val>best) best=val
      if(val>alpha) alpha=val
      if(beta<=alpha) break
    }
    return best
  } else {
    let best=+Infinity
    for(const m of moves){
      const val=minimax(applyMove(pieces,m.index,m.toX,m.toY),depth-1,alpha,beta,current===GameColor.WHITE?GameColor.BLACK:GameColor.WHITE,maxColor)
      if(val<best) best=val
      if(val<beta) beta=val
      if(beta<=alpha) break
    }
    return best
  }
}

// ---------- THINK V2 ----------
export const PoxThinkV2 = (pieces: PieceOnTray[], depth=3): ThinkResponse => {

  const thinkFor=(color:GameColor)=>{
    const moves=getAllMoves(pieces,color)
    let best=null
    let bestScore=(color===GameColor.WHITE)? -Infinity : +Infinity


    // Move ordering: captures first
    moves.sort((a,b)=>{
      const ta=pieces.find(p=>p.posX===a.toX&&p.posY===a.toY)
      const tb=pieces.find(p=>p.posX===b.toX&&p.posY===b.toY)
      return (tb?VAL[tb.name]:0)-(ta?VAL[ta.name]:0)
    })

    for(const m of moves){
      const newP=applyMove(pieces,m.index,m.toX,m.toY)
      const val=minimax(newP,depth,-Infinity,+Infinity,color===GameColor.WHITE?GameColor.BLACK:GameColor.WHITE,color)
      if(color===GameColor.WHITE && val>bestScore){bestScore=val;best=m}
      if(color===GameColor.BLACK && val<bestScore){bestScore=val;best=m}
    }

    if(!best) alert("MAT")

    const p=pieces[best!.index]
    return {
      index: best!.index,
      oldPosition:`x${p.posX}y${p.posY}`,
      posX: best!.toX,
      posY: best!.toY,
      position:`x${best!.toX}y${best!.toY}`
    }
  }

  return {white:thinkFor(GameColor.WHITE),black:thinkFor(GameColor.BLACK)}
}
