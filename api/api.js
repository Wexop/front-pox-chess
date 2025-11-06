// server.ts
import express from "express"
import cors from "cors"


const app = express();
const port = 4000;

// Middleware
app.use(cors());             // Permet à ton onglet React d'accéder à l'API depuis n'importe quel domaine
app.use(express.json());      // Pour parser le JSON envoyé

// Cache en mémoire
let fenCache = null;

// API pour mettre à jour le FEN
app.post('/fen', (req, res) => {
  const { fen } = req.body;
  if (!fen || typeof fen !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid FEN' });
  }
  fenCache = fen;
  res.json({ success: true });
});

// API pour récupérer le FEN
app.get('/fen', (req, res) => {
  if (!fenCache) return res.status(404).json({ error: 'No FEN cached' });
  res.json({ fen: fenCache });
});

app.listen(port, () => {
  console.log(`FEN cache server running on http://localhost:${port}`);
});
