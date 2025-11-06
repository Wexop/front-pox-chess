import type { PieceOnTray, ThinkResponse } from "./core/type.ts"


export const PoxThinkV1 = (pieces: PieceOnTray[]): ThinkResponse => {

  return {
    black: {
      index: 0, posX: 0, posY: 0, position: "x0y0", oldPosition: "x0y1"
    },
    white: {
      index: 0, posX: 0, posY: 0, position: "x1y0", oldPosition: "x1y1"
    }
  }
}
