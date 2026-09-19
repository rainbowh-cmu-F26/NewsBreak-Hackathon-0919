import type { ChatRequest } from '../../shared/schemas.js';
import { intentSchema, type ConversationContext, type FoodIntent } from '../../shared/intent.js';
import { cuisineGroups, normalizeIntent } from './vocabulary.js';

const cuisineAliases: Record<string, string> = {
  ...Object.fromEntries(Object.keys(cuisineGroups).map((term) => [term, term])),
  chinese: 'chinese', mexican: 'mexican', thai: 'thai', vietnamese: 'vietnamese',
  indian: 'indian', italian: 'italian', japanese: 'japanese', korean: 'korean',
  mediterranean: 'mediterranean', american: 'american', ethiopian: 'ethiopian',
};
const foodAliases: Record<string, string> = {
  noodles: 'noodles', noodle: 'noodles', tacos: 'tacos', taco: 'tacos', pizza: 'pizza',
  sushi: 'sushi', burger: 'burger', burgers: 'burger', sandwiches: 'sandwiches',
  sandwich: 'sandwiches', curry: 'curry', rice: 'rice', salad: 'salad', ramen: 'ramen',
  chicken: 'chicken', beef: 'beef', pork: 'pork', seafood: 'seafood', tofu: 'tofu',
};
const ingredientAliases: Record<string, string> = {
  ...foodAliases, peanuts: 'peanut', peanut: 'peanut', nut: 'tree-nut', nuts: 'tree-nut', 'tree nut': 'tree-nut', 'tree nuts': 'tree-nut',
  dairy: 'milk', milk: 'milk', cheese: 'milk', eggs: 'egg', egg: 'egg',
  gluten: 'gluten', wheat: 'wheat', soy: 'soy', shellfish: 'shellfish', shrimp: 'shellfish',
  fish: 'fish', sesame: 'sesame', mushrooms: 'mushroom', mushroom: 'mushroom',
  onions: 'onion', onion: 'onion', cilantro: 'cilantro', spicy: 'spicy', garlic: 'garlic',
  almonds: 'tree-nut', cashews: 'tree-nut', walnuts: 'tree-nut',
};
const numbers: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const unique = (values: string[]) => [...new Set(values)];
const escape = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A conservative offline parser. The model handles language outside this vocabulary.
function mentions(text: string, aliases: Record<string, string>) {
  const positive: string[] = [];
  const negative: string[] = [];
  const removed: string[] = [];
  for (const [alias, canonical] of Object.entries(aliases)) {
    for (const match of text.matchAll(new RegExp(`\\b${escape(alias)}\\b`, 'g'))) {
      const prefix = text.slice(Math.max(0, match.index! - 65), match.index);
      const suffix = text.slice(match.index! + alias.length, match.index! + alias.length + 28);
      const negation = prefix.match(/\b(?:no|not|without|avoid|exclude|allergic to|allergy to)\s+([^.!?;]*)$/);
      let precedingList = negation?.[1] ?? '';
      for (const term of Object.keys(aliases).sort((a, b) => b.length - a.length)) precedingList = precedingList.replace(new RegExp(`\\b${escape(term)}\\b`, 'g'), '');
      const isNegated = !!negation && !precedingList.replace(/\b(?:and|or|any)\b|[,\s]/g, '');
      if (/\b(?:allow|include|okay with|ok with)\s+$/.test(prefix) || /^\s+(?:is|are)\s+(?:okay|ok|fine)\b/.test(suffix)) removed.push(canonical);
      else if ((isNegated && !/^\s+instead\b/.test(suffix)) || /^[- ]free\b/.test(suffix)) negative.push(canonical);
      else positive.push(canonical);
    }
  }
  return { positive: unique(positive), negative: unique(negative), removed: unique(removed) };
}

export function baseIntent(request: ChatRequest, previous?: ConversationContext | null): FoodIntent {
  const changedDiet = !previous || previous.formDietary !== request.dietary;
  const formDiet = request.dietary === 'Gluten-aware' ? ['gluten-free' as const]
    : request.dietary === 'Vegan' ? ['vegan' as const]
    : request.dietary === 'Vegetarian' ? ['vegetarian' as const] : [];
  return intentSchema.parse({
    budget: request.budget, dietary: formDiet, cuisines: [], excludedCuisines: [], foods: [],
    excludedIngredients: [], allergens: [], deals: [], providers: [], servings: 1,
    maxEtaMinutes: null, sortBy: 'best-value', newCustomer: null, location: 'Mountain View',
    ...previous?.intent,
    ...(!previous || previous.formBudget !== request.budget ? { budget: request.budget } : {}),
    ...(changedDiet ? { dietary: formDiet } : {}),
  });
}

