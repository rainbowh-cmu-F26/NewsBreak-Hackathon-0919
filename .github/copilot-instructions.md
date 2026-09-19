# MealWise Copilot Instructions

## What MealWise is

MealWise is a food-delivery comparison app that helps users find good-value meals within a target budget.

The product is a comparison and decision-support experience, not a food-ordering or checkout system.

The main flow is:

1. Tell MealWise what you are looking for.
2. Set a total budget and dietary preference.
3. Search for matching restaurants and meals.
4. Show the best match at each restaurant.
5. Compare simulated delivery options for the same meal.
6. Open a restaurant or meal to see more details and the full price breakdown.
7. Keep comparing or save an offer.

The current homepage is centered around:

- `What are we finding?`
- A craving, occasion, or restaurant search field
- A demo total budget
- A dietary preference selector
- `Find my best value`
- Quick-search shortcuts
- `Best match at each restaurant`

The comparison view then shows restaurant cards with a matched meal and multiple simulated delivery options.

---

## Important: demo and simulated data

A lot of the current product experience is intentionally based on simulated data.

This distinction needs to stay visible throughout the app.

- Do not describe simulated prices as live prices.
- Do not claim that a delivery option is currently available unless the underlying data actually supports that claim.
- Do not invent promotions, discounts, fees, ETAs, restaurant availability, or provider availability.
- Keep `Demo`, `Simulated`, `Hypothetical`, or equivalent labels where they are part of the current UI.
- `Restaurant delivery` can be hypothetical and should not be presented as confirmed availability.
- Food photos can be illustrative. Do not imply that an illustrative photo is the restaurant's actual dish or storefront.
- If a source/platform is shown, use the source that actually exists in the data. Do not fabricate source URLs.

The product should always be honest about what is simulated.

For example, prefer:

```text
DEMO · SIMULATED PRICE
````

and:

```text
Simulated total · not a live quote
```

over wording that suggests the price was captured from a live checkout.

---

## Repository structure

The repository is organized as follows:

```text
/
├── .github/
│   └── copilot-instructions.md
│
├── client/
│   ├── dist/
│   │   └── assets/
│   │
│   ├── src/
│   │   ├── api/
│   │   │   ├── chat.ts
│   │   │   ├── plan.ts
│   │   │   └── request.ts
│   │   │
│   │   ├── components/
│   │   │   ├── AgentFilters.tsx
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── PlatformComparison.tsx
│   │   │   └── platform-comparison.css
│   │   │
│   │   ├── data/
│   │   │   └── foodPhotos.ts
│   │   │
│   │   ├── types/
│   │   │   └── index.ts
│   │   │
│   │   ├── App.tsx
│   │   ├── interaction-styles.css
│   │   ├── main.tsx
│   │   ├── styles.css
│   │   └── vite-env.d.ts
│   │
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.tsbuildinfo
│   └── vite.config.ts
│
├── server/
│   ├── agent/
│   │   ├── foodAgent.ts
│   │   ├── gemini.ts
│   │   ├── instructions.ts
│   │   ├── intent.ts
│   │   ├── localAgent.ts
│   │   ├── model.ts
│   │   ├── modelErrors.ts
│   │   ├── schemas.ts
│   │   ├── search.ts
│   │   └── simulation.ts
│   │
│   ├── data/
│   │   ├── offers.json
│   │   ├── quotes.json
│   │   ├── three-platform-demo.json
│   │   └── source/menu data
│   │
│   ├── db/
│   │   └── mongo.ts
│   │
│   ├── middleware/
│   │   └── security.ts
│   │
│   ├── providers/
│   │   ├── mock.ts
│   │   └── types.ts
│   │
│   ├── routes/
│   │   ├── chat.ts
│   │   └── plan.ts
│   │
│   ├── scripts/
│   │   ├── run-tests.mjs
│   │   ├── seed-quotes.ts
│   │   └── test-menu-import.ts
│   │
│   ├── test/
│   │   ├── agent.test.ts
│   │   ├── app.test.ts
│   │   ├── menu.test.ts
│   │   ├── quotes.test.ts
│   │   ├── restaurant-ranking.test.ts
│   │   ├── simulation.test.ts
│   │   └── three-platform.test.ts
│   │
│   ├── app.ts
│   ├── env.ts
│   ├── package.json
│   └── tsconfig.json
│
├── shared/
│   ├── intent.ts
│   ├── quotes.ts
│   └── schemas.ts
│
├── .env.example
├── .gitignore
├── README.md
├── package-lock.json
└── package.json
```

Treat this structure as the current source of truth.

Do not create a second parallel architecture just because a different structure might be more conventional.

Before adding a new abstraction, look for an existing component, API helper, provider, agent utility, schema, or shared type that already handles the same concern.

---

# Frontend

## General frontend architecture

The frontend is a React + TypeScript + Vite application under:

```text
client/src/
```

Use the existing structure:

* `api/` for API communication.
* `components/` for reusable UI components.
* `data/` for frontend-side static data such as food photography mappings.
* `types/` for frontend types.
* `App.tsx` for the main application composition.
* `styles.css` for the main styling system.
* `interaction-styles.css` for interaction-related styles.

Do not put API requests directly into presentational components when an existing API helper can be reused.

Use the existing `request.ts` abstraction for shared request behavior where appropriate.

---

## Current API helpers

The frontend already has:

```text
client/src/api/chat.ts
client/src/api/plan.ts
client/src/api/request.ts
```

Reuse these instead of creating one-off `fetch()` calls throughout components.

Keep API concerns separate from rendering logic.

If the API contract changes, check both the corresponding frontend API helper and the shared/server schema before changing the UI.

---

## Current reusable components

The frontend currently includes:

```text
client/src/components/AgentFilters.tsx
client/src/components/ChatPanel.tsx
client/src/components/PlatformComparison.tsx
```

and:

```text
client/src/components/platform-comparison.css
```

Before creating another component for the same concept, check whether one of these components can be extended or reused.

In particular:

* `PlatformComparison` should remain responsible for platform/provider comparison UI.
* `ChatPanel` should remain focused on conversational interaction.
* `AgentFilters` should remain focused on filtering/agent-related controls.

Do not move unrelated business logic into these components just because they are already available.

---

# Search and planning experience

The main search area is one of the most important parts of the product.

The current design is centered around:

```text
01 / Your order

