# MealWise Copilot Instructions

## Product context

MealWise helps low-income residents in Mountain View find the most cost-effective delivery options. Recommendations must prioritize total price, verified promotions, delivery fees, dietary fit, and realistic ETAs. Do not invent offers, availability, fees, or delivery times.

## Repository conventions

- This is an npm workspace with a React/Vite/TypeScript client, an Express/TypeScript server, MongoDB persistence, and shared schemas in `shared/`.
- Keep client code in `client/src/`, server code in `server/`, and cross-boundary request/response contracts in `shared/`.
- Prefer existing dependencies and patterns before introducing new libraries or abstractions.
- Use TypeScript strictness and preserve the existing workspace scripts.
- Keep edits focused; do not rewrite unrelated README content or user changes.

## Client guidance

- Preserve the current MealWise visual direction: warm cream background, dark green ink, coral accents, yellow value highlights, expressive serif display type, and compact mono labels.
- Keep the interface responsive for mobile and desktop. The primary workflow is entering a craving, budget, and dietary preference, then comparing ranked offers.
- Use Lucide React icons for interface actions and provide accessible labels for icon-only buttons.
- Show totals with fees included, make savings legible, and avoid implying that demo data is live.
- Put API calls in `client/src/api/` and reusable client types in `client/src/types/`.
- Keep the structured planner and direct chat workflow consistent: chat responses should update the same ranked shortlist.

## Server and agent guidance

- Validate incoming API payloads with Zod before running ranking logic.
- Keep recommendation ranking deterministic and explainable: budget and dietary fit first, then verified savings and total cost.
- Treat `server/data/demo-data.json` as verified demo data only. New real providers should be isolated behind tools and verification logic.
- Validate demo/provider offers before ranking them; preserve source and verification timestamps in API responses.
- Keep API responses compatible with the shared schemas. The planner endpoint is `POST /api/plan`.
- The conversational endpoint is `POST /api/chat`; preserve `conversationId` across turns and persist user/assistant messages through the store abstraction.
- Use MongoDB in production via `MONGODB_URI` and `MONGODB_DATABASE`. The in-memory fallback is for local demos and tests only.
- Do not expose secrets in source code. Use `.env.example` for documented environment variables.

## Validation

After code changes, run the narrowest relevant check first, then broaden as needed:

```bash
npm run build
npm test --workspace server
```

For API changes, also start the server and smoke-test `POST /api/plan` with a representative budget and dietary filter. Confirm that invalid payloads return a useful 400 response and that returned totals stay within the requested budget.

## Deployment

- The client is built from the repository root into `client/dist` and can be deployed to a static host.
- The server runs with `npm run start --workspace server` and can be deployed to a Node-compatible host.
- Configure `VITE_API_URL` for the deployed client and `PORT` for the server.
- Configure `CORS_ORIGIN` with the deployed client origin. The unset development fallback is permissive and must not be used in production.
- Configure `MONGODB_URI` and `MONGODB_DATABASE` for production persistence.
