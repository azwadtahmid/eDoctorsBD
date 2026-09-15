import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateSslcommerzTransaction } from "@/lib/sslcommerz";
import { clientIp, rateLimit, RULES } from "@/lib/rate-limit";

/**
 * Handles both the SSLCommerz server-to-server IPN (POST) and the
 * success/fail/cancel browser redirect (GET).
 *
 * SECURITY: this endpoint is necessarily unauthenticated — the gateway calls
 * it, and the browser is redirected back through it — so nothing a caller
 * sends is trusted. A payment is only ever marked PAID after SSLCommerz's own
 * validation API confirms the transaction AND the transaction id and amount it
 * returns match the payment row we created. A caller who merely asserts
 * "result=success" gets a 400.
 *
 * On success the appointment moves to PENDING_DOCTOR_REVIEW — NOT straight to
 * confirmed. The doctor still has to read the intake answers and accept.
 */

function redirectTo(path: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}${path}`);
}

async function handle(
  tranId: string | null,
  result: string | null,
  valId: string | null | undefined,
  isBrowserRedirect: boolean
) {
  if (!tranId) {
    return NextResponse.json({ error: "Missing tran_id" }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({ where: { tranId } });
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // ---- Idempotency ----
  // The gateway retries IPNs, and the browser redirect can be replayed from
  // history. Settled payments are never re-processed.
  if (payment.status === "PAID") {
    return isBrowserRedirect
      ? redirectTo("/dashboard/patient?payment=success")
      : NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  if (result === "fail" || result === "cancel") {
    // Only a payment that never completed can be torn down this way, so a
    // replayed "cancel" can never unwind a settled appointment.
    if (payment.status !== "INITIATED") {
      return isBrowserRedirect
        ? redirectTo("/dashboard/patient?payment=failed")
        : NextResponse.json({ ok: true, alreadyProcessed: true });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: payment.appointmentId },
    });

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.payment.update({ where: { tranId }, data: { status: "FAILED" } });
      if (appointment) {
        await tx.slot.update({ where: { id: appointment.slotId }, data: { isBooked: false } });
      }
      await tx.appointment.update({
        where: { id: payment.appointmentId },
        data: { status: "CANCELLED", cancelReason: "Payment was not completed" },
      });
    });

    return isBrowserRedirect
      ? redirectTo("/dashboard/patient?payment=failed")
      : NextResponse.json({ ok: true });
  }

  // ---- Success path: prove it with SSLCommerz, never take the caller's word ----
  if (!valId) {
    console.warn(`[payment] Rejected success for ${tranId}: no val_id supplied.`);
    return NextResponse.json(
      { error: "Transaction could not be validated" },
      { status: 400 }
    );
  }

  let validation: any;
  try {
    validation = await validateSslcommerzTransaction(valId);
  } catch (e) {
    console.error("SSLCommerz validation call failed", e);
    return NextResponse.json(
      { error: "Transaction could not be validated" },
      { status: 400 }
    );
  }

  const statusOk =
    validation?.status === "VALID" || validation?.status === "VALIDATED";
  // The val_id must belong to the transaction we are being told it settles,
  // otherwise one genuine cheap payment could be replayed against any booking.
  const tranIdOk = validation?.tran_id === tranId;
  const paidAmount = Number(validation?.amount);
  const amountOk =
    Number.isFinite(paidAmount) && paidAmount >= Number(payment.amountBdt);
  const currencyOk =
    !validation?.currency || String(validation.currency).toUpperCase() === "BDT";

  if (!statusOk || !tranIdOk || !amountOk || !currencyOk) {
    console.warn(
      `[payment] Rejected validation for ${tranId}: ` +
        `status=${validation?.status} tranIdMatch=${tranIdOk} ` +
        `amount=${validation?.amount} expected=${payment.amountBdt} ` +
        `currency=${validation?.currency}`
    );
    return NextResponse.json(
      { error: "Transaction could not be validated" },
      { status: 400 }
    );
  }

  const appointment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.payment.update({
      where: { tranId },
      data: { status: "PAID", gatewayResp: validation as any },
    });
    return tx.appointment.update({
      where: { id: payment.appointmentId },
      data: { status: "PENDING_DOCTOR_REVIEW" },
    });
  });

  return isBrowserRedirect
    ? redirectTo("/dashboard/patient?payment=success")
    : NextResponse.json({ ok: true, appointmentId: appointment.id });
}

export async function GET(req: NextRequest) {
  const limited = rateLimit("ipn", clientIp(req), RULES.ipn);
  if (limited) return limited;

  const sp = req.nextUrl.searchParams;
  return handle(sp.get("tran_id"), sp.get("result"), sp.get("val_id"), true);
}

export async function POST(req: NextRequest) {
  const limited = rateLimit("ipn", clientIp(req), RULES.ipn);
  if (limited) return limited;

  const form = await req.formData();
  const tranId = form.get("tran_id") as string | null;
  const valId = form.get("val_id") as string | null;
  const status = form.get("status") as string | null;
  const normalised =
    status === "VALID" || status === "VALIDATED" ? "success" : "fail";
  return handle(tranId, normalised, valId, false);
}