What are we finding?

Craving or occasion
[ All restaurants ]

Demo total budget
[ $35 ]

Dietary
[ No preference ]

[ Find my best value → ]
```

The search input can represent a craving, occasion, restaurant scope, or other natural-language request.

Do not assume every search is a specific food item.

The search action should pass the relevant constraints into the existing planning/search flow rather than implementing a separate frontend-only search algorithm.

---

## Quick search

The homepage can provide quick-search shortcuts such as:

```text
Compare all
Rice under $20
Paner under $15
```

The exact options may change as the product evolves.

Quick searches should reuse the same underlying search/planning path as the main form.

Do not create a separate ranking implementation just for quick-search buttons.

---

# Budget

The homepage currently labels the budget as:

```text
Demo total budget
```

The budget should be treated as the user's intended total spending limit.

When filtering or ranking offers, do not compare the budget only against the menu-item subtotal if the product is using all-in totals.

For example, if the user's budget is `$20`, an offer with:

```text
Items:    $15
Delivery: $2
Service:  $1
Tax:      $1
Tip:      $2
Total:   $21
```

should not be treated as a `$15` offer simply because the item subtotal is below the budget.

Do not silently change what the budget field means.

---

# Dietary preferences

Dietary preferences are part of the search constraints.

Use the existing shared schemas/types for dietary values.

Do not introduce a second set of dietary enums or string values with slightly different names.

Dietary filtering should be reflected in the actual search/ranking flow, not just hidden in the UI.

---

# Restaurant comparison

The main results section is organized around:

```text
02 / Your shortlist

Best match at each restaurant
```

The goal is to show the best matching meal at each restaurant, followed by the available/simulated delivery options for that same meal.

A restaurant result can include:

* Restaurant name
* Matched meal
* Meal quantity or size
* Matching context
* Delivery ETA
* Delivery provider
* Simulated total
* Alternative delivery options
* Best/lowest option
* Save/favorite action
* Detail-page navigation

The UI should make the cheapest/best matching option easy to identify without hiding the alternatives.

---

# Platform and delivery comparison

The current product compares multiple delivery options for the same meal.

Examples include:

* Uber Eats
* DoorDash
* Restaurant delivery

Each platform can have different:

* Item price
* Delivery fee
* Service fee
* Tax
* Tip
* Discount
* ETA
* Total

Keep provider-specific information together.

Never mix values from different providers.

For example, do not accidentally combine:

```text
Uber Eats item price
+
DoorDash delivery fee
+
Restaurant delivery ETA
```

into one offer.

Each offer should represent one coherent provider/restaurant-delivery combination.

---

# Price calculation

Price consistency is especially important in this project.

When all fields are present, the total should follow:

```text
total =
  items
  + delivery
  + service
  + tax
  + tip
  - discount
