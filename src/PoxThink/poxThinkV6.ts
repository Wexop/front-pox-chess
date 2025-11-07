import { GameColor, type Piece, PieceName, type PieceOnTray, type ThinkResponse } from "../core/type.ts"

// --- V9 Configuration ---
const MAX_SEARCH_TIME = 3000;
const MATE_SCORE = 100000;
const MATE_THRESHOLD = MATE_SCORE - 1000; // Marge pour les plys
const TABLE_SIZE = 1e7;

// --- V9 Piece Values & Strategic Bonuses ---
const PIECE_VALUE: Record<PieceName, number> = {
  [PieceName.pion]: 100, [PieceName.cavalier]: 320, [PieceName.fou]: 330, [PieceName.tour]: 500, [PieceName.queen]: 950, [PieceName.king]: 20000
};

// ✨ NOUVEAU: Évaluation V9 simplifiée. Seuls les bonus rapides sont conservés.
const BISHOP_PAIR_BONUS = 50;
const DELTA_PRUNING_MARGIN = 200;

// PSQTs (Identiques, c'est la base)
const pawnEval = [[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]];
const knightEval = [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]];
const bishopEval = [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]];
const rookEval = [[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]];
const kingEval = [[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]];
const pieceSquareTables: Record<PieceName, number[][]> = {
  [PieceName.pion]: pawnEval, [PieceName.cavalier]: knightEval, [PieceName.fou]: bishopEval, [PieceName.tour]: rookEval,
  [PieceName.queen]: bishopEval.map(row => row.map(val => val * 3)), [PieceName.king]: kingEval
};

// --- V9 Interfaces (V8) ---
interface Move {
  fromX: number; fromY: number; toX: number; toY: number;
  piece: PieceName; capturedPiece?: PieceName; promotion?: PieceName;
  score: number; isCastle?: 'K' | 'Q'; isEnPassant?: boolean;
}
type TTFlag = 'EXACT' | 'LOWER' | 'UPPER';
interface TTEntry {
  depth: number; score: number; flag: TTFlag; bestMove?: Move;
}
interface CastlingRights { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean; }

// --- V9 Board Class (V8) ---
// La logique de V8 pour le roque/en-passant était correcte. Nous la gardons.
class Board {
  grid: (Piece | null)[][];
  turn: GameColor = GameColor.WHITE;
  castlingRights: CastlingRights;
  enPassantTarget: { x: number, y: number } | null = null;
  history: {
    move: Move, captured: Piece | null,
    oldCastlingRights: CastlingRights,
    oldEnPassantTarget: { x: number, y: number } | null
  }[] = [];
  kingPos: { [GameColor.WHITE]: { x: number, y: number }, [GameColor.BLACK]: { x: number, y: number } };

  constructor(pieces: PieceOnTray[]) {
    this.grid = Array(8).fill(null).map(() => Array(8).fill(null));
    this.kingPos = { [GameColor.WHITE]: { x: -1, y: -1 }, [GameColor.BLACK]: { x: -1, y: -1 } };
    let wK = false, wQ = false, bK = false, bQ = false;
    let wKingOnHome = false, bKingOnHome = false;

    for (const piece of pieces) {
      if (piece) {
        this.grid[piece.posY][piece.posX] = piece;
        if (piece.name === PieceName.king) {
          this.kingPos[piece.color] = { x: piece.posX, y: piece.posY };
          if (piece.color === GameColor.WHITE && piece.posX === 4 && piece.posY === 7) wKingOnHome = true;
          if (piece.color === GameColor.BLACK && piece.posX === 4 && piece.posY === 0) bKingOnHome = true;
        }
      }
    }
    if (wKingOnHome) {
      if (this.grid[7][7]?.name === PieceName.tour && this.grid[7][7]?.color === GameColor.WHITE) wK = true;
      if (this.grid[7][0]?.name === PieceName.tour && this.grid[7][0]?.color === GameColor.WHITE) wQ = true;
    }
    if (bKingOnHome) {
      if (this.grid[0][7]?.name === PieceName.tour && this.grid[0][7]?.color === GameColor.BLACK) bK = true;
      if (this.grid[0][0]?.name === PieceName.tour && this.grid[0][0]?.color === GameColor.BLACK) bQ = true;
    }
    this.castlingRights = { wK, wQ, bK, bQ };
  }

