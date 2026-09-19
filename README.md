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
│   ├── agent/              # Prompt, schemas, and ranking agent
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

`POST /api/plan`

```json
{
	"prompt": "Dinner for two tonight",
	"budget": 25,
	"dietary": "Vegetarian"
}
```

The response contains a ranked `options` list, total `savings`, a plain-language `summary`, and a `checkedAt` timestamp. The current agent uses verified demo data so the hackathon experience is deterministic. The `MODEL_API_KEY` placeholder in `.env.example` is ready for replacing the local ranking step with a hosted model after real provider tools are connected.

## Deployment

Deploy the client and server as two services for the cleanest scaling path:

1. Build the client with `npm run build` from the repository root and deploy `client/dist` to Vercel, Netlify, or any static host.
2. Deploy the server workspace to Render, Railway, Fly.io, or a Node-compatible host using `npm run start --workspace server`.
3. Set `VITE_API_URL` on the client to the public server URL and `PORT` on the server if the host requires it.
4. Allow the deployed client origin in the Express CORS configuration before production launch.

For a hackathon demo, Vercel can host the static client and Render can host the Express API with the included workspace commands.
# NewsBreak-Hackathon-0919

We are organizing a four-hour hackathon. You can see the event theme in the "Define NewsBreak hackathon agent" box. We want to focus on designing an AI agent specifically tailored to help low-income residents in Mountain View use delivery services. We are focusing solely on delivery. The goal is to identify the most cost-effective options—for instance, finding "buy-one-get-one-free" offers.

```
Project/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api/
│   │   └── types/
│   └── package.json
├── server/
│   ├── agent/
│   │   ├── localAgent.js
│   │   ├── instructions.js
│   │   └── schemas.js
│   ├── tools/
│   │   ├── food.js
│   │   ├── delivery.js
│   │   ├── disruptions.js
│   │   └── verification.js
│   ├── data/
│   │   └── demo-data.json
│   ├── routes/
│   │   └── plan.js
│   └── app.js
├── shared/
│   └── schemas.js
├── .devcontainer/
│   └── devcontainer.json
├── .env.example
├── package.json
└── README.md
```