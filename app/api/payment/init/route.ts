import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initSslcommerzPayment } from "@/lib/sslcommerz";

/**
 * Is the SSLCommerz sandbox actually configured?
 * The .env.example ships with placeholder values, so treat those as unset.
 */
function sslcommerzConfigured() {
  const id = process.env.SSLCOMMERZ_STORE_ID;
  const pw = process.env.SSLCOMMERZ_STORE_PASSWORD;
  if (!id || !pw) return false;
  if (id === "your_sandbox_store_id" || pw === "your_sandbox_store_password") return false;
  return true;
}

/**
 * POST /api/payment/init { appointmentId }
 *
 * Normally starts a SSLCommerz SANDBOX checkout and returns the URL to
 * redirect the browser to.
 *
 * DEV BYPASS: if no sandbox credentials are configured AND we are not running
 * in production, the payment is recorded as paid locally and the appointment
 * moves straight to the doctor's review queue. This exists so the rest of the
 * app can be demoed without setting up a gateway account. It is hard-disabled
 * when NODE_ENV === "production" so it can never skip a real payment.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { appointmentId } = await req.json();

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }
  if (appointment.patientId !== (session.user as any).id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (appointment.status !== "PENDING_PAYMENT") {
    return NextResponse.json(
      { error: "Appointment is not awaiting payment" },
      { status: 400 }
    );
  }

  const tranId = `APT-${appointment.id}-${Date.now()}`;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // ---- Dev bypass ----
  const isProduction = process.env.NODE_ENV === "production";
  if (!sslcommerzConfigured()) {
    if (isProduction) {
      return NextResponse.json(
        { error: "Payment gateway is not configured." },
        { status: 500 }
      );
    }

    console.warn(
      "[payment] No SSLCommerz credentials found — using the DEV BYPASS. " +
        "No real or sandbox payment was made. Set SSLCOMMERZ_STORE_ID and " +
        "SSLCOMMERZ_STORE_PASSWORD in .env.local to exercise the real flow."
    );

    await prisma.$transaction(async (tx: any) => {
      await tx.payment.create({
        data: {
          appointmentId: appointment.id,
          tranId,
          amountBdt: appointment.feeBdt,
          status: "PAID",
          refundNote: "DEV BYPASS — no gateway transaction took place",
        },
      });
      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: "PENDING_DOCTOR_REVIEW" },
      });
    });

    return NextResponse.json({
      redirectUrl: `${baseUrl}/dashboard/patient?payment=devbypass`,
      devBypass: true,
    });
  }

  // ---- Real SSLCommerz sandbox flow ----
  const payment = await prisma.payment.create({
    data: {
      appointmentId: appointment.id,
      tranId,
      amountBdt: appointment.feeBdt,
      status: "INITIATED",
    },
  });

  try {
    const gatewayResp = await initSslcommerzPayment({
      tranId,
      amountBdt: appointment.feeBdt,
      customerName: appointment.patient.name,
      customerEmail: appointment.patient.email,
      customerPhone: appointment.patient.phone || "01700000000",
      successUrl: `${baseUrl}/api/payment/ipn?tran_id=${tranId}&result=success`,
      failUrl: `${baseUrl}/api/payment/ipn?tran_id=${tranId}&result=fail`,
      cancelUrl: `${baseUrl}/api/payment/ipn?tran_id=${tranId}&result=cancel`,
      ipnUrl: `${baseUrl}/api/payment/ipn`,
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { gatewayResp: gatewayResp as any },
    });

    return NextResponse.json({ redirectUrl: gatewayResp.GatewayPageURL });
  } catch (err) {
    console.error("SSLCommerz init error", err);
    return NextResponse.json(
      {
        error:
          "Payment gateway init failed. Check your SSLCommerz sandbox credentials in .env.local",
      },
      { status: 502 }
    );
  }
}
