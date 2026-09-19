import cors from 'cors';
import express from 'express';
import type { MealWiseStore } from './db/mongo.js';
import { createStore } from './db/mongo.js';
import { createChatRouter } from './routes/chat.js';
import { planRouter } from './routes/plan.js';

export function createApp(store: MealWiseStore) {
	const app = express();
	const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean);

	app.use(cors({
		origin: allowedOrigins.length ? (origin, callback) => {
			if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
			return callback(new Error('Origin is not allowed by CORS'));
		} : true
	}));
	app.use(express.json({ limit: '32kb' }));
	app.use((_request, response, next) => {
		response.setHeader('Cache-Control', 'no-store');
		next();
	});
	app.get('/health', (_request, response) => response.json({ ok: true, service: 'mealwise-api', dataSource: 'verified-demo-data' }));
	app.use('/api/plan', planRouter);
	app.use('/api/chat', createChatRouter(store));
	app.use((_request, response) => response.status(404).json({ error: 'Route not found.' }));
	app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
		console.error(error);
		return response.status(500).json({ error: 'The planner is temporarily unavailable.' });
	});
	return app;
}

const port = Number(process.env.PORT || 8787);
if (process.env.NODE_ENV !== 'test') {
	createStore().then((store) => {
		createApp(store).listen(port, () => console.log(`MealWise API listening on ${port}`));
	}).catch((error) => {
		console.error('Unable to initialize MealWise persistence:', error);
		process.exitCode = 1;
	});
}
