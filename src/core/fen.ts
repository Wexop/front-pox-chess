import { GameColor, PieceName, type PieceOnTray } from "./type";
import { allPieces } from "./utils";

const pieceTypeFromSymbol = (symbol: string): PieceName => {
    switch (symbol.toLowerCase()) {
        case 'p': return PieceName.pion;
        case 'r': return PieceName.tour;
        case 'n': return PieceName.cavalier;
        case 'b': return PieceName.fou;
        case 'q': return PieceName.queen;
        case 'k': return PieceName.king;
        default: throw new Error(`Unknown piece symbol: ${symbol}`);
    }
}

export const fenToPieces = (fen: string): PieceOnTray[] => {
    const pieces: PieceOnTray[] = [];
    const [pieceData] = fen.split(' ');
    const ranks = pieceData.split('/');

    ranks.forEach((rank, y) => {
        let x = 0;
        for (const char of rank) {
            if (isNaN(parseInt(char))) {
                const color = char === char.toUpperCase() ? GameColor.WHITE : GameColor.BLACK;
                const name = pieceTypeFromSymbol(char);
                const piece = allPieces.find(p => p.name === name && p.color === color);
                if (piece) {
                    pieces.push({
                        ...piece,
                        posX: x,
                        posY: y,
                        position: `x${x}y${y}`
                    });
                }
                x++;
            } else {
                x += parseInt(char);
            }
        }
    });

    return pieces;
};
