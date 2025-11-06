import { Button, Group, Stack } from "@mantine/core"
import "./App.css"
import { useState } from "react"
import type { Piece, PieceOnTray } from "./core/type.ts"
import { allBlackPieces, allWhitePieces } from "./core/utils.tsx"
import { IconTrash } from "@tabler/icons-react"
import { defaultValues } from "./core/defaultValues.tsx"


function App() {

  const [piecesOnTray, setPiecesOnTray] = useState<PieceOnTray[]>(defaultValues)
  const [pieceSelected, setPieceSelected] = useState<Piece | undefined>(undefined)

  console.log( piecesOnTray )

  const chessTray = [
    ["x0y0", "x1y0", "x2y0", "x3y0","x4y0", "x5y0", "x6y0", "x7y0"],
    ["x0y1", "x1y1", "x2y1", "x3y1","x4y1", "x5y1", "x6y1", "x7y1"],
    ["x0y2", "x1y2", "x2y2", "x3y2","x4y2", "x5y2", "x6y2", "x7y2"],
    ["x0y3", "x1y3", "x2y3", "x3y3","x4y3", "x5y3", "x6y3", "x7y3"],
    ["x0y4", "x1y4", "x2y4", "x3y4","x4y4", "x5y4", "x6y4", "x7y4"],
    ["x0y5", "x1y5", "x2y5", "x3y5","x4y5", "x5y5", "x6y5", "x7y5"],
    ["x0y6", "x1y6", "x2y6", "x3y6","x4y6", "x5y6", "x6y6", "x7y6"],
    ["x0y7", "x1y7", "x2y7", "x3y7","x4y7", "x5y7", "x6y7", "x7y7"],
  ]

  const addPiece = ({posX, posY, position}: {posX: number, posY: number, position: string}) => {
    const newPiecesOnTray = [...piecesOnTray].filter(v  => v.position !== position)
    if(!pieceSelected) return setPiecesOnTray(newPiecesOnTray)
    newPiecesOnTray.push({ ...pieceSelected, position, posX, posY })
    setPiecesOnTray(newPiecesOnTray)
  }

  return (
   <Stack gap={50} align={"center"}>
     <Stack gap={2}>
       {chessTray.map((lane, i) => (
         <Group gap={2} key={i}>
           {lane.map((place, i2) => {
             return <Stack onClick={() => {
               addPiece({posX: i2, posY: i, position: place})
             }} align={"center"} justify={"center"} key={i2} style={{border: "1px solid black", cursor: "pointer"}} h={50} w={50} >
               {piecesOnTray.find(p => p.position === place)?.element}
             </Stack>
           })}
         </Group>
       ))}
     </Stack>

     <Stack>
       <Button color={"red"} onClick={() => setPieceSelected(undefined)} variant={"light"}>
         <IconTrash/>
       </Button>
       <Group>
         {allBlackPieces.map((piece) => {
           return (
             <Button onClick={() => setPieceSelected(piece)} variant={"light"}>
               {piece.element}
             </Button>
           )
         })}
       </Group>
       <Group>
         {allWhitePieces.map((piece) => {
           return (
             <Button onClick={() => setPieceSelected(piece)} variant={"light"}>
               {piece.element}
             </Button>
           )
         })}
       </Group>
     </Stack>

   </Stack>
  )
}

export default App
