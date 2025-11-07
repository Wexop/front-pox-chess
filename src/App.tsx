import { Button, Group, Loader, NumberInput, SegmentedControl, Stack, TextInput } from "@mantine/core"
import "./App.css"
import { useEffect, useState } from "react"
import { type Piece, type PieceOnTray, type ThinkResponse } from "./core/type.ts"
import { allBlackPieces, allWhitePieces } from "./core/utils.tsx"
import { IconTrash } from "@tabler/icons-react"
import { defaultValues } from "./core/defaultValues.tsx"
import { fenToPieces } from "./core/fen.ts"
import { PoxThinkV7 } from "./PoxThink/poxThinkV7.ts"


function App() {

  const [piecesOnTray, setPiecesOnTray] = useState<PieceOnTray[]>(defaultValues)
  const [pieceSelected, setPieceSelected] = useState<Piece | undefined>(undefined)
  const [think, setThink] = useState<ThinkResponse | undefined>(undefined)
  const [deepth, setDeepth] = useState<number>(7)
  const [fen, setFen] = useState<string>("")
  const [autoLoop, setAutoLoop] = useState<boolean>(false)
  const [thinkForColor, setThinkForColor] = useState<'white' | 'black' | 'both'>('both');
  const [isThinkin, setIsThinking] = useState<boolean>(false)

  const getFen = async () => {
    const res = await fetch('http://localhost:4000/fen');
    if (!res.ok) return null;
    const data = await res.json();
    return data.fen as string;
  };

  useEffect(() => {
    if (!autoLoop) return;

    const interval = setInterval(async () => {
      const newFen = await getFen();
      if (newFen && fen !== newFen) loadFen(newFen);
    }, 300);

    return () => clearInterval(interval);
  }, [autoLoop, fen]);

  useEffect(() => {
    if (piecesOnTray.length === 0) return;
    doThinkAsync(piecesOnTray, deepth, thinkForColor).then(setThink);
  }, [piecesOnTray, deepth, thinkForColor]);


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
    if(!pieceSelected) {
      setPieceSelected(piecesOnTray.find(p => p.position === position))
      setPiecesOnTray( newPiecesOnTray )
      return
    }
    newPiecesOnTray.push({ ...pieceSelected, position, posX, posY })
    setPiecesOnTray(newPiecesOnTray)
    setPieceSelected(undefined)
  }

  const loadFen = async (overwrite?: string) => {
    try {
      const fenToUse = overwrite ?? fen;
      const pieces = fenToPieces(fenToUse);
      setPiecesOnTray(pieces);
      setFen(fenToUse);
    } catch (e) {
      console.error(e);
    }
  };

  const loadFenFromCopy = async () => {
    const read = await navigator.clipboard.readText()
    if(read !== fen) loadFen(read)

  }

  const doThinkAsync = async (pieces: PieceOnTray[], depth: number, thinkFor: 'white' | 'black' | 'both') => {
    setIsThinking(true)
    const newThink = await new Promise<ThinkResponse>((resolve) => {
      setTimeout(() => {
        const result = PoxThinkV7(pieces, depth, thinkFor);
        resolve(result);
      });
    });
    setIsThinking(false)
    return newThink
  };

  return (
   <Stack gap={50} align={"center"}>
     <Stack key={fen} gap={2}>
       {chessTray.map((lane, i) => (
         <Group gap={2} key={i}>
           {lane.map((place, i2) => {

             const isBlackThink = think?.black?.position === place || think?.black?.oldPosition === place
             const isWhiteThink = think?.white?.position === place|| think?.white?.oldPosition === place

             return <Stack bg={isBlackThink ? "red" : isWhiteThink ? "green" : undefined} onClick={() => {
               addPiece({posX: i2, posY: i, position: place})
             }} align={"center"} justify={"center"} key={i2} style={{border: "1px solid black", cursor: "pointer"}} h={50} w={50} >
               {piecesOnTray.find(p => p.position === place)?.element}
             </Stack>
           })}
         </Group>
       ))}
     </Stack>

     <Stack>
       {isThinkin && <Loader/>}
        <Group>
            <TextInput value={fen} onChange={(event) => setFen(event.currentTarget.value)} placeholder="Enter FEN string" />
            <Button onClick={() => loadFen()}>Load FEN</Button>
            <Button id={"fenFromCopy"} onClick={loadFenFromCopy}>From copy FEN</Button>
            <Button color={ autoLoop ? "green" :"red"} onClick={() =>  {
              setAutoLoop(!autoLoop)

            }}>AUTO LOOP FEN</Button>
        </Group>
        <SegmentedControl
            value={thinkForColor}
            onChange={(value) => setThinkForColor(value as 'white' | 'black' | 'both')}
            data={[
                { label: 'White', value: 'white' },
                { label: 'Black', value: 'black' },
                { label: 'Both', value: 'both' },
            ]}
        />
       <Group grow>
         <Button color={"red"} onClick={() => setPieceSelected(undefined)} variant={"light"}>
           <IconTrash/>
         </Button>
         <Button color={"red"} onClick={() => {
           setPieceSelected( undefined )
           setPiecesOnTray([])
         }} variant={"light"}>
         DELETE ALL
       </Button>
       </Group>
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
       <Group grow align={"end"}>
         <Button onClick={() => doThinkAsync(piecesOnTray, deepth, thinkForColor).then(setThink)}>
           THINK
         </Button>
         <NumberInput value={deepth} onChange={(e) => e && setDeepth(e as number)} label={"depth"} />
       </Group>
       <Group grow>
         <Button color={"green"} onClick={() => {

           const pieceSelected = piecesOnTray.find(v  => v.position === think?.white?.oldPosition)
           if(!pieceSelected || !think?.white) return
           let newPiecesOnTray = [...piecesOnTray].filter(v  => v.position !== think?.white?.oldPosition)
           newPiecesOnTray = newPiecesOnTray.filter(p => p.position !== think?.white?.position)
           newPiecesOnTray.push({...pieceSelected, ...think.white})

           setPiecesOnTray(newPiecesOnTray)


         }}>APPLY WHITE</Button>
         <Button  color={"red"} onClick={() => {

           const pieceSelected = piecesOnTray.find(v  => v.position === think?.black?.oldPosition)
           if(!pieceSelected || !think?.black) return
           let newPiecesOnTray = [...piecesOnTray].filter(v  => v.position !== think?.black?.oldPosition)
           newPiecesOnTray = newPiecesOnTray.filter(p => p.position !== think?.black?.position)
           newPiecesOnTray.push({...pieceSelected, ...think.black})

           setPiecesOnTray(newPiecesOnTray)


         }}>APPLY BLACK</Button>
       </Group>
     </Stack>

   </Stack>
  )
}

export default App