  getPositionKey(): string {
    let key = this.turn === GameColor.WHITE ? 'w' : 'b';
    key += `${this.castlingRights.wK}${this.castlingRights.wQ}${this.castlingRights.bK}${this.castlingRights.bQ}`;
    key += `|${this.enPassantTarget ? `${this.enPassantTarget.x}${this.enPassantTarget.y}` : 'null'}|`;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const p = this.grid[y][x];
        if (p) { key += `${p.id}@${y}${x}`; }
      }
    }
    return key;
  }

  makeMove(move: Move): void {
    const piece = this.grid[move.fromY][move.fromX]!;
    let captured = this.grid[move.toY][move.toX];
    const oldCastlingRights = { ...this.castlingRights };
    const oldEnPassantTarget = this.enPassantTarget;
    this.history.push({ move, captured, oldCastlingRights, oldEnPassantTarget });

    if (move.isEnPassant) {
      const pawnDir = piece.color === GameColor.WHITE ? 1 : -1;
      captured = this.grid[move.toY + pawnDir][move.toX];
      this.grid[move.toY + pawnDir][move.toX] = null;
    }
    if (move.isCastle) {
      if (move.isCastle === 'K') {
        const rook = this.grid[move.fromY][7]!;
        this.grid[move.fromY][5] = rook; this.grid[move.fromY][7] = null;
      } else {
        const rook = this.grid[move.fromY][0]!;
        this.grid[move.fromY][3] = rook; this.grid[move.fromY][0] = null;
      }
    }
    this.grid[move.toY][move.toX] = piece;
    this.grid[move.fromY][move.fromX] = null;
    if (piece.name === PieceName.king) {
      this.kingPos[piece.color] = { x: move.toX, y: move.toY };
    }
    if (move.promotion) {
      this.grid[move.toY][move.toX] = { ...piece, name: move.promotion };
    }
    if (piece.name === PieceName.pion && Math.abs(move.toY - move.fromY) === 2) {
      const dir = piece.color === GameColor.WHITE ? -1 : 1;
      this.enPassantTarget = { x: move.fromX, y: move.fromY + dir };
    } else {
      this.enPassantTarget = null;
    }
    if (piece.name === PieceName.king) {
      if (piece.color === GameColor.WHITE) { this.castlingRights.wK = false; this.castlingRights.wQ = false; }
      else { this.castlingRights.bK = false; this.castlingRights.bQ = false; }
    }
    if (move.fromX === 0 && move.fromY === 7) this.castlingRights.wQ = false;
    if (move.fromX === 7 && move.fromY === 7) this.castlingRights.wK = false;
    if (move.fromX === 0 && move.fromY === 0) this.castlingRights.bQ = false;
    if (move.fromX === 7 && move.fromY === 0) this.castlingRights.bK = false;
    if (move.toX === 0 && move.toY === 7) this.castlingRights.wQ = false;
    if (move.toX === 7 && move.toY === 7) this.castlingRights.wK = false;
    if (move.toX === 0 && move.toY === 0) this.castlingRights.bQ = false;
    if (move.toX === 7 && move.toY === 0) this.castlingRights.bK = false;
    this.turn = this.turn === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE;
  }

  unmakeMove(): void {
    const lastState = this.history.pop();
    if (!lastState) return;
    const { move, captured, oldCastlingRights, oldEnPassantTarget } = lastState;
    this.turn = this.turn === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE;
    this.castlingRights = oldCastlingRights;
    this.enPassantTarget = oldEnPassantTarget;
    const pieceOnToSquare = this.grid[move.toY][move.toX]!;
    const originalPiece = { ...pieceOnToSquare, name: move.piece };
    this.grid[move.fromY][move.fromX] = originalPiece;
    this.grid[move.toY][move.toX] = captured;
    if (originalPiece.name === PieceName.king) {
      this.kingPos[originalPiece.color] = { x: move.fromX, y: move.fromY };
    }
    if (move.isEnPassant) {
      const pawnDir = originalPiece.color === GameColor.WHITE ? 1 : -1;
      this.grid[move.toY][move.toX] = null;
      this.grid[move.toY + pawnDir][move.toX] = captured;
    }
    if (move.isCastle) {
      if (move.isCastle === 'K') {
        const rook = this.grid[move.fromY][5]!;
        this.grid[move.fromY][7] = rook; this.grid[move.fromY][5] = null;
      } else {
        const rook = this.grid[move.fromY][3]!;
        this.grid[move.fromY][0] = rook; this.grid[move.fromY][3] = null;
      }
    }
  }
}

