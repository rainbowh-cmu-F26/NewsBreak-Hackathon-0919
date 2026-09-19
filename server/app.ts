import cors from 'cors';
import express from 'express';
import { planRouter } from './routes/plan.js';

const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (_request, response) => response.json({ ok: true }));
app.use('/api/plan', planRouter);

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`Neighborly API listening on ${port}`));
