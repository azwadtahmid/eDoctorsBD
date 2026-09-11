import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateSslcommerzTransaction } from "@/lib/sslcommerz";

/**
 * Handles both the SSLCommerz server-to-server IPN (POST) and the
 * success/fail/cancel browser redirect (GET).
 *
 * On success the appointment moves to PENDING_DOCTOR_REVIEW — NOT straight to
 * confirmed. The doctor still has to read the intake answers and accept.
 */
async function handle(tranId: string | null, result: string | null, valId?: string | null) {
  if (!tranId) {
    return NextResponse.json({ error: "Missing tran_id" }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({ where: { tranId } });
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (result === "fail" || result === "cancel") {
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

    return NextResponse.redirect(`${appUrl}/dashboard/patient?payment=failed`);
  }

  // Validate with SSLCommerz before trusting a "success"
  let validated = true;
  if (valId) {
    try {
      const validation = await validateSslcommerzTransaction(valId);
      validated = validation.status === "VALID" || validation.status === "VALIDATED";
    } catch (e) {
      console.error("SSLCommerz validation call failed", e);
      validated = false;
    }
  }

  if (!validated) {
    return NextResponse.json({ error: "Transaction could not be validated" }, { status: 400 });
  }

  const appointment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.payment.update({ where: { tranId }, data: { status: "PAID" } });
    return tx.appointment.update({
      where: { id: payment.appointmentId },
      data: { status: "PENDING_DOCTOR_REVIEW" },
    });
  });

  if (!result) {
    return NextResponse.json({ ok: true, appointmentId: appointment.id });
  }

  return NextResponse.redirect(`${appUrl}/dashboard/patient?payment=success`);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return handle(sp.get("tran_id"), sp.get("result"), sp.get("val_id"));
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const tranId = form.get("tran_id") as string | null;
  const valId = form.get("val_id") as string | null;
  const status = form.get("status") as string | null;
  return handle(tranId, status === "VALID" ? "success" : "fail", valId);
}