// --- PoxThinkV9 ---
export const PoxThinkV6 = (
  pieces: PieceOnTray[],
  maxDepth = 7,
  thinkForColor: 'white' | 'black' | 'both' = 'both'
): ThinkResponse => {

  const board = new Board(pieces); // Le 'board' principal partagé
  const transpositionTable = new Map<string, TTEntry>();
  const killerMoves: (Move | null)[][] = Array(maxDepth + 10).fill(null).map(() => [null, null]);
  let startTime = 0;
  let nodes = 0;
  let timeUp = false;

  const getPieceAt = (x: number, y: number) => board.grid[y]?.[x];

  // --- Fonctions d'attaque et de génération de coups (V8) ---
  const isSquareAttacked = (x: number, y: number, attackerColor: GameColor): boolean => {
    // (Identique à V8)
    const pawnDir = attackerColor === GameColor.WHITE ? 1 : -1;
    if (getPieceAt(x - 1, y + pawnDir)?.name === PieceName.pion && getPieceAt(x - 1, y + pawnDir)?.color === attackerColor) return true;
    if (getPieceAt(x + 1, y + pawnDir)?.name === PieceName.pion && getPieceAt(x + 1, y + pawnDir)?.color === attackerColor) return true;
    const knightMoves = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
    for (const [dx, dy] of knightMoves) {
      if (getPieceAt(x + dx, y + dy)?.name === PieceName.cavalier && getPieceAt(x + dx, y + dy)?.color === attackerColor) return true;
    }
    const lineDirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dx, dy] of lineDirs) {
      let curX = x + dx, curY = y + dy;
      while (curX >= 0 && curX <= 7 && curY >= 0 && curY <= 7) {
        const p = getPieceAt(curX, curY); if (p) { if (p.color === attackerColor && (p.name === PieceName.tour || p.name === PieceName.queen)) return true; break; } curX += dx; curY += dy;
      }
    }
    const diagDirs = [[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [dx, dy] of diagDirs) {
      let curX = x + dx, curY = y + dy;
      while (curX >= 0 && curX <= 7 && curY >= 0 && curY <= 7) {
        const p = getPieceAt(curX, curY); if (p) { if (p.color === attackerColor && (p.name === PieceName.fou || p.name === PieceName.queen)) return true; break; } curX += dx; curY += dy;
      }
    }
    const kingMoves = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    for (const [dx, dy] of kingMoves) {
      if (getPieceAt(x + dx, y + dy)?.name === PieceName.king && getPieceAt(x + dx, y + dy)?.color === attackerColor) return true;
    }
    return false;
  };
  const isKingInCheck = (color: GameColor): boolean => {
    const king = board.kingPos[color];
    if (king.x === -1) return false;
    return isSquareAttacked(king.x, king.y, color === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE);
  };
  const getMovesForPiece = (p: Piece, x: number, y: number, color: GameColor): Move[] => {
    // (Identique à V8, logique complète)
    const generatedMoves: Move[] = [];
    const { name } = p;
    const addMove = (toX: number, toY: number, promotion?: PieceName, isCastle?: 'K' | 'Q', isEnPassant?: boolean) => {
      if (toX < 0 || toX > 7 || toY < 0 || toY > 7) return;
      const target = getPieceAt(toX, toY);
      if (!target || target.color !== color) {
        const captured = getPieceAt(toX, toY);
        let score = 0;
        if (captured) { score = 10000 + (PIECE_VALUE[captured.name] - PIECE_VALUE[p.name]); }
        if (promotion) { score += 9000 + PIECE_VALUE[promotion]; }
        if (isEnPassant) { score = 10000 + (PIECE_VALUE[PieceName.pion] - PIECE_VALUE[PieceName.pion]); }
        generatedMoves.push({ fromX: x, fromY: y, toX, toY, piece: p.name, capturedPiece: captured?.name, promotion, isCastle, isEnPassant, score });
      }
    };
    const addRay = (dirs: number[][]) => {
      for (const [dx, dy] of dirs) {
        let curX = x + dx, curY = y + dy;
        while (curX >= 0 && curX <= 7 && curY >= 0 && curY <= 7) {
          const target = getPieceAt(curX, curY);
          if (target) { if (target.color !== color) addMove(curX, curY); break; }
          addMove(curX, curY); curX += dx; curY += dy;
        }
      }
    };
    if (name === PieceName.pion) {
      const dir = color === GameColor.WHITE ? -1 : 1; const startRank = color === GameColor.WHITE ? 6 : 1; const promotionRank = color === GameColor.WHITE ? 0 : 7;
      if (!getPieceAt(x, y + dir)) {
        if (y + dir === promotionRank) { [PieceName.queen, PieceName.tour, PieceName.fou, PieceName.cavalier].forEach(p => addMove(x, y + dir, p)); } else { addMove(x, y + dir); }
        if (y === startRank && !getPieceAt(x, y + 2 * dir)) { addMove(x, y + 2 * dir); }
      }
      for (const dx of [-1, 1]) {
        const target = getPieceAt(x + dx, y + dir);
        if (target && target.color !== color) {
          if (y + dir === promotionRank) { [PieceName.queen, PieceName.tour, PieceName.fou, PieceName.cavalier].forEach(p => addMove(x + dx, y + dir, p)); } else { addMove(x + dx, y + dir); }
        }
      }
      if (board.enPassantTarget && board.enPassantTarget.y === y + dir && (board.enPassantTarget.x === x - 1 || board.enPassantTarget.x === x + 1)) {
        addMove(board.enPassantTarget.x, board.enPassantTarget.y, undefined, undefined, true);
      }
    } else if (name === PieceName.king) {
      const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      for(const [dx, dy] of dirs) addMove(x+dx, y+dy);
      const rights = board.castlingRights; const opponent = color === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE;
      if (!isKingInCheck(color)) {
        if ((color === GameColor.WHITE ? rights.wK : rights.bK) && !getPieceAt(x + 1, y) && !getPieceAt(x + 2, y) && !isSquareAttacked(x + 1, y, opponent) && !isSquareAttacked(x + 2, y, opponent)) { addMove(x + 2, y, undefined, 'K'); }
        if ((color === GameColor.WHITE ? rights.wQ : rights.bQ) && !getPieceAt(x - 1, y) && !getPieceAt(x - 2, y) && !getPieceAt(x - 3, y) && !isSquareAttacked(x - 1, y, opponent) && !isSquareAttacked(x - 2, y, opponent)) { addMove(x - 2, y, undefined, 'Q'); }
      }
    } else {
      const dirs = { [PieceName.cavalier]: [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]], [PieceName.fou]: [[1,1],[1,-1],[-1,1],[-1,-1]], [PieceName.tour]: [[1,0],[-1,0],[0,1],[0,-1]], [PieceName.queen]: [[1,0],[-1,0],[0,1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]] }[name];
      if ([PieceName.fou, PieceName.tour, PieceName.queen].includes(name)) addRay(dirs as number[][]); else for(const [dx, dy] of dirs) addMove(x+dx, y+dy);
    }
    return generatedMoves;
  };
  const generateAllMoves = (color: GameColor, capturesOnly = false): Move[] => {
    const allMoves: Move[] = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const piece = getPieceAt(x, y);
        if (piece && piece.color === color) {
          for (const move of getMovesForPiece(piece, x, y, color)) {
            if (capturesOnly && !move.capturedPiece && !move.isEnPassant) continue;
            allMoves.push(move);
          }
        }
      }
    }
    return allMoves;
  };

  // --- Tri (V8) ---
  const storeKillerMove = (move: Move, depth: number) => {
    if (depth >= killerMoves.length) return;
    if (killerMoves[depth][0]?.fromX !== move.fromX || killerMoves[depth][0]?.toX !== move.toX) {
      killerMoves[depth][1] = killerMoves[depth][0]; killerMoves[depth][0] = move;
    }
  };
  const orderMoves = (moves: Move[], ttMove: Move | undefined, depth: number) => {
    const k1 = killerMoves[depth]?.[0]; const k2 = killerMoves[depth]?.[1];
    for (const move of moves) {
      if (ttMove && move.fromX === ttMove.fromX && move.toX === ttMove.toX) { move.score = 2000000; }
      else if (move.capturedPiece || move.isEnPassant) { move.score += 1000000; }
      else if (k1 && move.fromX === k1.fromX && move.toX === k1.toX) { move.score = 500000; }
      else if (k2 && move.fromX === k2.fromX && move.toX === k2.toX) { move.score = 400000; }
    }
    moves.sort((a, b) => b.score - a.score);
  };

  // --- ✨ V9 Évaluation (Rapide !) ---
  const evaluate = (): number => {
    let score = 0;
    let whiteBishops = 0, blackBishops = 0;

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const p = getPieceAt(x, y);
        if (p) {
          // 1. Matériel
          const pieceValue = PIECE_VALUE[p.name];

          // 2. PSQT (Tables de position)
          const psqt = pieceSquareTables[p.name];
          const positionalScore = p.color === GameColor.WHITE ? psqt[y][x] : psqt[7 - y][x];

          // 3. Score total pour cette pièce
          const finalPieceScore = pieceValue + positionalScore;

          if (p.color === GameColor.WHITE) {
            score += finalPieceScore;
            if (p.name === PieceName.fou) whiteBishops++;
          } else {
            score -= finalPieceScore;
            if (p.name === PieceName.fou) blackBishops++;
          }
        }
      }
    }

    // 3. Bonus de paire de fous
    if (whiteBishops >= 2) score += BISHOP_PAIR_BONUS;
    if (blackBishops >= 2) score -= BISHOP_PAIR_BONUS;

    // Renvoie le score du point de vue du joueur actuel
    return board.turn === GameColor.WHITE ? score : -score;
  };

  // --- ✨ V9 Quiescence (Avec Échecs) ---
  const quiescenceSearch = (alpha: number, beta: number, ply: number): number => {
    nodes++;
    if (nodes % 2048 === 0 && Date.now() - startTime > MAX_SEARCH_TIME) {
      timeUp = true; return 0;
    }
    if (timeUp) return 0;

    const standPat = evaluate();
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;

    const moves = generateAllMoves(board.turn); // Génère TOUS les coups
    orderMoves(moves, undefined, 0); // Trie pour avoir les captures en premier

    for (const move of moves) {
      // ✨ NOUVEAU: On ne regarde que les captures, promotions, ou échecs
      if (!move.capturedPiece && !move.isEnPassant && !move.promotion) {
        // Si ce n'est pas un coup "fort", on vérifie s'il met en échec
        board.makeMove(move);
        const isCheckingMove = isKingInCheck(board.turn); // Vérifie si l'adversaire est en échec
        board.unmakeMove();

        if (!isCheckingMove) {
          continue; // Ignore les coups "calmes" qui ne sont pas des échecs
        }
      }

      // Delta Pruning (V7)
      if (move.capturedPiece) {
        const capturedValue = PIECE_VALUE[move.capturedPiece];
        if (standPat + capturedValue + DELTA_PRUNING_MARGIN < alpha) {
          continue;
        }
      }

      board.makeMove(move);
      if (isKingInCheck(board.turn === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE)) {
        board.unmakeMove(); continue; // Légalité (V7)
      }

      const score = -quiescenceSearch(-beta, -alpha, ply + 1); // ✨ NOUVEAU: transmet le ply
      board.unmakeMove();

      if (timeUp) return 0;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };

  // --- ✨ V9 Negamax (Avec score de Mat corrigé) ---
  const negamax = (depth: number, alpha: number, beta: number, ply: number): number => {
    nodes++;
    if (nodes % 2048 === 0 && Date.now() - startTime > MAX_SEARCH_TIME) {
      timeUp = true; return 0;
    }
    if (timeUp) return 0;

    // ✨ NOUVEAU: Logique de Mat
    // Si on trouve un mat, on ajuste le score avec le ply
    // On préfère être maté plus tard, ou mater plus tôt.
    alpha = Math.max(alpha, -(MATE_SCORE - ply));
    beta = Math.min(beta, MATE_SCORE - ply);
    if (alpha >= beta) return alpha;

    const originalAlpha = alpha;
    const positionKey = board.getPositionKey();
    const ttEntry = transpositionTable.get(positionKey);

    if (ttEntry && ttEntry.depth >= depth) {
      let score = ttEntry.score;
      // Ajuster le score de mat stocké à la profondeur actuelle
      if (score > MATE_THRESHOLD) score -= ply;
      if (score < -MATE_THRESHOLD) score += ply;

      if (ttEntry.flag === 'EXACT') return score;
      if (ttEntry.flag === 'LOWER' && score >= beta) return score;
      if (ttEntry.flag === 'UPPER' && score <= alpha) return score;
    }

    const inCheck = isKingInCheck(board.turn);
    if (inCheck) depth++;

    if (depth === 0) {
      return quiescenceSearch(alpha, beta, ply);
    }

    const moves = generateAllMoves(board.turn);
    if (moves.length === 0) {
      return inCheck ? -(MATE_SCORE - ply) : 0; // Mat (préfère le plus rapide) ou Pat
    }

    orderMoves(moves, ttEntry?.bestMove, depth);

    let bestMove: Move | undefined = undefined;
    let moveCount = 0;
    let score = -Infinity; // ✨ NOUVEAU: Doit être -Infinity

    for (const move of moves) {
      board.makeMove(move);
      if (isKingInCheck(board.turn === GameColor.WHITE ? GameColor.BLACK : GameColor.WHITE)) {
        board.unmakeMove(); continue;
      }
      moveCount++;

      // LMR (V7)
      if (moveCount > 3 && depth >= 3 && !inCheck && !move.capturedPiece && !move.promotion && !move.isCastle) {
        score = -negamax(depth - 2, -alpha - 1, -alpha, ply + 1);
      } else {
        score = -negamax(depth - 1, -beta, -alpha, ply + 1);
      }
      if (score > alpha && moveCount > 3) {
        score = -negamax(depth - 1, -beta, -alpha, ply + 1);
      }
      board.unmakeMove();

      if (timeUp) return 0;

      if (score > alpha) {
        alpha = score;
        bestMove = move;
        if (alpha >= beta) {
          if (!move.capturedPiece) storeKillerMove(move, depth);
          break;
        }
      }
    }

    if (moveCount === 0) { // Tous les coups étaient illégaux
      return inCheck ? -(MATE_SCORE - ply) : 0;
    }

    // Écriture TT (V8)
    if (!timeUp) {
      let flag: TTFlag = 'UPPER';
      if (alpha > originalAlpha) { flag = 'EXACT'; }
      if (alpha >= beta) { flag = 'LOWER'; }

      let ttScore = alpha;
      // Ajuster pour le stockage (indépendant du ply actuel)
      if (ttScore > MATE_THRESHOLD) ttScore += ply;
      if (ttScore < -MATE_THRESHOLD) ttScore -= ply;

      transpositionTable.set(positionKey, { depth, score: ttScore, flag, bestMove });
      if (transpositionTable.size > TABLE_SIZE) {
        transpositionTable.delete(transpositionTable.keys().next().value);
      }
    }
    return alpha;
  };

  // --- Fonction principale `thinkFor` (V8) ---
  const thinkFor = (color: GameColor): ThinkResponse['white'] => {
    startTime = Date.now();
    nodes = 0;
    timeUp = false;

    // ✨ NOUVEAU: Réinitialisation propre du 'board' principal
    const cleanBoardState = new Board(pieces);
    board.grid = cleanBoardState.grid.map(row => [...row]);
    board.kingPos = { ...cleanBoardState.kingPos };
    board.castlingRights = { ...cleanBoardState.castlingRights };
    board.enPassantTarget = cleanBoardState.enPassantTarget;
    board.history = []; // Vider l'historique
    board.turn = color;

    let bestMove: Move | null = null;
    let bestScore = -Infinity;

    for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
      for (let i = 0; i < killerMoves.length; i++) killerMoves[i] = [null, null];

      const moves = generateAllMoves(color);
      const ttMove = transpositionTable.get(board.getPositionKey())?.bestMove;
      orderMoves(moves, ttMove, currentDepth);

      let currentBestMoveForDepth: Move | undefined = undefined;
      let alpha = -Infinity, beta = Infinity;
      let legalMovesFound = 0;

      for (const move of moves) {
        board.makeMove(move);
        if (isKingInCheck(color)) {
          board.unmakeMove(); continue;
        }
        legalMovesFound++;
        const score = -negamax(currentDepth - 1, -beta, -alpha, 1); // ✨ NOUVEAU: ply commence à 1
        board.unmakeMove();
        if (timeUp) break;
        if (score > alpha) {
          alpha = score;
          currentBestMoveForDepth = move;
        }
      }
      if (timeUp) {
        console.log(`PoxThinkV9: Time limit reached at depth ${currentDepth}. Nodes: ${nodes}`);
        break;
      }
      if (legalMovesFound === 0) {
        console.log(`PoxThinkV9: No legal moves found (Mate/Stalemate).`);
        bestMove = null; // Assure qu'on ne renvoie rien
        break;
      }
      if (currentBestMoveForDepth) {
        bestMove = currentBestMoveForDepth;
        bestScore = alpha;
        console.log(`PoxThinkV9: Depth ${currentDepth} complete. Best move: ${bestMove.fromX},${bestMove.fromY} -> ${bestMove.toX},${bestMove.toY}. Score: ${bestScore}. Nodes: ${nodes}`);
      }
      if (bestScore > MATE_THRESHOLD) {
        console.log(`PoxThinkV9: Mate found at depth ${currentDepth}.`);
        break;
      }
    }

    if (!bestMove) {
      return undefined; // Aucun coup légal trouvé
    }

    const piece = pieces.find(p => p.posX === bestMove!.fromX && p.posY === bestMove!.fromY);
    const index = piece ? pieces.indexOf(piece) : -1;
    if (index === -1) {
      const altIndex = pieces.findIndex(p => p.posX === bestMove!.fromX && p.posY === bestMove!.fromY);
      return { index: altIndex, oldPosition: `x${bestMove!.fromX}y${bestMove!.fromY}`, posX: bestMove!.toX, posY: bestMove!.toY, position: `x${bestMove!.toX}y${bestMove!.toY}` };
    }
    return { index: index, oldPosition: `x${bestMove.fromX}y${bestMove.fromY}`, posX: bestMove.toX, posY: bestMove.toY, position: `x${bestMove.toX}y${bestMove.toY}` };
  };

  transpositionTable.clear();
  const response: ThinkResponse = {};
  if (thinkForColor === 'white' || thinkForColor === 'both') response.white = thinkFor(GameColor.WHITE);
  if (thinkForColor === 'black' || thinkForColor === 'both') response.black = thinkFor(GameColor.BLACK);
  return response;
};
