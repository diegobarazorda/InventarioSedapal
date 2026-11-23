import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import routes from './routes.js';
import { HttpError, migrar } from './db.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());
app.use('/api', routes);

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'La imagen es demasiado grande (máx. 8 MB)' });
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const port = process.env.PORT || 3001;
// Solo escucha en tu PC (127.0.0.1): nada externo puede acceder
migrar().catch((e) => console.error('No se pudo revisar la tabla activos_fijos:', e.message));
app.listen(port, '127.0.0.1', () => console.log(`API lista en http://127.0.0.1:${port}`));
