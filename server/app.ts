import './env.js';
import cors from 'cors';
import express from 'express';
import type { ChatRequest, PlanResponse } from '../shared/schemas.js';
import type { ConversationContext } from '../shared/intent.js';
import type { Quote } from '../shared/quotes.js';
import type { MealWiseStore } from './db/mongo.js';
import { createStore } from './db/mongo.js';
import { rateLimit, securityHeaders } from './middleware/security.js';
import { createChatRouter } from './routes/chat.js';
import { createPlanRouter } from './routes/plan.js';
import { FoodAgent } from './agent/foodAgent.js';
import { DatabaseOfferProvider } from './providers/database.js';
import { createCatalogRouter } from './routes/catalog.js';

type AppAgent = Pick<FoodAgent, 'dataSource' | 'run'>;

export function createApp(store: MealWiseStore, agent: AppAgent = new FoodAgent(undefined, store.listQuotes ? [new DatabaseOfferProvider(store.listQuotes.bind(store))] : undefined)) {
	const app = express();
	const isProduction = process.env.NODE_ENV === 'production';
	const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean);
	if (isProduction && !allowedOrigins.length) {
		throw new Error('CORS_ORIGIN must be configured in production.');
	}

	app.use(cors({
		origin: allowedOrigins.length ? (origin, callback) => {
			if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
			return callback(new Error('Origin is not allowed by CORS'));
		} : true
	}));
	app.use(securityHeaders);
	app.use(express.json({ limit: '32kb' }));
	app.use('/api', rateLimit);
	app.use((_request, response, next) => {
		response.setHeader('Cache-Control', 'no-store');
		next();
	});
	app.get('/health', (_request, response) => response.json({ ok: true, service: 'mealwise-api', dataSource: agent.dataSource }));
	app.use('/api/plan', createPlanRouter(agent));
	app.use('/api/catalog', createCatalogRouter(store));
	app.use('/api/chat', createChatRouter(store, agent));
	app.use((_request, response) => response.status(404).json({ error: 'Route not found.' }));
	app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
		if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
			return response.status(400).json({ error: 'Request body must be valid JSON.' });
		}
		if (error instanceof Error && error.message === 'Origin is not allowed by CORS') {
			return response.status(403).json({ error: 'Origin is not allowed.' });
		}
		console.error(error);
		return response.status(500).json({ error: 'The planner is temporarily unavailable.' });
	});
	return app;
}

const port = Number(process.env.PORT || 8787);
if (process.env.NODE_ENV !== 'test') {
	createStore().then((store) => {
		const server = createApp(store).listen(port, () => console.log(`MealWise API listening on ${port}`));
		server.once('error', (error: NodeJS.ErrnoException) => {
			console.error(error.code === 'EADDRINUSE'
				? `Port ${port} is already in use. Stop the other MealWise dev server before running npm run dev again.`
				: `Unable to start MealWise: ${error.message}`);
			void store.close().finally(() => { process.exitCode = 1; });
		});
	}).catch((error) => {
		console.error('Unable to initialize MealWise persistence:', error);
		process.exitCode = 1;
	});
}
