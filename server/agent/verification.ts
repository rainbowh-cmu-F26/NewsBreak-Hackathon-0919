import rawOffers from '../data/demo-data.json' with { type: 'json' };
import { deliveryOptionSchema, type DeliveryOption } from '../../shared/schemas.js';

const verifiedOfferSchema = deliveryOptionSchema.extend({
  price: deliveryOptionSchema.shape.price.refine((price) => Number.isFinite(price)),
  originalPrice: deliveryOptionSchema.shape.originalPrice.refine((price) => Number.isFinite(price)),
  fee: deliveryOptionSchema.shape.fee.refine((fee) => Number.isFinite(fee)),
}).superRefine((offer, context) => {
  if (offer.originalPrice < offer.price) {
    context.addIssue({ code: 'custom', path: ['originalPrice'], message: 'Original price cannot be below current price.' });
  }
  if (!offer.available) {
    context.addIssue({ code: 'custom', path: ['available'], message: 'Unavailable offers cannot be recommended.' });
  }
  if (!offer.verified) {
    context.addIssue({ code: 'custom', path: ['verified'], message: 'Only verified offers can be recommended.' });
  }
});

const parsedOffers = verifiedOfferSchema.array().safeParse(rawOffers);
if (!parsedOffers.success) {
  throw new Error(`Demo offer verification failed: ${parsedOffers.error.message}`);
}

export const verifiedOffers: DeliveryOption[] = parsedOffers.data;
