import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getOrganizationById } from "@/db/queries";
import {
  createCheckoutSession,
  createCustomer,
  getStripe,
  priceIdForPlan,
} from "@/lib/billing/stripe";
import { ApiError, ErrorCodes, errorResponse } from "@/lib/error-handler";

const bodySchema = z.object({
  plan: z.enum(["academic", "enterprise"]),
  seats: z.number().int().min(1).max(10_000),
  billing: z.enum(["monthly", "annual"]).optional().default("monthly"),
});

function appOrigin(request: Request): string {
  const env = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL;
  if (env?.startsWith("http")) return env.replace(/\/$/, "");
  const host = request.headers.get("host");
  if (host) return `https://${host}`;
  return "http://localhost:3000";
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new ApiError(401, ErrorCodes.UNAUTHORIZED, "Unauthorized");
    }
    if (session.user.role !== "enterprise_admin") {
      throw new ApiError(403, ErrorCodes.FORBIDDEN, "Enterprise admin only");
    }
    const orgId =
      session.user.organizationId === null || session.user.organizationId === undefined
        ? null
        : Number(session.user.organizationId);
    if (!orgId) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "Organization required");
    }

    const stripe = getStripe();
    if (!stripe) {
      throw new ApiError(503, ErrorCodes.INTERNAL_ERROR, "Billing is not configured (missing STRIPE_SECRET_KEY)");
    }

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "Invalid JSON");
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(422, ErrorCodes.VALIDATION_ERROR, "Validation failed", parsed.error.flatten());
    }

    const org = await getOrganizationById(orgId);
    if (!org) {
      throw new ApiError(404, ErrorCodes.NOT_FOUND, "Organization not found");
    }

    let customerId = org.stripeCustomerId ?? null;
    if (!customerId) {
      const email = session.user.email ?? `billing+${orgId}@sentinelforge.local`;
      const customer = await createCustomer({
        organizationId: orgId,
        email,
        name: org.name,
      });
      customerId = customer.id;
    }

    const priceId = priceIdForPlan(parsed.data.plan, parsed.data.billing);
    const root = appOrigin(request);
    const url = await createCheckoutSession({
      customerId: customerId!,
      priceId,
      quantity: parsed.data.seats,
      organizationId: orgId,
      plan: parsed.data.plan,
      successUrl: `${root}/dashboard/billing?checkout=success`,
      cancelUrl: `${root}/dashboard/billing?checkout=cancel`,
    });

    return NextResponse.json({ url });
  } catch (e) {
    return errorResponse(e);
  }
}
