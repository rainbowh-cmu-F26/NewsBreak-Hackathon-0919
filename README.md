# MealWise

MealWise is a delivery savings agent for low-income residents in Mountain View. It compares verified promotions, delivery fees, dietary fit, and ETAs to find the best total value for a specific budget.

## Project structure

```text
.
├── client/                 # React + Vite web app
│   ├── src/
│   │   ├── api/            # Planner and chat API clients
│   │   ├── components/     # Conversational agent UI
│   │   ├── types/          # Shared client-facing types
│   │   ├── main.tsx        # App shell and planner experience
│   │   └── styles.css      # Responsive visual system
│   ├── package.json
│   └── vite.config.ts
├── server/                 # Express API and local agent logic
│   ├── agent/              # Prompt, ranking agent, and offer verification
│   ├── db/                 # MongoDB persistence with local memory fallback
│   ├── data/               # Verified demo offers
│   ├── routes/             # HTTP endpoints
│   ├── app.ts
│   └── package.json
├── shared/                 # Request and response contracts
├── .env.example
└── package.json            # Workspace scripts
```

## Dependencies

- **React + Vite + TypeScript**: fast, typed frontend development and a small production bundle.
- **Express**: lightweight API layer that can be deployed independently.
- **Zod**: runtime validation at the API boundary.
- **MongoDB**: persistence for conversations, assistant replies, and generated plans.
- **Lucide React**: accessible interface icons without custom SVG maintenance.
- **tsx**: simple TypeScript execution for local server development.
- **Concurrently**: one command to run the client and server together.
- **Node test runner + Supertest**: backend behavior and HTTP coverage without requiring MongoDB.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:8787`.

Copy `.env.example` to `.env` when running the API with MongoDB. Set `MONGODB_URI` and `MONGODB_DATABASE` to a local or hosted MongoDB instance. If `MONGODB_URI` is unset, the API uses an in-memory store for a disposable demo session; production deployments should always configure MongoDB.

To create the production client bundle:

```bash
npm run build
```

## API

`GET /health`

Returns API availability and the active data source. The current response identifies `verified-demo-data` so the interface does not imply live provider integrations.

`POST /api/plan`

```json
{
	"prompt": "Dinner for two tonight",
	"budget": 25,
	"dietary": "Vegetarian"
}
```

The response contains a ranked `options` list, total `savings`, a plain-language `summary`, a `checkedAt` timestamp, and `dataSource`. Each option includes its total price inputs, ETA, promotion detail, verification status, source, and verification timestamp. Requests are rejected with a useful `400` response when the craving, budget, or dietary preference is invalid.

The current agent is deterministic and uses only schema-verified demo data. Ranking prioritizes dietary fit, prompt relevance, verified savings, and total cost. The `MODEL_API_KEY` placeholder in `.env.example` is ready for replacing the local ranking step with a hosted model after real provider tools are connected; provider results must still pass verification before ranking.

`POST /api/chat`

```json
{
	"message": "Find me a cheap vegan dinner",
	"budget": 15,
	"dietary": "Vegan"
}
```

The response returns a `conversationId`, a concise agent `reply`, and the same ranked `plan` shape as the planner endpoint. Send the returned `conversationId` with later messages to keep the conversation associated in MongoDB. The chat panel uses the current budget and dietary controls from the planner.

## Tests

Run backend coverage checks with:

```bash
npm test --workspace server
```

The tests cover deterministic ranking, budget and dietary filtering, malformed request responses, chat response shape, and persistence calls using a fake store. They do not require a live MongoDB connection.

For a built-in Node coverage summary, run `npm run test:coverage --workspace server`.

## Deployment

Deploy the client and server as two services for the cleanest scaling path:

1. Build the client with `npm run build` from the repository root and deploy `client/dist` to Vercel, Netlify, or any static host.
2. Deploy the server workspace to Render, Railway, Fly.io, or a Node-compatible host using `npm run start --workspace server`.
3. Set `VITE_API_URL` on the client to the public server URL, `PORT` on the server if the host requires it, and `CORS_ORIGIN` to the deployed client origin.
4. Configure `MONGODB_URI` and `MONGODB_DATABASE` on the server. Use a restricted database user and a TLS connection string for hosted MongoDB.
5. Do not leave `CORS_ORIGIN` or `MONGODB_URI` unset in production; their development fallbacks are intended only for local demos.

For a hackathon demo, Vercel can host the static client and Render can host the Express API with the included workspace commands.