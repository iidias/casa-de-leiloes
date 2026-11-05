import { env } from './config/env.js';
import app from './app.js';
import { startCloser } from './services/settlementService.js';

app.listen(env.port, () => {
  console.log(`API ouvindo na porta ${env.port}`);
});

// Encerrador: liquida os lotes vencidos a cada 5 s (tarefa 68).
// Também há liquidação "preguiçosa" nas leituras, para quando o servidor estiver dormindo.
startCloser();
