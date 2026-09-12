import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/doctors?status=PENDING
 * The verification queue. In a real deployment the admin would check each
 * doctor's BMDC registration number against the official register before
 * approving — this endpoint just surfaces who is waiting.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status") as
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | null;

  const doctors = await prisma.doctorProfile.findMany({
    where: status ? { verificationStatus: status } : {},
    include: {
      user: { select: { name: true, email: true, phone: true, createdAt: true } },
      hospital: true,
      _count: { select: { appointments: true } },
    },
    orderBy: { user: { createdAt: "desc" } },
  });

  const counts = await prisma.doctorProfile.groupBy({
    by: ["verificationStatus"],
    _count: true,
  });

  return NextResponse.json({
    doctors,
    counts: Object.fromEntries(
      counts.map((c: { verificationStatus: string; _count: number }) => [
        c.verificationStatus,
        c._count,
      ])
    ),
  });
}
