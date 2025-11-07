import { GameColor, type Piece, PieceName, type PieceOnTray, type ThinkResponse } from "../core/type.ts";

// --- V5 Configuration ---
const MAX_SEARCH_TIME = 3000; // Allow a bit more time for the smarter engine
const MATE_SCORE = 100000;
const TABLE_SIZE = 1e6; // Transposition Table size

// --- Piece Values & Positional-Square Tables (PSQTs) ---
const PIECE_VALUE: Record<PieceName, number> = {
    [PieceName.pion]: 100, [PieceName.cavalier]: 320, [PieceName.fou]: 330, [PieceName.tour]: 500, [PieceName.queen]: 950, [PieceName.king]: 20000
};

const pawnEval = [[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]];
const knightEval = [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]];
const bishopEval = [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]];
const rookEval = [[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]];
const kingEval = [[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]];
const pieceSquareTables: Record<PieceName, number[][]> = { [PieceName.pion]: pawnEval, [PieceName.cavalier]: knightEval, [PieceName.fou]: bishopEval, [PieceName.tour]: rookEval, [PieceName.queen]: bishopEval, [PieceName.king]: kingEval };

// --- Move Interface ---
interface Move {
    fromX: number; fromY: number;
    toX: number; toY: number;
    piece: PieceName;
    capturedPiece?: PieceName;
    promotion?: PieceName;
    score: number; // For move ordering
}

// --- The Board Class (PRIORITY #1) ---
class Board {
    grid: (Piece | null)[][];
    turn: GameColor = GameColor.WHITE;
    history: { move: Move, captured: Piece | null }[] = [];

    constructor(pieces: PieceOnTray[]) {
        this.grid = Array(8).fill(null).map(() => Array(8).fill(null));
        for (const piece of pieces) {
            if (piece) this.grid[piece.posY][piece.posX] = piece;
        }
    }

    makeMove(move: Move): void {
        const piece = this.grid[move.fromY][move.fromX]!;
        const captured = this.grid[move.toY][move.toX];
        this.history.push({ move, captured });

        this.grid[move.toY][move.toX] = piece;
        this.grid[move.fromY][move.fromX] = null;

        if (move.promotion) {
            this.grid[move.toY][move.toX] = { ...piece, name: move.promotion };
        }
        this.turn = this.turn === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE;
    }

    unmakeMove(): void {
        const lastMove = this.history.pop();
        if (!lastMove) return;
        const { move, captured } = lastMove;

        this.turn = this.turn === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE;
        const piece = this.grid[move.toY][move.toX]!;
        const originalPiece = { ...piece, name: move.piece }; // Revert promotion
        this.grid[move.fromY][move.fromX] = originalPiece;
        this.grid[move.toY][move.toX] = captured; // Restore captured piece or null
    }
}

