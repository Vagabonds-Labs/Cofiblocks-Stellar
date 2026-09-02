// app/api/stripe/products/route.ts
import { HttpException } from "@/exceptions/HttpException";
import { logger } from "@/lib/logger";
import { stripe } from "@/lib/Stripe/stripe_client";
import Stripe from "stripe";

export enum StripeWebhookEvent {
  CHECKOUT_SESSION_COMPLETED = "checkout.session.completed",
  PAYMENT_INTENT_SUCCEEDED = "payment_intent.succeeded",
}

export async function createStripeProduct(name: string, description: string, priceUSD: number, imageUrl: string) {
  let product;
  if (imageUrl) {
    product = await stripe.products.create({
      name,
      description,
      images: [imageUrl],
      metadata: {
        project: "cofiblocks",
        project_id: "cofiblocks-prod",
      },
    });
  } else {
    product = await stripe.products.create({
      name,
      description,
      metadata: {
        project: "cofiblocks",
        project_id: "cofiblocks-prod",
      },
    });
  }

  const priceCents = priceUSD * 100;

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: priceCents,
    currency: "usd",
    metadata: {
      project: "cofiblocks",
    },
  });

  return { productId: product.id, priceId: price.id};
}

export async function disableStripeProduct(productId: string) {
  await stripe.products.update(productId, {
    active: false,
  });
}

export interface StripeLineItem {
  price: string;
  quantity: number;
}
export async function createStripeCheckoutSession(lineItems: StripeLineItem[], internal_orderId: string):
 Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    currency: "usd",
    line_items: lineItems,
    success_url: `${process.env.FRONTEND_URL}/checkout/${internal_orderId}/stripe-callback`,
    cancel_url: `${process.env.FRONTEND_URL}/checkout/${internal_orderId}`,
    metadata: {
      order_id: internal_orderId,
      project: "cofiblocks",
    },
    payment_intent_data: {
      metadata: {
        order_id: internal_orderId,
        project: "cofiblocks",
      },
    },
  });

  if (!session.url) {
    throw new HttpException(500, 'Failed to create stripe checkout session', 'FAILED_TO_CREATE_STRIPE_CHECKOUT_SESSION');
  }

  return session.url;
}
