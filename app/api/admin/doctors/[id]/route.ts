import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, RULES } from "@/lib/rate-limit";

const decisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), reason: z.string().min(3).max(500) }),
]);

/**
 * PATCH /api/admin/doctors/:id
 * Approve or reject a doctor's registration. Only APPROVED doctors appear in
 * patient search results.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = rateLimit("admin-decision", (session.user as any).id, RULES.write);
  if (limited) return limited;

  const parsed = decisionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const doctor = await prisma.doctorProfile.findUnique({ where: { id } });
  if (!doctor) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });

  const updated = await prisma.doctorProfile.update({
    where: { id },
    data:
      parsed.data.action === "approve"
        ? {
            verificationStatus: "APPROVED",
            verifiedAt: new Date(),
            rejectionReason: null,
          }
        : {
            verificationStatus: "REJECTED",
            verifiedAt: null,
            rejectionReason: parsed.data.reason,
          },
  });

  return NextResponse.json(updated);
}
