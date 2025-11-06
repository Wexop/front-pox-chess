import { GameColor, type Piece, PieceName } from "./type.ts"
import { CavalierPiece, FouPiece, PionPiece, QueenPiece, RoiPiece, TourPiece } from "../components/chessPieces.tsx"


export const allBlackPieces: Piece[] = [
  {
    name: PieceName.pion, element: <PionPiece color={GameColor.BLACK} />, color: GameColor.BLACK
  },
  {
    name: PieceName.king, element: <RoiPiece color={GameColor.BLACK} />, color: GameColor.BLACK
  },
  {
    name: PieceName.queen, element: <QueenPiece color={GameColor.BLACK} />, color: GameColor.BLACK
  },
  {
    name: PieceName.fou, element: <FouPiece color={GameColor.BLACK} />, color: GameColor.BLACK
  },
  {
    name: PieceName.cavalier, element: <CavalierPiece color={GameColor.BLACK} />, color: GameColor.BLACK
  },
  {
    name: PieceName.tour, element: <TourPiece color={GameColor.BLACK} />, color: GameColor.BLACK
  },
]

export const allWhitePieces: Piece[] = [
  {
    name: PieceName.pion, element: <PionPiece color={GameColor.WHITE} />, color: GameColor.WHITE
  },
  {
    name: PieceName.king, element: <RoiPiece color={GameColor.WHITE} />, color: GameColor.WHITE
  },
  {
    name: PieceName.queen, element: <QueenPiece color={GameColor.WHITE} />, color: GameColor.WHITE
  },
  {
    name: PieceName.fou, element: <FouPiece color={GameColor.WHITE} />, color: GameColor.WHITE
  },
  {
    name: PieceName.cavalier, element: <CavalierPiece color={GameColor.WHITE} />, color: GameColor.WHITE
  },
  {
    name: PieceName.tour, element: <TourPiece color={GameColor.WHITE} />, color: GameColor.WHITE
  },
]
