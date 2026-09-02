import { Router, Request, Response } from 'express';
import { stripe } from '@/lib/Stripe/stripe_client';
import Stripe from 'stripe';
import { HttpException } from '@/exceptions/HttpException';

import { logger } from '@/lib/logger';
import { successResponse } from '@/utils/formatting';
import { processOrderStripePayment } from '@/services/app/OrdersService';

const router = Router();

router.post("/webhook", async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
  
    if (!sig) {
      throw new HttpException(400, "Missing Stripe signature", "MISSING_STRIPE_SIGNATURE");
    }
  
    let event;
  
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      logger.error("❌ Webhook signature failed: " + err.message);
      throw new HttpException(400, "Invalid signature", "INVALID_SIGNATURE");
    }
  
    logger.info("✅ Stripe event verified: " + event.type);
  
    const eventData = event.data.object as Stripe.PaymentIntent;
    if (event.type === "checkout.session.completed") {
        // This is not used anymore, we use payment_intent.succeeded instead
    }

    if (event.type === "payment_intent.succeeded") {
        logger.info('Processing stripe payment intent succeeded');
        const paymentIntentId = eventData.id;
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        const order_id = pi.metadata.order_id 
        const amount_usd = pi.amount_received / 100; // because original amount is in cents
        await processOrderStripePayment(order_id, paymentIntentId, amount_usd);
    }
  
    successResponse(res, null, "Stripe webhook handled successfully", 200);
  });

export default router;