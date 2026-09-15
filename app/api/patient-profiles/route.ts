import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, RULES } from "@/lib/rate-limit";

/** GET /api/patient-profiles — self + family members on this account */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limited = rateLimit("patient-profiles", (session.user as any).id, RULES.read);
  if (limited) return limited;

  const profiles = await prisma.patientProfile.findMany({
    where: { accountId: (session.user as any).id },
    orderBy: [{ isSelf: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ profiles });
}

const profileSchema = z.object({
  name: z.string().min(2).max(100),
  relationship: z.enum(["Self", "Child", "Parent", "Spouse", "Sibling", "Other"]),
  dateOfBirth: z.string().optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
});

/** POST /api/patient-profiles — add a family member */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limited = rateLimit("patient-profiles", (session.user as any).id, RULES.write);
  if (limited) return limited;

  const parsed = profileSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile data" }, { status: 400 });
  }

  const { dateOfBirth, ...rest } = parsed.data;

  const profile = await prisma.patientProfile.create({
    data: {
      ...rest,
      accountId: (session.user as any).id,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      isSelf: false,
    },
  });

  return NextResponse.json(profile, { status: 201 });
}

/** DELETE /api/patient-profiles?id=... — remove a family member (not self) */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limited = rateLimit("patient-profiles", (session.user as any).id, RULES.write);
  if (limited) return limited;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const profile = await prisma.patientProfile.findUnique({
    where: { id },
    include: { _count: { select: { appointments: true } } },
  });

  if (!profile || profile.accountId !== (session.user as any).id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (profile.isSelf) {
    return NextResponse.json({ error: "Cannot remove your own profile" }, { status: 400 });
  }
  if (profile._count.appointments > 0) {
    return NextResponse.json(
      { error: "This person has appointment history and cannot be removed" },
      { status: 409 }
    );
  }

  await prisma.patientProfile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
