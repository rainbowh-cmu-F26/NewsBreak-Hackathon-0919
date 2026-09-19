# Food search agent

The HTTP planner and chat endpoints use the same `FoodAgent` workflow:

1. Load the conversation's saved intent (chat only).
2. Interpret the latest message with Gemini or OpenAI structured output, or a limited offline parser.
3. Ask for clarification if interpretation is uncertain or unavailable.
4. Search registered offer providers.
5. Validate every returned record, enforce constraints in code, calculate a group quote, and rank eligible offers.
6. Let the model inspect the validated shortlist with read-only catalog tools, generate a conversational reply, and persist the next conversation state.

The model extracts preferences and selects structured actions; the server executes only allowlisted catalog functions. It does not execute model-generated code, URLs, or SQL. This is a bounded search workflow, not an ordering or checkout agent.

## Interactive catalog tools

After intent extraction and the initial validated search, `CatalogConversation` can choose `searchOffers`, `getOfferDetails`, or `explainNoMatches`, then `respond`. The action loop uses validated structured JSON on both Gemini and OpenAI. It allows at most three additional tool calls and four model requests within a shared 15-second deadline. Extraction has its own 12-second deadline; provider retrieval has a five-second deadline. The browser allows 35 seconds for the complete request.

Tools operate on the same provider snapshot. Details are limited to the current validated shortlist. Empty-result diagnostics test individual changes to cuisine, food, deal, platform, time, budget, or new-customer eligibility, returning hypothetical counts and prices. They never mutate the active intent or relax dietary, allergy, ingredient-exclusion, or location checks. The assistant asks before applying a suggested change; the next user message authorizes it through intent extraction.

Replies are grounded in tool results. Recommended IDs and dollar amounts are checked against the available evidence. Natural-language statements are still model-generated, so these checks are not a proof of every sentence; allergy metadata in demo records is not a medical guarantee. If response generation fails, the server returns the validated deterministic summary with a warning. An extraction failure still returns no recommendations.

Broad cuisine groups such as Asian, East Asian, Southeast Asian, and South Asian expand to specific cuisine labels in both model and local search. The model receives the supported vocabulary. Explicit optional preferences such as “preferably dairy-free” go into separate preference fields and rank eligible results; unqualified requirements still filter results. “Chicken, preferably dairy-free” requires chicken and prefers dairy-free dishes. Unknown specific cuisines remain constraints rather than being silently discarded.

The model receives up to eight recent user/assistant messages along with the saved intent. This allows ingredient questions and answers such as “yes please” to a proposed filter change. Local mode remains a limited parser and does not run the conversational action loop. Injecting an explicit extractor isolates extraction; to use a custom extractor with model conversation, pass a `CatalogConversation` as the third `FoodAgent` argument.

## Run it

Use Node.js 22 or newer. From the repository root, copy `.env.example` to `.env` and run `npm run dev`. The server loads the root `.env` automatically; existing environment variables take precedence. Leave `MONGODB_URI` blank for the disposable development store.

For AI interpretation, set:

```dotenv
AGENT_MODE=model
AI_PROVIDER=gemini
GEMINI_API_KEY=your-server-side-key
GEMINI_MODEL=gemini-3.5-flash-lite
```

`AI_PROVIDER=gemini` uses the Gemini GenerateContent API with JSON Schema output. To use OpenAI instead, set `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL` (default `gpt-4o-mini`). The default provider when AI_PROVIDER is omitted is OpenAI for backward compatibility.

`auto` uses the selected provider when its key is configured and otherwise uses the local parser. `local` always uses the offline parser. `model` requires a key and returns an unavailable response when it is missing. The UI labels which interpreter produced the result. Never put the key in a `VITE_` variable.

