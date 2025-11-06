import type { ReactNode } from "react"


export enum GameColor  {
  BLACK= "BLACK",
  WHITE = "WHITE"
}

export enum PieceName  {
  pion = "pion",
  king = "king",
  queen = "queen",
  fou = "fou",
  cavalier = "cavalier",
  tour = "tour",
}

export type Piece = {
  element: ReactNode,
  name: PieceName,
  color: GameColor,
}

export type PieceOnTray = Piece & {position: string, posX: number, posY: number, id: string}

export type ThinkResponse = {
  black?: {
    index: number, posX: number, posY: number, position: string, oldPosition: string
  },
  white?: {
    index: number, posX: number, posY: number, position: string, oldPosition: string
  }
}

export type Movement = {
  posX: number, posY: number, position: string
}
