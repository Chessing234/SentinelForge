import { NextResponse } from "next/server";

import { handleWebhookEvent, getStripe } from "@/lib/billing/stripe";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const sig = request.headers.get("stripe-signature");

  if (!stripe || !secret) {
    log.warn("stripe.webhook.disabled", {});
    return NextResponse.json({ received: true });
  }

  const rawBody = await request.text();
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: import("stripe").Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (e) {
    log.error("stripe.webhook.signature", {}, e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await handleWebhookEvent(event).catch((err) => {
    log.error("stripe.webhook.handle", { type: event.type, id: event.id }, err);
  });

  return NextResponse.json({ received: true });
}
