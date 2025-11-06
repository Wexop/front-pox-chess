import { GameColor } from "../core/type.ts"
import {
  IconChess,
  IconChessBishop,
  IconChessBishopFilled,
  IconChessFilled,
  IconChessKing,
  IconChessKingFilled,
  IconChessKnight,
  IconChessKnightFilled,
  IconChessQueen,
  IconChessQueenFilled,
  IconChessRook,
  IconChessRookFilled
} from "@tabler/icons-react"


export const PionPiece = ( {color}:{ color: GameColor }) => {

  switch ( color ) {
    case GameColor.WHITE: {
      return <IconChess/>
    }
    case GameColor.BLACK: {
      return <IconChessFilled />
    }
  }
}

export const FouPiece = ( {color}:{ color: GameColor }) => {

  switch ( color ) {
    case GameColor.WHITE: {
      return <IconChessBishop/>
    }
    case GameColor.BLACK: {
      return <IconChessBishopFilled />
    }
  }
}

export const RoiPiece = ( {color}:{ color: GameColor }) => {

  switch ( color ) {
    case GameColor.WHITE: {
      return <IconChessKing/>
    }
    case GameColor.BLACK: {
      return <IconChessKingFilled />
    }
  }
}

export const QueenPiece = ( {color}:{ color: GameColor }) => {

  switch ( color ) {
    case GameColor.WHITE: {
      return <IconChessQueen/>
    }
    case GameColor.BLACK: {
      return <IconChessQueenFilled />
    }
  }
}


export const CavalierPiece = ( {color}:{ color: GameColor }) => {

  switch ( color ) {
    case GameColor.WHITE: {
      return <IconChessKnight/>
    }
    case GameColor.BLACK: {
      return <IconChessKnightFilled />
    }
  }
}

export const TourPiece = ( {color}:{ color: GameColor }) => {

  switch ( color ) {
    case GameColor.WHITE: {
      return <IconChessRook/>
    }
    case GameColor.BLACK: {
      return <IconChessRookFilled />
    }
  }
}