export function extractLocal(request: ChatRequest, previous?: ConversationContext | null) {
  const text = request.message.toLowerCase().replace(/[’]/g, "'").replace(/don't want|do not want|can't eat|cannot eat/g, 'avoid');
  const reset = /\b(start over|reset (?:my |the )?(?:search|filters)|new search)\b/.test(text);
  const intent = structuredClone(baseIntent(request, reset ? null : previous));
  let clarification: string | null = null;
  const preferenceText = (text.match(/\b(?:preferably|ideally|if possible)[^.!?;]*/g) ?? []).join(' ');
  const requiredText = text.replace(/\b(?:preferably|ideally|if possible)[^.!?;]*/g, '');
  const budget = text.match(/(?:under|below|less than|up to|at most|budget(?: of| is)?|max(?:imum)?(?: of)?)\s*\$?\s*(\d+(?:\.\d{1,2})?)(?![\d.])(?:\s*(dollars?|bucks?))?/)
    ?? text.match(/\$\s*(\d+(?:\.\d{1,2})?)/)
    ?? text.match(/(\d+(?:\.\d{1,2})?)\s*(?:dollars?|bucks?)\b/);
  // A number attached to minutes is an ETA, not a dollar budget.
  if (budget && !/^\s*(?:minutes?|mins?)\b/.test(text.slice(budget.index! + budget[0].length))) {
    const value = Number(budget[1]);
    if (value > 0 && value <= 500) intent.budget = value;
    else clarification = 'What total budget should I use, between $0.01 and $500?';
  }
  const servingMatch = text.match(/\b(?:for|feed|serves?|feeding)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  if (servingMatch) {
    const value = numbers[servingMatch[1]] ?? Number(servingMatch[1]);
    if (value >= 1 && value <= 20) intent.servings = value;
    else clarification = 'How many people are eating? I can price meals for 1 to 20 people.';
  }
  if (budget && /\b(?:each|per person|a person)\b/.test(text)) {
    intent.budget *= intent.servings;
    if (intent.budget > 500) { intent.budget = 500; clarification = 'The group budget exceeds $500. What total budget of $500 or less should I use?'; }
  }
  const eta = text.match(/\b(?:under|within|less than|in|at most)\s*(\d+)\s*(?:minutes?|mins?)\b/);
  if (eta) {
    const value = Number(eta[1]);
    if (value > 0 && value <= 180) intent.maxEtaMinutes = value;
    else clarification = 'What delivery window should I use, from 1 to 180 minutes?';
  }
  if (/\b(no time limit|any delivery time)\b/.test(text)) intent.maxEtaMinutes = null;
  if (/\b(cheaper|cheapest|lowest price|less expensive)\b/.test(text)) {
    intent.sortBy = 'cheapest';
    if (!budget && /\b(cheaper|less expensive)\b/.test(text) && previous?.lastBestTotal) {
      intent.budget = Math.min(intent.budget, Math.max(0.01, Number((previous.lastBestTotal - 0.01).toFixed(2))));
    }
  }
  if (/\b(fastest|quickest)\b/.test(text)) intent.sortBy = 'fastest';
  if (/\b(best value|biggest savings)\b/.test(text)) intent.sortBy = 'best-value';

  const dietAliases = { vegan: 'vegan', vegetarian: 'vegetarian', 'gluten-free': 'gluten-free', 'gluten free': 'gluten-free', 'dairy-free': 'dairy-free', 'dairy free': 'dairy-free', halal: 'halal', kosher: 'kosher' };
  const diets = mentions(requiredText, dietAliases);
  if (preferenceText) {
    intent.preferredDietary = mentions(preferenceText, dietAliases).positive as FoodIntent['preferredDietary'];
    intent.preferredCuisines = mentions(preferenceText, cuisineAliases).positive;
    intent.preferredFoods = mentions(preferenceText, foodAliases).positive;
  }
  if (/\b(no dietary restrictions|any diet)\b/.test(text)) intent.dietary = [];
  intent.dietary = unique([...intent.dietary, ...diets.positive]).filter((diet) => !diets.negative.includes(diet)) as FoodIntent['dietary'];
  if (/\b(no meat|meat[- ]free)\b/.test(text) && !intent.dietary.includes('vegetarian')) intent.dietary.push('vegetarian');
  if (/\b(lactose intoleran\w*|lactose[- ]free)\b/.test(text) && !intent.dietary.includes('dairy-free')) intent.dietary.push('dairy-free');
  if (/\b(?:vegetarian instead|actually vegetarian)\b/.test(text)) intent.dietary = intent.dietary.filter((diet) => diet !== 'vegan');

  const cuisine = mentions(requiredText, cuisineAliases);
  if (cuisine.positive.some((term) => term.endsWith(' asian'))) cuisine.positive = cuisine.positive.filter((term) => term !== 'asian');
  if (cuisine.negative.some((term) => term.endsWith(' asian'))) cuisine.negative = cuisine.negative.filter((term) => term !== 'asian');
  if (cuisine.positive.length) intent.cuisines = cuisine.positive;
  if (/\b(any cuisine|all cuisines)\b/.test(text)) intent.cuisines = [];
  intent.excludedCuisines = unique([...intent.excludedCuisines, ...cuisine.negative]).filter((value) => !cuisine.removed.includes(value) && !cuisine.positive.includes(value));
  intent.cuisines = intent.cuisines.filter((value) => !intent.excludedCuisines.includes(value));

  const foods = mentions(requiredText, foodAliases);
  if (foods.positive.length) intent.foods = foods.positive;
  if (/\b(any food|anything to eat)\b/.test(text)) intent.foods = [];
  const ingredients = mentions(requiredText, ingredientAliases);
  intent.excludedIngredients = unique([...intent.excludedIngredients, ...ingredients.negative]).filter((value) => !ingredients.removed.includes(value));
  intent.foods = intent.foods.filter((value) => !intent.excludedIngredients.includes(value));
  const allergy = text.match(/\b(?:allergic to|allergy to)\s+([^.!?;]+)/);
  if (allergy) {
    const found = mentions(allergy[1], ingredientAliases).positive;
    if (found.length) intent.allergens = unique([...intent.allergens, ...found]);
    else clarification = 'Which ingredient are you allergic to? Please name it explicitly.';
  }
  for (const [alias, canonical] of Object.entries(ingredientAliases)) {
    if (new RegExp(`\\b${escape(alias)}\\s+allerg(?:y|ies)\\b`).test(text)) intent.allergens = unique([...intent.allergens, canonical]);
  }
  if (intent.allergens.includes('tree-nut') && /\bnut(?:s)? allerg/.test(text)) intent.allergens = unique([...intent.allergens, 'peanut']);
  if (/\b(?:nut[- ]free|no nuts)\b/.test(text)) intent.excludedIngredients = unique([...intent.excludedIngredients, 'peanut', 'tree-nut']);
  if (/\bno allergies\b/.test(text)) intent.allergens = [];

  const deals = mentions(text, { bogo: 'bogo', 'buy one get one': 'bogo', 'buy 1 get 1': 'bogo', '2-for-1': 'bogo', 'two for one': 'bogo', discount: 'discount', discounts: 'discount', 'free delivery': 'free-delivery', 'no delivery fee': 'free-delivery' });
  if (deals.positive.length) intent.deals = deals.positive as FoodIntent['deals'];
  intent.deals = intent.deals.filter((deal) => !deals.negative.includes(deal));
  if (/\b(any deal|no deal preference|deals? (?:do not|don't) matter)\b/.test(text)) intent.deals = [];
  const providers = mentions(text, { 'uber eats': 'uber-eats', ubereats: 'uber-eats', doordash: 'doordash', 'door dash': 'doordash', grubhub: 'grubhub', 'grub hub': 'grubhub' });
  if (providers.positive.length) intent.providers = providers.positive as FoodIntent['providers'];
  if (providers.negative.length) intent.providers = (intent.providers.length ? intent.providers : ['uber-eats', 'doordash', 'grubhub']).filter((provider) => !providers.negative.includes(provider)) as FoodIntent['providers'];
  if (/\b(any (?:app|platform|provider))\b/.test(text)) intent.providers = [];
  if (/\b(not a new|existing|returning) customer\b/.test(text)) intent.newCustomer = false;
  else if (/\b(new customer|first order|first time ordering)\b/.test(text)) intent.newCustomer = true;
  const location = text.match(/\b(?:deliver to|delivery to|located in)\s+([a-z ]+?)(?:[,.!?]|$)/);
  if (location) intent.location = location[1].trim();
  // Unsupported constraints should prompt for help instead of silently broadening.
  if (/\b(keto|paleo|pescatarian|low sodium|low carb|diabetic|celiac|coeliac|organic)\b/.test(text)) clarification = 'The demo catalog cannot verify that restriction. Could you specify ingredients to exclude?';
  if (/\b(?:under|budget(?: is| of)?)\s+(?:ten|fifteen|twenty|thirty|forty|fifty)\b/.test(text)) clarification = 'Please enter the budget as a number, for example “under $20”.';
  if (/\ballerg(?:y|ies|ic)\b/.test(text) && !intent.allergens.length && !/\bno allergies\b/.test(text)) clarification = 'Which ingredient are you allergic to? Please name it explicitly, for example “allergic to peanuts”.';
  const recognized = /\b(food|meal|dinner|lunch|breakfast|hungry|eat|something|anything|options|recommend|cheaper|cheapest|fastest|start over|reset|new search|customer|order|budget|delivery|deliver)\b/.test(text)
    || [...Object.keys(cuisineAliases), ...Object.keys(ingredientAliases), ...['vegan', 'vegetarian', 'gluten', 'halal', 'kosher', 'bogo']].some((term) => new RegExp(`\\b${escape(term)}\\b`).test(text))
    || !!budget || !!eta || !!servingMatch || !!previous;
  if (!recognized) clarification = 'What would you like to eat? Include a cuisine, dietary preference, or budget so I can search the demo catalog.';
  const parsed = intentSchema.safeParse(intent);
  if (!parsed.success) return { intent: baseIntent(request, previous), clarification: 'That request contains more constraints than I can handle at once. Please narrow the list and try again.' };
  return { intent: normalizeIntent(parsed.data), clarification };
}
