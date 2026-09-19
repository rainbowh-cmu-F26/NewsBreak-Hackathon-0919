# MealWise

MealWise is a delivery savings agent for low-income residents in Mountain View. It compares verified promotions, delivery fees, dietary fit, and ETAs to find the best total value for a specific budget.

## Project structure

```text
.
├── client/                 # React + Vite web app
│   ├── src/
│   │   ├── api/            # API client
│   │   ├── types/          # Shared client-facing types
│   │   ├── main.tsx        # App shell and planner experience
│   │   └── styles.css      # Responsive visual system
│   ├── package.json
│   └── vite.config.ts
├── server/                 # Express API and local agent logic
│   ├── agent/              # Prompt, ranking agent, and offer verification
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
- **Lucide React**: accessible interface icons without custom SVG maintenance.
- **tsx**: simple TypeScript execution for local server development.
- **Concurrently**: one command to run the client and server together.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:8787`.

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

## Deployment

Deploy the client and server as two services for the cleanest scaling path:

1. Build the client with `npm run build` from the repository root and deploy `client/dist` to Vercel, Netlify, or any static host.
2. Deploy the server workspace to Render, Railway, Fly.io, or a Node-compatible host using `npm run start --workspace server`.
3. Set `VITE_API_URL` on the client to the public server URL, `PORT` on the server if the host requires it, and `CORS_ORIGIN` to the deployed client origin.
4. Do not leave `CORS_ORIGIN` unset in production; the development fallback allows all origins for local demos.

For a hackathon demo, Vercel can host the static client and Render can host the Express API with the included workspace commands.