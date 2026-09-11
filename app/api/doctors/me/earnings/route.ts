import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/doctors/me/earnings
 * Earnings from COMPLETED consultations, broken down by month and week,
 * plus headline totals.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "DOCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId: (session.user as any).id },
  });
  if (!doctor) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });

  const completed = await prisma.appointment.findMany({
    where: { doctorId: doctor.id, status: "COMPLETED" },
    include: { slot: true },
    orderBy: { updatedAt: "desc" },
  });

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const total = completed.reduce((s: number, a: any) => s + a.feeBdt, 0);
  const thisWeek = completed
    .filter((a: any) => a.slot.startTime >= startOfWeek)
    .reduce((s: number, a: any) => s + a.feeBdt, 0);
  const thisMonth = completed
    .filter((a: any) => a.slot.startTime >= startOfMonth)
    .reduce((s: number, a: any) => s + a.feeBdt, 0);

  // Group by calendar month for a simple trend view
  const byMonth: Record<string, { month: string; amount: number; count: number }> = {};
  for (const a of completed as any[]) {
    const key = `${a.slot.startTime.getFullYear()}-${String(
      a.slot.startTime.getMonth() + 1
    ).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = { month: key, amount: 0, count: 0 };
    byMonth[key].amount += a.feeBdt;
    byMonth[key].count += 1;
  }

  const pendingRefunds = await prisma.payment.aggregate({
    where: {
      appointment: { doctorId: doctor.id },
      status: { in: ["REFUND_PENDING", "REFUNDED"] },
    },
    _sum: { amountBdt: true },
    _count: true,
  });

  return NextResponse.json({
    total,
    thisWeek,
    thisMonth,
    consultationCount: completed.length,
    byMonth: Object.values(byMonth).sort((a: any, b: any) => b.month.localeCompare(a.month)),
    refunded: {
      amount: pendingRefunds._sum.amountBdt ?? 0,
      count: pendingRefunds._count,
    },
  });
}