```

Important rules:

* A discount is subtracted.
* Tip is included only once.
* Delivery is included only once.
* Service fees are included only once.
* The displayed total must agree with the displayed breakdown.
* Currency values should be rounded consistently.
* Do not calculate the same total independently in several React components.

Prefer one canonical offer/quote representation and derive the UI from it.

The restaurant card and detail page should never show different totals for the same provider/meal combination.

---

# Restaurant detail experience

The detail page can include:

* Large food image
* `About the restaurant`
* Restaurant name
* Restaurant description
* Matched meal
* Source/platform link
* Simulated total
* Estimated arrival time
* Simulated status
* Delivery-platform comparison
* Full price breakdown
* `Keep comparing`
* `Save offer`

Keep these concepts visually separate.

The user should be able to understand:

1. What restaurant this is.
2. What meal is being compared.
3. Where the information came from.
4. What the simulated total is.
5. How that total was calculated.
6. Which delivery option produced the total.

---

# Food imagery

Frontend food images are managed through:

```text
client/src/data/foodPhotos.ts
```

Reuse the existing image mapping instead of adding arbitrary image URLs inside components.

Some images are intentionally illustrative.

When an image is illustrative, preserve a visible indication such as:

```text
Illustrative photo · Unsplash
```

Do not make an illustrative image look like verified restaurant photography.

If adding a new image, follow the existing food-photo data pattern rather than hard-coding the image directly into a restaurant component.

---

# Visual design

The current MealWise visual identity should remain consistent.

## Colors

The current visual language uses:

* Warm cream/off-white backgrounds
* Dark green primary text
* Dark green feature panels
* Coral/orange interactive accents
* Pale green best-value surfaces
* Muted green secondary text
* Soft yellow/gold highlights

Do not introduce a completely different color palette for a new feature.

## Typography

The design uses a combination of:

* Strong editorial/display typography for major headlines.
* Clean sans-serif text for body content.
* Compact uppercase or mono-style labels for metadata.

Examples:

```text
01 / Your order
02 / Your shortlist
DEMO · SIMULATED PRICE
```

Keep this hierarchy when adding new sections.

## Layout

The current UI relies on:

* Large editorial headings
* Generous whitespace
* Thin borders
* Rounded cards
* Large food photography
* Compact metadata rows
* Strong section separation
* Dark-green informational panels
* Clear CTA buttons

New components should look like they belong to this system.

Avoid generic dashboard styling unless the product explicitly calls for it.

---

# Agent architecture

The backend agent implementation lives under:

```text
server/agent/
```

Current agent-related files include:

```text
foodAgent.ts
gemini.ts
instructions.ts
intent.ts
localAgent.ts
model.ts
modelErrors.ts
schemas.ts
search.ts
simulation.ts
```

Keep responsibilities separated.

For example:

* `intent.ts` should deal with understanding the user's request.
* `search.ts` should deal with finding/matching relevant options.
* `simulation.ts` should deal with simulated pricing/delivery behavior.
* `schemas.ts` should define or support structured validation.
* `model.ts` / `gemini.ts` should handle model-related integration.
* `instructions.ts` should contain agent instructions rather than duplicating them throughout route handlers.

Do not move all agent logic into a single large file.

---

# Agent behavior

The agent can help interpret:

* Cravings
* Occasions
* Restaurant searches
* Budget constraints
* Dietary preferences
* Meal preferences

The agent should use structured application data whenever it is available.

Do not let model-generated text invent factual restaurant information.

In particular, never hallucinate:

* Prices
* Discounts
* Delivery fees
* Restaurant availability
* Delivery availability
* ETAs
* Source URLs
* Menu items that are not in the available data

If the system only has simulated information, the agent should describe it as simulated.

---

# Server architecture

The backend is an Express/TypeScript application under:

```text
server/
```

Use the existing directory responsibilities.

## Routes

API routes live under:

```text
server/routes/
```

Current routes include:

```text
server/routes/chat.ts
server/routes/plan.ts
```

Keep route handlers focused on HTTP concerns.

Do not put large ranking algorithms, model logic, or database implementations directly into route handlers if an existing module already owns that responsibility.

---

# Providers

Provider-related logic lives under:

```text
server/providers/
```

Current files include:

```text
mock.ts
types.ts
```

Provider implementations should follow the existing provider abstraction.

Keep provider-specific behavior isolated.

When adding another provider:

1. Reuse the provider types.
2. Return the same shared offer/quote structure.
3. Keep provider-specific pricing and ETA information together.
4. Preserve the simulated/live distinction.
5. Add tests for the new provider behavior.

Do not spread provider-specific conditionals throughout the frontend.

---

# Data

Demo/provider data currently lives under:

```text
server/data/
```

Current data includes:

```text
offers.json
quotes.json
three-platform-demo.json
```

There are also source/menu data files used by the application.

Treat these files as data sources, not as business logic.

Do not hard-code the same restaurant/provider information again inside React components or route handlers.

When changing demo data, check the corresponding schemas and tests.

---

# Database

Database code currently lives under:

```text
server/db/
```

with:

```text
server/db/mongo.ts
```

Keep database access behind the existing database layer.

Do not access MongoDB directly from routes when the existing database abstraction can be reused.

Do not put MongoDB connection strings or credentials into source code.

Use environment variables for database configuration.

---

# Middleware and security

Security-related middleware currently lives under:

```text
server/middleware/security.ts
```

Preserve the existing security behavior.

Do not bypass middleware for convenience.

In particular:

* Keep input validation enabled.
* Keep security headers enabled.
* Keep CORS behavior intentional.
* Keep rate limiting or request protection if already present.
* Return safe JSON errors.
* Never expose secrets.

---

# Shared contracts

Client/server shared definitions live under:

```text
shared/
├── intent.ts
├── quotes.ts
└── schemas.ts
```

These shared files should be treated as the contract between the frontend and backend.

When changing an API shape:

1. Update the shared type/schema.
2. Update the server implementation.
3. Update the client API helper.
4. Update affected components.
5. Update tests.

Do not maintain slightly different versions of the same API contract in multiple places.

---

# API communication

The main frontend API helpers are:

```text
client/src/api/chat.ts
client/src/api/plan.ts
client/src/api/request.ts
```

Use these helpers for their respective API operations.

Do not scatter raw `fetch()` calls throughout the component tree.

If request behavior such as headers, error handling, or base URL handling already exists in `request.ts`, reuse it.

---

# Testing

The backend currently has dedicated tests under:

```text
server/test/
```

including tests for:

```text
agent.test.ts
app.test.ts
menu.test.ts
quotes.test.ts
restaurant-ranking.test.ts
simulation.test.ts
three-platform.test.ts
```

These tests cover important parts of the application's behavior.

When changing a ranking, quote, simulation, agent, menu, or provider-related feature, check the corresponding existing tests before changing implementation.

Do not delete or weaken tests just to make a change pass.

Add focused tests when a new behavior introduces a meaningful edge case.

---

# What to test

## Search and planning

Verify that:

* A normal search request works.
* Budget constraints are passed correctly.
* Dietary preferences are passed correctly.
* Quick-search actions use the same underlying search flow.
* Invalid input produces a useful error.
* Empty results are handled gracefully.

## Restaurant ranking

Verify that:

* Restaurants are matched according to the existing ranking logic.
* Budget constraints are respected.
* Dietary constraints are respected.
* The best match for each restaurant is selected consistently.
* Ranking is deterministic.
* Provider options remain associated with the correct restaurant/meal.

## Simulation

Verify that:

* Simulated totals are internally consistent.
* Delivery options can have different totals.
* Tips are not double-counted.
* Discounts are subtracted.
* Delivery and service fees are not double-counted.
* ETAs remain associated with the correct provider.
* Simulated data stays clearly identified as simulated.

## Agent

Verify that:

* User intent is parsed into the existing structured representation.
* Agent responses remain consistent with available restaurant data.
* The agent does not invent unsupported prices or availability.
* Model failures are handled through the existing error path.

---

# Build and validation

Before making assumptions about available scripts, inspect the relevant `package.json`.

At the repository level, use the existing npm scripts.

A typical validation sequence is:

```bash
npm run build
npm test
```

If a change only affects the client, run the client build/type checks first.

If a change only affects the server, run the relevant server tests first.

For API changes, also smoke-test the affected endpoint with a representative request.

For UI changes, manually verify the affected user flow rather than relying only on a successful TypeScript build.

---

# Responsive design

The current product is designed primarily as a desktop comparison experience but should remain usable on smaller screens.

Pay particular attention to:

* Search/planning controls
* Budget and dietary fields
* Restaurant-card grids
* Platform comparison rows
* Long restaurant names
* Long meal descriptions
* Price breakdowns
* Detail-page imagery
* `Keep comparing`
* `Save offer`

Avoid simply shrinking everything to make a desktop layout fit on mobile.

Use meaningful layout changes at responsive breakpoints.

Do not introduce horizontal scrolling unless the interaction genuinely requires it.

---

# Accessibility

Keep the existing UI accessible as features are added.

* Use semantic HTML.
* Associate labels with form controls.
* Provide accessible names for icon-only buttons.
* Do not use color as the only way to identify the best option.
* Maintain sufficient contrast.
* Preserve visible focus states.
* Keep interactive elements keyboard accessible.
* Give informative images useful alt text.
* Use empty alt text for purely decorative imagery.

Search, filtering, saving, and comparison actions should remain understandable without relying only on visual styling.

---

# State management

Keep transient UI state close to the component that owns it.

Examples include:

* Expanded price breakdowns
* Selected restaurant
* Selected provider
* Save/favorite state
* Detail view state
* Temporary form values

Do not introduce global state just to avoid passing a small amount of data between related components.

Before adding a state-management library, check whether the existing React state/props structure already solves the problem.

---

# Error and empty states

The product should handle:

* No matching restaurants
* No matching meals
* Invalid budget
* Invalid search input
* Unsupported dietary preferences
* API failures
* Provider failures
* Incomplete pricing data
* Missing source information

Keep user-facing errors concise and understandable.

Do not expose:

* Stack traces
* Database errors
* Internal file paths
* API keys
* Model-provider credentials
* Raw exception messages that reveal implementation details

---

# Environment variables and secrets

The repository contains:

```text
.env.example
```

Use environment variables for deployment-specific configuration.

Never commit:

* API keys
* Gemini/model credentials
* MongoDB credentials
* Connection strings containing secrets
* Authentication secrets

Do not expose server-only environment variables through the Vite client.

Only expose frontend environment variables that are intentionally safe to make public.

---

# Generated files

Do not manually edit generated frontend output under:

```text
client/dist/
```

Make source changes under:

```text
client/src/
```

and regenerate the build when necessary.

Avoid committing generated changes unless the repository's existing workflow explicitly requires them.

---

# Collaboration

This is a shared team repository, so keep changes focused.

Before modifying shared code:

* Check how it is currently used.
* Avoid unrelated refactors.
* Avoid broad formatting changes.
* Do not overwrite another contributor's work.
* Preserve existing component interfaces unless the task requires changing them.
* Update all affected consumers when changing a shared schema or API response.

If a cleaner architecture would require a large refactor, prefer a small compatible change unless the refactor is explicitly requested.

---

# Copilot working style

When asked to implement something, follow this order:

1. Inspect the existing implementation.
2. Find the component, API helper, route, provider, agent module, or shared schema that already owns the behavior.
3. Reuse the existing abstraction if possible.
4. Check how the same data is represented elsewhere.
5. Make the smallest change that solves the problem.
6. Preserve the current MealWise visual language.
7. Preserve the simulated-data disclosures.
8. Run the narrowest relevant validation.
9. Check the affected user flow for regressions.

Do not create a new pattern when an existing pattern already works.

Do not rewrite unrelated parts of the application just to make the code look cleaner.

When adding UI, make it look like it was designed as part of the existing MealWise product.

When changing pricing or ranking behavior, check the corresponding backend logic, shared schemas, and tests rather than fixing only the visible frontend symptom.

When working with agent-generated content, always prefer structured application data over model-generated guesses.

The goal is to keep MealWise coherent across the frontend, backend, agent, provider, simulation, and shared-schema layers.

