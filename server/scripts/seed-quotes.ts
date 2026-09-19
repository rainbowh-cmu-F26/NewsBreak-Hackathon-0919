import { readFileSync } from 'node:fs';
import { MongoClient } from 'mongodb';
import { quoteSchema } from '../../shared/quotes.js';
if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before importing quotes.');
const file = process.argv[2];
const quotes = quoteSchema.array().parse(JSON.parse(readFileSync(file || new URL('../data/quotes.json', import.meta.url), 'utf8')));
const client = new MongoClient(process.env.MONGODB_URI);
try {
  await client.connect();
  const collection = client.db(process.env.MONGODB_DATABASE || 'mealwise').collection('quotes');
  for (const quote of quotes) {
    const document = { ...quote, captured_at: quote.captured_at ? new Date(quote.captured_at) : null };
    await collection.updateOne({ comparison_key: quote.comparison_key, platform: quote.platform, location_id: quote.location_id, account_context_id: quote.account_context_id, fulfillment: quote.fulfillment, delivery_speed: quote.delivery_speed, membership: quote.membership, customer_status: quote.customer_status, data_type: quote.data_type, captured_at: document.captured_at }, { $set: document }, { upsert: true });
  }
  console.log(`Imported ${quotes.length} validated quote records.`);
} finally { await client.close(); }
