import { CavalierPiece, FouPiece, PionPiece, QueenPiece, RoiPiece, TourPiece } from "../components/chessPieces.tsx"
import { GameColor, type PieceOnTray } from "./type.ts"


export const defaultValues: PieceOnTray[] = [
  {
    "name": "pion",
    "element": <PionPiece color={GameColor.BLACK}/>,
    "color": "BLACK",
    "position": "x0y1",
    "posX": 0,
    "posY": 1
  },
  {
    "name": "pion",
    "element": <PionPiece color={GameColor.BLACK}/>,
    "color": "BLACK",
    "position": "x1y1",
    "posX": 1,
    "posY": 1
  },
  {
    "name": "pion",
    "element": <PionPiece color={GameColor.BLACK}/>,

    "color": "BLACK",
    "position": "x2y1",
    "posX": 2,
    "posY": 1
  },
  {
    "name": "pion",
    "element": <PionPiece color={GameColor.BLACK}/>,

    "color": "BLACK",
    "position": "x4y1",
    "posX": 4,
    "posY": 1
  },
  {
    "name": "pion",
    "element": <PionPiece color={GameColor.BLACK}/>,

    "color": "BLACK",
    "position": "x3y1",
    "posX": 3,
    "posY": 1
  },
  {
    "name": "pion",
    "element": <PionPiece color={GameColor.BLACK}/>,

    "color": "BLACK",
    "position": "x5y1",
    "posX": 5,
    "posY": 1
  },
  {
    "name": "pion",
    "element": <PionPiece color={GameColor.BLACK}/>,

    "color": "BLACK",
    "position": "x6y1",
    "posX": 6,
    "posY": 1
  },
  {
    "name": "pion",
    "element": <PionPiece color={GameColor.BLACK}/>,

    "color": "BLACK",
    "position": "x7y1",
    "posX": 7,
    "posY": 1
  },
  {
    "name": "tour",
    "element": <TourPiece color={GameColor.BLACK}/>,

    "color": "BLACK",
    "position": "x7y0",
    "posX": 7,
    "posY": 0
  },
  {
    "name": "tour",
    "element": <TourPiece color={GameColor.BLACK}/>,

    "color": "BLACK",
    "position": "x0y0",
    "posX": 0,
    "posY": 0
  },
  {
    "name": "pion",
    "element": <PionPiece color={GameColor.WHITE}/>,

    "color": "WHITE",
    "position": "x0y6",
    "posX": 0,
    "posY": 6
  },
  {
    "name": "pion",
    "element": <PionPiece color={GameColor.WHITE}/>,
    "color": "WHITE",
    "position": "x1y6",
    "posX": 1,
    "posY": 6
  },
  {
    "name": "pion",
    "element": <PionPiece color={GameColor.WHITE}/>,
    "color": "WHITE",
    "position": "x2y6",
    "posX": 2,
    "posY": 6
  },
  {
    "name": "pion",
    "element": <PionPiece color={GameColor.WHITE}/>,
    "color": "WHITE",
    "position": "x3y6",
    "posX": 3,
    "posY": 6
  },
  {
    "name": "pion",
    "element": <PionPiece color={GameColor.WHITE}/>,
    "color": "WHITE",
    "position": "x4y6",
    "posX": 4,
    "posY": 6
  },
  {
    "name": "pion",
    "element": <PionPiece color={GameColor.WHITE}/>,
    "color": "WHITE",
    "position": "x6y6",
    "posX": 6,
    "posY": 6
  },
  {
    "name": "pion",
    "element": <PionPiece color={GameColor.WHITE}/>,
    "color": "WHITE",
    "position": "x7y6",
    "posX": 7,
    "posY": 6
  },
  {
    "name": "pion",
    "element": <PionPiece color={GameColor.WHITE}/>,
    "color": "WHITE",
    "position": "x5y6",
    "posX": 5,
    "posY": 6
  },
  {
    "name": "tour",
    "element": <TourPiece color={GameColor.WHITE}/>,
    "color": "WHITE",
    "position": "x7y7",
    "posX": 7,
    "posY": 7
  },
  {
    "name": "tour",
    "element": <TourPiece color={GameColor.WHITE}/>,
    "color": "WHITE",
    "position": "x0y7",
    "posX": 0,
    "posY": 7
  },
  {
    "name": "cavalier",
    "element": <CavalierPiece color={GameColor.WHITE}/>,
    "color": "WHITE",
    "position": "x6y7",
    "posX": 6,
    "posY": 7
  },
  {
    "name": "cavalier",
    "element": <CavalierPiece color={GameColor.WHITE}/>,
    "color": "WHITE",
    "position": "x1y7",
    "posX": 1,
    "posY": 7
  },
  {
    "name": "cavalier",
    "element": <CavalierPiece color={GameColor.BLACK}/>,
    "color": "BLACK",
    "position": "x1y0",
    "posX": 1,
    "posY": 0
  },
  {
    "name": "cavalier",
    "element": <CavalierPiece color={GameColor.BLACK}/>,
    "color": "BLACK",
    "position": "x6y0",
    "posX": 6,
    "posY": 0
  },
  {
    "name": "fou",
    "element": <FouPiece color={GameColor.BLACK}/>,
    "color": "BLACK",
    "position": "x5y0",
    "posX": 5,
    "posY": 0
  },
  {
    "name": "fou",
    "element": <FouPiece color={GameColor.BLACK}/>,
    "color": "BLACK",
    "position": "x2y0",
    "posX": 2,
    "posY": 0
  },
  {
    "name": "fou",
    "element": <FouPiece color={GameColor.WHITE}/>,
    "color": "WHITE",
    "position": "x2y7",
    "posX": 2,
    "posY": 7
  },
  {
    "name": "fou",
    "element": <FouPiece color={GameColor.WHITE}/>,
    "color": "WHITE",
    "position": "x5y7",
    "posX": 5,
    "posY": 7
  },
  {
    "name": "king",
    "element": <RoiPiece color={GameColor.BLACK}/>,
    "color": "BLACK",
    "position": "x4y0",
    "posX": 4,
    "posY": 0
  },
  {
    "name": "king",
    "element": <RoiPiece color={GameColor.WHITE}/>,
    "color": "WHITE",
    "position": "x4y7",
    "posX": 4,
    "posY": 7
  },
  {
    "name": "queen",
    "element": <QueenPiece color={GameColor.WHITE}/>,
    "color": "WHITE",
    "position": "x3y7",
    "posX": 3,
    "posY": 7
  },
  {
    "name": "queen",
    "element": <QueenPiece color={GameColor.BLACK}/>,
    "color": "BLACK",
    "position": "x3y0",
    "posX": 3,
    "posY": 0
  }
]
