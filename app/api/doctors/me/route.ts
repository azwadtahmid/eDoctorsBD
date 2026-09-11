import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireDoctor() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "DOCTOR") return null;
  return prisma.doctorProfile.findUnique({
    where: { userId: (session.user as any).id },
  });
}

/** GET /api/doctors/me — the logged-in doctor's own profile */
export async function GET() {
  const doctor = await requireDoctor();
  if (!doctor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const full = await prisma.doctorProfile.findUnique({
    where: { id: doctor.id },
    include: { user: { select: { name: true, email: true, phone: true } }, hospital: true },
  });

  return NextResponse.json(full);
}

const updateSchema = z.object({
  bio: z.string().max(2000).optional(),
  feeBdt: z.number().int().min(0).max(100000).optional(),
  specialization: z.string().min(2).optional(),
  experienceYrs: z.number().int().min(0).max(70).optional(),
  hospitalId: z.string().nullable().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).nullable().optional(),
  languages: z.array(z.string()).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
});

/** PATCH /api/doctors/me — update own profile */
export async function PATCH(req: NextRequest) {
  const doctor = await requireDoctor();
  if (!doctor) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, phone, ...profileFields } = parsed.data;

  if (name || phone) {
    await prisma.user.update({
      where: { id: doctor.userId },
      data: { ...(name && { name }), ...(phone !== undefined && { phone }) },
    });
  }

  const updated = await prisma.doctorProfile.update({
    where: { id: doctor.id },
    data: profileFields,
    include: { user: { select: { name: true, email: true, phone: true } }, hospital: true },
  });

  return NextResponse.json(updated);
}
