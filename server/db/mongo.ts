import { randomUUID } from 'node:crypto';
import { MongoClient, type Collection } from 'mongodb';
import type { ChatRequest, PlanResponse } from '../../shared/schemas.js';
import { conversationContextSchema, type ConversationContext } from '../../shared/intent.js';
import type { FoodIntent } from '../../shared/intent.js';

type StoredPlan = {
  _id?: string;
  conversationId: string;
  request: ChatRequest;
  response: PlanResponse;
  context?: ConversationContext;
  createdAt: Date;
};

type StoredMessage = {
  _id?: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
};

export interface MealWiseStore {
  listQuotes?(intent?: FoodIntent, signal?: AbortSignal): Promise<unknown[]>;
  getConversationContext(conversationId: string): Promise<ConversationContext | null>;
  saveConversationTurn(conversationId: string, request: ChatRequest, reply: string, plan: PlanResponse, context?: ConversationContext): Promise<void>;
  close(): Promise<void>;
}

class MemoryStore implements MealWiseStore {
  private readonly messages: StoredMessage[] = [];
  private readonly plans: StoredPlan[] = [];

  async getConversationContext(conversationId: string) {
    const saved = this.plans.filter((plan) => plan.conversationId === conversationId).at(-1);
    return saved?.context ? structuredClone(saved.context) : null;
  }

  async saveConversationTurn(conversationId: string, request: ChatRequest, reply: string, plan: PlanResponse, context?: ConversationContext) {
    const createdAt = new Date();
    this.messages.push({ _id: randomUUID(), conversationId, role: 'user', content: request.message, createdAt });
    this.messages.push({ _id: randomUUID(), conversationId, role: 'assistant', content: reply, createdAt });
    this.plans.push({ _id: randomUUID(), conversationId, request, response: plan, context, createdAt });
    // The development store is intentionally disposable and bounded.
    if (this.plans.length > 1000) this.plans.splice(0, this.plans.length - 1000);
    if (this.messages.length > 2000) this.messages.splice(0, this.messages.length - 2000);
  }

  async close() {}
}

class MongoStore implements MealWiseStore {
  constructor(
    private readonly client: MongoClient,
    private readonly messages: Collection<StoredMessage>,
    private readonly plans: Collection<StoredPlan>,
    private readonly quotes: Collection
  ) {}

  async listQuotes(intent?: FoodIntent, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const location = intent?.location;
    const query = location ? { 'restaurant.city': { $regex: `^${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } } : {};
    return this.quotes.find(query, { projection: { _id: 0 }, maxTimeMS: 4000, signal }).toArray();
  }

  async getConversationContext(conversationId: string) {
    const saved = await this.plans.findOne({ conversationId }, { sort: { createdAt: -1, _id: -1 } });
    const parsed = conversationContextSchema.safeParse(saved?.context);
    return parsed.success ? parsed.data : null;
  }

  async saveConversationTurn(conversationId: string, request: ChatRequest, reply: string, plan: PlanResponse, context?: ConversationContext) {
    const createdAt = new Date();
    await this.messages.insertMany([
      { conversationId, role: 'user', content: request.message, createdAt },
      { conversationId, role: 'assistant', content: reply, createdAt }
    ]);
    await this.plans.insertOne({ conversationId, request, response: plan, context, createdAt });
  }

  async close() {
    await this.client.close();
  }
}

export async function createStore(uri = process.env.MONGODB_URI, databaseName = process.env.MONGODB_DATABASE || 'mealwise') {
  if (!uri) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MONGODB_URI must be configured in production.');
    }
    return new MemoryStore();
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  const database = client.db(databaseName);
  const messages = database.collection<StoredMessage>('conversation_messages');
  const plans = database.collection<StoredPlan>('plans');
  await Promise.all([
    messages.createIndex({ conversationId: 1, createdAt: 1 }),
    plans.createIndex({ conversationId: 1, createdAt: -1 })
  ]);
  return new MongoStore(client, messages, plans, database.collection('quotes'));
}
