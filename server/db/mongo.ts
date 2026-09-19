import { randomUUID } from 'node:crypto';
import { MongoClient, type Collection } from 'mongodb';
import type { ChatRequest, PlanResponse } from '../../shared/schemas.js';

type StoredPlan = {
  _id?: string;
  conversationId: string;
  request: ChatRequest;
  response: PlanResponse;
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
  saveConversationTurn(conversationId: string, request: ChatRequest, reply: string, plan: PlanResponse): Promise<void>;
  close(): Promise<void>;
}

class MemoryStore implements MealWiseStore {
  private readonly messages: StoredMessage[] = [];
  private readonly plans: StoredPlan[] = [];

  async saveConversationTurn(conversationId: string, request: ChatRequest, reply: string, plan: PlanResponse) {
    const createdAt = new Date();
    this.messages.push({ _id: randomUUID(), conversationId, role: 'user', content: request.message, createdAt });
    this.messages.push({ _id: randomUUID(), conversationId, role: 'assistant', content: reply, createdAt });
    this.plans.push({ _id: randomUUID(), conversationId, request, response: plan, createdAt });
  }

  async close() {}
}

class MongoStore implements MealWiseStore {
  constructor(
    private readonly client: MongoClient,
    private readonly messages: Collection<StoredMessage>,
    private readonly plans: Collection<StoredPlan>
  ) {}

  async saveConversationTurn(conversationId: string, request: ChatRequest, reply: string, plan: PlanResponse) {
    const createdAt = new Date();
    await this.messages.insertMany([
      { conversationId, role: 'user', content: request.message, createdAt },
      { conversationId, role: 'assistant', content: reply, createdAt }
    ]);
    await this.plans.insertOne({ conversationId, request, response: plan, createdAt });
  }

  async close() {
    await this.client.close();
  }
}

export async function createStore(uri = process.env.MONGODB_URI, databaseName = process.env.MONGODB_DATABASE || 'mealwise') {
  if (!uri) return new MemoryStore();
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  const database = client.db(databaseName);
  const messages = database.collection<StoredMessage>('conversation_messages');
  const plans = database.collection<StoredPlan>('plans');
  await Promise.all([
    messages.createIndex({ conversationId: 1, createdAt: 1 }),
    plans.createIndex({ conversationId: 1, createdAt: -1 })
  ]);
  return new MongoStore(client, messages, plans);
}