The OpenAI integration uses the [Responses API with structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), validates the result with Zod, sets `store: false`, and has a 12-second deadline. Extraction sends the current message, saved structured intent, up to eight recent messages, supported vocabulary, form defaults, and previous best total. The conversational stage also receives validated search results and requested catalog details. Refusals, incomplete responses, invalid output, timeouts, and API errors return no recommendations rather than guessing. The Gemini adapter uses [GenerateContent](https://ai.google.dev/api/generate-content), the same intent schema and 12-second deadline, and sends the key only in the `x-goog-api-key` header. Its model output is validated before catalog search. Tests inject model responses and never make paid model calls.

## Try these requests

- “Asian food” → expands to Chinese, Thai, Vietnamese, Indian, Japanese, and Korean categories.
- “Chicken, preferably dairy-free”, then “Does the curry contain milk?” → prioritizes the dairy-free chicken bowl and uses catalog details for the question.
- “Chicken BOGO”, then an answer to the assistant’s proposed change → diagnoses the deal conflict and updates only the accepted preference.
- “Vegan Mexican BOGO for two under $20 on Grubhub” → one simulated taco bundle for two, estimated $12.49.
- “Vegetarian noodles under $20”, then “No noodles, Mexican instead” → preserves budget/diet, excludes noodles, and changes cuisine.
- “Make it cheaper” → keeps restrictions and searches strictly below the last recommended total.
- “Free delivery within 30 minutes, fastest” → filters fees/ETA and sorts by time.
- “Chicken tacos on DoorDash under $25”, then “I am a new customer” → unlocks the eligible promotion.
- “Allergic to peanuts” → excludes declared ingredients and cross-contact; missing allergy metadata is rejected.
- “Any cuisine, any deal” → clears those two filters. “Start over” resets to the current form defaults.

Budget is for the entire group. “$10 per person for two” becomes $20. Explicit message constraints take precedence over form defaults. If a form field changes later, it replaces that corresponding saved default; unmodified fields do not overwrite constraints from earlier messages. Diets, exclusions, allergies, and requested deal types are AND constraints; cuisines and foods are OR within each list.

The local parser supports common English phrases and a finite vocabulary. It is not equivalent to model interpretation; unfamiliar wording may need rephrasing. Numeric budgets are supported, while some word-only budgets prompt for digits. Medical diet claims require clarification. A demo result is not an allergy-safety guarantee.

## Fake database and pricing

`server/data/offers.json` is the mock database. It has 13 offer records across cuisines and simulated Uber Eats, DoorDash, and Grubhub labels, including an unavailable fixture. These records are not actual provider data or restaurant claims.

Records describe dietary tags, complete ingredient/allergen metadata, cross-contact, deal types, serving counts, discounted price, delivery/service fees, tax rate, ETA, minimum subtotal, eligibility, location, and availability. `MockOfferProvider` produces a five-minute simulated quote from each record. The timestamp describes a mock quote generation, not a real-world check.

BOGO prices already cover the promotional bundle. To feed a group, the planner buys `ceil(people / bundle servings)` bundles. It charges delivery and service fees once and rounds tax to cents. The budget check includes those fees and estimated tax, but excludes optional tips. Savings are food savings for the top recommendation, never a sum across mutually exclusive choices.

Prices, tax rules, eligibility, and quantity behavior are simplified fixtures. They must be replaced with authoritative provider quotes before a checkout feature is added. No order is placed by this application.

## Adding real providers

Implement `OfferProvider` from `server/providers/types.ts` for each authorized integration. Its `search(intent, signal)` method must return records conforming to `catalogOfferSchema` and honor cancellation. Inject the adapters with `new FoodAgent(undefined, providers)` to retain the default model conversation and pass that agent to `createApp(store, agent)`.

Adapters should authenticate server-side, translate queries, normalize cuisines/ingredients/tags, resolve account-specific promotion eligibility, and return current quote timestamps/expiry. Do not label data complete unless the source actually provides it. The planner rechecks schema validity, availability, freshness, location, budget, and all constraints after retrieval. Provider searches run independently with a five-second deadline; partial failures are surfaced. Registering live adapters disables mock results entirely, including during outages.

There are deliberately no placeholder Uber Eats, DoorDash, or Grubhub network calls. Real connections require appropriate provider access and credentials. The normalized contract is the integration seam, not a claim that unrestricted consumer search APIs are available. Add per-provider contract tests and adapt quote fields for authoritative taxes, fees, stock, geographic coverage, and purchase limits before enabling an adapter.

## Conversation storage and limitations

Memory and MongoDB stores save the interpreted state alongside each plan. The next chat request reads the latest state by `conversationId`; it does not replay an unbounded transcript. Model failures preserve the last good state. The development memory store retains at most 1,000 turns. MongoDB context reads tolerate older records without agent state.

Conversation IDs act as session identifiers in this demo. Before a multi-user production launch, bind them to authenticated users, add retention/deletion controls, and serialize concurrent turns per conversation. Chat state survives hiding the panel; a page reload or “New chat” starts a new UI conversation. No order history or saved offers are used for personalization.

## Validation

`npm run test:coverage --workspace server` exercises extraction, follow-ups, provider validation, quote math, allergies, HTTP persistence, and mocked model success/failure responses. `npx tsc --noEmit -p server/tsconfig.json` checks the server; `npm run build` checks and bundles the client. Real Gemini, OpenAI, and MongoDB connectivity require separately configured credentials/services and are not covered by the offline suite.
