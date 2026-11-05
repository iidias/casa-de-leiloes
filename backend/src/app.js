import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import lotRoutes from './routes/lotRoutes.js';
import meRoutes from './routes/meRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import sellerRoutes from './routes/sellerRoutes.js';
import walletRoutes from './routes/walletRoutes.js';

const app = express();

// No Render a requisição chega por um proxy. Sem isto, o rate limit enxerga o IP
// do proxy e bloqueia todo mundo junto.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '20kb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/catalog', catalogRoutes);
app.use('/lots', lotRoutes);
app.use('/seller', sellerRoutes);
app.use('/wallet', walletRoutes);
app.use('/me', meRoutes);
app.use('/public', publicRoutes);

// As próximas rotas entram aqui, conforme forem criadas.

app.use(notFoundHandler);
app.use(errorHandler); // sempre por último

export default app;
