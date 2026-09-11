import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
  role: z.enum(["PATIENT", "DOCTOR"]).default("PATIENT"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  // Doctor-only
  bmdcNumber: z.string().optional(),
  specialization: z.string().optional(),
  feeBdt: z.number().optional(),
  experienceYrs: z.number().optional(),
  hospitalId: z.string().optional(),
  languages: z.array(z.string()).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = registerSchema.safeParse(await req.json());

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    return NextResponse.json({ error: "That email is already registered" }, { status: 409 });
  }

  if (data.role === "DOCTOR") {
    if (!data.bmdcNumber || !data.specialization || data.feeBdt === undefined) {
      return NextResponse.json(
        { error: "BMDC number, specialization and fee are required for doctors" },
        { status: 400 }
      );
    }
    const bmdcTaken = await prisma.doctorProfile.findUnique({
      where: { bmdcNumber: data.bmdcNumber },
    });
    if (bmdcTaken) {
      return NextResponse.json(
        { error: "That BMDC registration number is already registered" },
        { status: 409 }
      );
    }
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash,
      role: data.role,
      // every account gets a "self" profile so appointments always have a subject
      patientProfiles: {
        create: {
          name: data.name,
          relationship: "Self",
          isSelf: true,
          gender: data.gender ?? null,
        },
      },
    },
  });

  if (data.role === "DOCTOR") {
    await prisma.doctorProfile.create({
      data: {
        userId: user.id,
        bmdcNumber: data.bmdcNumber!,
        specialization: data.specialization!,
        feeBdt: data.feeBdt!,
        experienceYrs: data.experienceYrs ?? 0,
        hospitalId: data.hospitalId || null,
        gender: data.gender ?? null,
        languages: data.languages ?? ["Bengali", "English"],
        latitude: data.latitude ?? 23.8103,
        longitude: data.longitude ?? 90.4125,
        // Doctors are NOT live until an admin approves them and checks the
        // BMDC number against the official register.
        verificationStatus: "PENDING",
      },
    });
  }

  return NextResponse.json(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      needsApproval: data.role === "DOCTOR",
    },
    { status: 201 }
  );
}
