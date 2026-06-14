import Stripe from "stripe";

import { log } from "@/lib/logger";
import {
  claimStripeWebhookEvent,
  getOrganizationByStripeCustomerId,
  getOrganizationByStripeSubscriptionId,
  updateOrganizationBilling,
} from "@/db/queries";

const ACADEMIC_SEAT_USD = 50;
const ENTERPRISE_SEAT_USD = 500;

export function academicSeatPriceCents(): number {
  return ACADEMIC_SEAT_USD * 100;
}

export function enterpriseSeatPriceCents(): number {
  return ENTERPRISE_SEAT_USD * 100;
}

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

export function priceIdForPlan(plan: "academic" | "enterprise", billing: "monthly" | "annual"): string {
  const envKey =
    plan === "academic"
      ? billing === "annual"
        ? "STRIPE_PRICE_ACADEMIC_ANNUAL"
        : "STRIPE_PRICE_ACADEMIC_MONTHLY"
      : billing === "annual"
        ? "STRIPE_PRICE_ENTERPRISE_ANNUAL"
        : "STRIPE_PRICE_ENTERPRISE_MONTHLY";
  const id = process.env[envKey]?.trim();
  if (!id) {
    throw new Error(`${envKey} is not configured`);
  }
  return id;
}

export async function createCustomer(params: {
  organizationId: number;
  email: string;
  name: string;
}): Promise<Stripe.Customer> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const customer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: { organizationId: String(params.organizationId) },
  });
  await updateOrganizationBilling(params.organizationId, {
    stripeCustomerId: customer.id,
  });
  return customer;
}

export async function createSubscription(
  customerId: string,
  priceId: string,
  quantity: number,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId, quantity }],
    metadata: { quantity: String(quantity) },
  });
}

export async function updateSubscriptionQuantity(
  subscriptionId: string,
  quantity: number,
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const itemId = sub.items.data[0]?.id;
  if (!itemId) throw new Error("Subscription has no items");
  return stripe.subscriptions.update(subscriptionId, {
    items: [{ id: itemId, quantity }],
  });
}

export async function cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  return stripe.subscriptions.cancel(subscriptionId);
}

export async function getInvoices(customerId: string): Promise<Stripe.Invoice[]> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const list = await stripe.invoices.list({ customer: customerId, limit: 24 });
  return list.data;
}

export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  quantity: number;
  organizationId: number;
  plan: "academic" | "enterprise";
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: params.customerId,
    line_items: [{ price: params.priceId, quantity: params.quantity }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    client_reference_id: String(params.organizationId),
    subscription_data: {
      metadata: {
        organizationId: String(params.organizationId),
        plan: params.plan,
        seats: String(params.quantity),
      },
    },
    metadata: {
      organizationId: String(params.organizationId),
      plan: params.plan,
      seats: String(params.quantity),
    },
  });
  if (!session.url) throw new Error("Checkout session missing URL");
  return session.url;
}

export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
  return session.url;
}

async function syncOrgFromSubscription(sub: Stripe.Subscription): Promise<void> {
  const org = await getOrganizationByStripeSubscriptionId(sub.id);
  if (!org) return;
  const item = sub.items.data[0];
  const qty = item?.quantity ?? org.seatLimit;
  const status = sub.status;
  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000)
    : null;
  const planMeta = sub.metadata?.plan;
  const plan =
    planMeta === "enterprise" || planMeta === "academic"
      ? planMeta
      : org.plan === "academic" || org.plan === "enterprise"
        ? org.plan
        : "academic";
  await updateOrganizationBilling(org.id, {
    stripeSubscriptionId: sub.id,
    billingStatus: status ?? null,
    subscriptionPeriodEnd: periodEnd,
    seatLimit: qty,
    plan,
    suspended: sub.status === "unpaid" ? true : org.suspended,
  });
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  const claimed = await claimStripeWebhookEvent(event.id);
  if (!claimed) {
    log.debug("stripe.webhook.duplicate", { eventId: event.id });
    return;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = Number(session.client_reference_id ?? session.metadata?.organizationId);
      if (!Number.isFinite(orgId)) break;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      const plan = (session.metadata?.plan as "academic" | "enterprise" | undefined) ?? "academic";
      const seats = Number(session.metadata?.seats ?? 1);
      await updateOrganizationBilling(orgId, {
        stripeCustomerId: customerId ?? null,
        stripeSubscriptionId: subId ?? null,
        billingStatus: "active",
        plan,
        seatLimit: Number.isFinite(seats) && seats > 0 ? seats : 5,
        suspended: false,
      });
      log.info("stripe.checkout.completed", { orgId, subId });
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;
      const org = await getOrganizationByStripeCustomerId(customerId);
      if (!org) break;
      await updateOrganizationBilling(org.id, {
        billingStatus: "active",
        suspended: false,
      });
      log.info("stripe.invoice.paid", { orgId: org.id, invoiceId: invoice.id });
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;
      const org = await getOrganizationByStripeCustomerId(customerId);
      if (!org) break;
      await updateOrganizationBilling(org.id, {
        billingStatus: "past_due",
      });
      log.warn("stripe.invoice.payment_failed", { orgId: org.id, invoiceId: invoice.id });
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      await syncOrgFromSubscription(sub);
      log.info("stripe.subscription.updated", { subscriptionId: sub.id });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const org = await getOrganizationByStripeSubscriptionId(sub.id);
      if (!org) break;
      await updateOrganizationBilling(org.id, {
        plan: "free",
        seatLimit: 5,
        stripeSubscriptionId: null,
        billingStatus: "canceled",
        subscriptionPeriodEnd: null,
      });
      log.info("stripe.subscription.deleted", { orgId: org.id });
      break;
    }
    default:
      log.debug("stripe.webhook.unhandled", { type: event.type });
  }
}
