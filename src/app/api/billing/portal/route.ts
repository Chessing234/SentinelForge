import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getOrganizationById } from "@/db/queries";
import { createBillingPortalSession, getStripe } from "@/lib/billing/stripe";
import { ApiError, ErrorCodes, errorResponse } from "@/lib/error-handler";

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
      throw new ApiError(503, ErrorCodes.INTERNAL_ERROR, "Billing is not configured");
    }

    const org = await getOrganizationById(orgId);
    if (!org?.stripeCustomerId) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "No Stripe customer for this organization yet");
    }

    const root = appOrigin(request);
    const url = await createBillingPortalSession({
      customerId: org.stripeCustomerId,
      returnUrl: `${root}/dashboard/billing`,
    });

    return NextResponse.json({ url });
  } catch (e) {
    return errorResponse(e);
  }
}