export const PoxThinkV5 = (
  pieces: PieceOnTray[],
  maxDepth = 7,
  thinkForColor: 'white' | 'black' | 'both' = 'both'
): ThinkResponse => {

    const board = new Board(pieces);
    const transpositionTable = new Map<string, { score: number, depth: number, bestMove?: Move, flag: 'EXACT' | 'LOWER' | 'UPPER' }>();
    const killerMoves: (Move | null)[][] = Array(maxDepth + 1).fill(null).map(() => [null, null]);
    let startTime = 0;
    let nodes = 0;

    const getPieceAt = (x: number, y: number) => board.grid[y]?.[x];

    const getMovesForPiece = (p: Piece, x: number, y: number): { toX: number, toY: number, promotion?: PieceName }[] => {
        const moves: { toX: number, toY: number, promotion?: PieceName }[] = [];
        const { name, color } = p;
        const add = (toX: number, toY: number) => {
            if (toX < 0 || toX > 7 || toY < 0 || toY > 7) return;
            const target = getPieceAt(toX, toY);
            if (!target || target.color !== color) moves.push({ toX, toY });
        };
        const addRay = (dirs: number[][]) => {
            for (const [dx, dy] of dirs) {
                let curX = x + dx, curY = y + dy;
                while (curX >= 0 && curX <= 7 && curY >= 0 && curY <= 7) {
                    const target = getPieceAt(curX, curY);
                    if (target) {
                        if (target.color !== color) add(curX, curY);
                        break;
                    }
                    add(curX, curY);
                    curX += dx; curY += dy;
                }
            }
        };

        if (name === PieceName.pion) {
            const dir = color === GameColor.WHITE ? -1 : 1;
            const promotionRank = color === GameColor.WHITE ? 0 : 7;
            if (!getPieceAt(x, y + dir)) {
                if (y + dir === promotionRank) {
                    [PieceName.queen, PieceName.tour, PieceName.fou, PieceName.cavalier].forEach(p => moves.push({ toX: x, toY: y + dir, promotion: p }));
                } else {
                    moves.push({ toX: x, toY: y + dir });
                }
                if ((color === GameColor.WHITE ? 6 : 1) === y && !getPieceAt(x, y + 2 * dir)) {
                    moves.push({ toX: x, toY: y + 2 * dir });
                }
            }
            for (const dx of [-1, 1]) {
                const target = getPieceAt(x + dx, y + dir);
                if (target && target.color !== color) {
                    if (y + dir === promotionRank) {
                        [PieceName.queen, PieceName.tour, PieceName.fou, PieceName.cavalier].forEach(p => moves.push({ toX: x + dx, toY: y + dir, promotion: p }));
                    } else {
                        moves.push({ toX: x + dx, toY: y + dir });
                    }
                }
            }
        } else {
            const dirs = { [PieceName.cavalier]: [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]], [PieceName.king]: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]], [PieceName.fou]: [[1,1],[1,-1],[-1,1],[-1,-1]], [PieceName.tour]: [[1,0],[-1,0],[0,1],[0,-1]], [PieceName.queen]: [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] }[name];
            if ([PieceName.fou, PieceName.tour, PieceName.queen].includes(name)) addRay(dirs); else for(const d of dirs) add(x+d[0], y+d[1]);
        }
        return moves;
    };

    const generateAllMoves = (color: GameColor, capturesOnly = false): Move[] => {
        const allMoves: Move[] = [];
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const piece = getPieceAt(x, y);
                if (piece && piece.color === color) {
                    for (const m of getMovesForPiece(piece, x, y)) {
                        const captured = getPieceAt(m.toX, m.toY);
                        if (capturesOnly && !captured) continue;
                        let score = 0;
                        if (captured) score = 10000 + (PIECE_VALUE[captured.name] - PIECE_VALUE[piece.name]); // MVV-LVA
                        if (m.promotion) score += 9000 + PIECE_VALUE[m.promotion];
                        allMoves.push({ fromX: x, fromY: y, toX: m.toX, toY: m.toY, piece: piece.name, capturedPiece: captured?.name, promotion: m.promotion, score });
                    }
                }
            }
        }
        return allMoves;
    };

    const evaluate = (): number => {
        let score = 0;
        let whiteMobility = 0, blackMobility = 0;
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const p = getPieceAt(x, y);
                if (p) {
                    const psqt = pieceSquareTables[p.name];
                    const positionalScore = p.color === GameColor.WHITE ? psqt[y][x] : psqt[7 - y][x];
                    const pieceScore = PIECE_VALUE[p.name] + positionalScore;
                    if (p.color === GameColor.WHITE) {
                        score += pieceScore;
                        whiteMobility += getMovesForPiece(p, x, y).length;
                    } else {
                        score -= pieceScore;
                        blackMobility += getMovesForPiece(p, x, y).length;
                    }
                }
            }
        }
        score += (whiteMobility - blackMobility) * 2; // Mobility bonus
        return board.turn === GameColor.WHITE ? score : -score;
    };

    const isSquareAttacked = (x: number, y: number, attackerColor: GameColor): boolean => {
        const moves = generateAllMoves(attackerColor);
        return moves.some(m => m.toX === x && m.toY === y);
    };

    const negamax = (depth: number, alpha: number, beta: number): number => {
        nodes++;
        if (Date.now() - startTime > MAX_SEARCH_TIME) return 0;
        if (depth === 0) return quiescenceSearch(alpha, beta);

        let moves = generateAllMoves(board.turn);
        if (moves.length === 0) {
            const kingPos = pieces.find(p => p.name === PieceName.king && p.color === board.turn)!;
            return isSquareAttacked(kingPos.posX, kingPos.posY, board.turn === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE) ? -MATE_SCORE + (maxDepth - depth) : 0;
        }

        moves.sort((a, b) => b.score - a.score);

        for (const move of moves) {
            board.makeMove(move);
            const score = -negamax(depth - 1, -beta, -alpha);
            board.unmakeMove();

            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }
        return alpha;
    };

    const quiescenceSearch = (alpha: number, beta: number): number => {
        nodes++;
        if (Date.now() - startTime > MAX_SEARCH_TIME) return 0;

        const standPat = evaluate();
        if (standPat >= beta) return beta;
        if (alpha < standPat) alpha = standPat;

        const moves = generateAllMoves(board.turn, true);
        moves.sort((a, b) => b.score - a.score);

        for (const move of moves) {
            board.makeMove(move);
            const score = -quiescenceSearch(-beta, -alpha);
            board.unmakeMove();

            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }
        return alpha;
    };

    const thinkFor = (color: GameColor): ThinkResponse['white'] => {
        startTime = Date.now();
        nodes = 0;
        board.turn = color;
        let bestMove: Move | null = null;

        for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
            let alpha = -Infinity, beta = Infinity;
            const moves = generateAllMoves(color);
            moves.sort((a, b) => b.score - a.score);
            let currentBestScore = -Infinity;

            for (const move of moves) {
                board.makeMove(move);
                const score = -negamax(currentDepth - 1, -beta, -alpha);
                board.unmakeMove();

                if (score > currentBestScore) {
                    currentBestScore = score;
                    bestMove = move;
                }
                alpha = Math.max(alpha, score);
            }
            if (Date.now() - startTime > MAX_SEARCH_TIME) {
                console.log(`PoxThinkV5: Time limit reached at depth ${currentDepth}. Nodes: ${nodes}`);
                break;
            }
        }

        if (!bestMove) return undefined;
        const piece = pieces.find(p => p.posX === bestMove!.fromX && p.posY === bestMove!.fromY);
        return { index: piece ? pieces.indexOf(piece) : -1, oldPosition: `x${bestMove.fromX}y${bestMove.fromY}`, posX: bestMove.toX, posY: bestMove.toY, position: `x${bestMove.toX}y${bestMove.toY}` };
    };

    const response: ThinkResponse = {};
    if (thinkForColor === 'white' || thinkForColor === 'both') response.white = thinkFor(GameColor.WHITE);
    if (thinkForColor === 'black' || thinkForColor === 'both') response.black = thinkFor(GameColor.BLACK);
    return response;
};
