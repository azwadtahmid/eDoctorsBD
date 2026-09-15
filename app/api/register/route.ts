import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, RULES } from "@/lib/rate-limit";

/** Work factor for password hashing. 12 is the current sensible default. */
const BCRYPT_ROUNDS = 12;

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Enter a valid email address").max(254).toLowerCase().trim(),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .max(200, "Password is too long")
    .refine((v) => !/^[0-9]+$/.test(v), "Password cannot be all numbers"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{6,20}$/, "Enter a valid phone number")
    .optional(),
  role: z.enum(["PATIENT", "DOCTOR"]).default("PATIENT"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  // Doctor-only
  bmdcNumber: z.string().trim().min(3).max(50).optional(),
  specialization: z.string().trim().min(2).max(100).optional(),
  feeBdt: z.number().int().min(0).max(100000).optional(),
  experienceYrs: z.number().int().min(0).max(70).optional(),
  hospitalId: z.string().max(100).optional(),
  languages: z.array(z.string().max(50)).max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit("register", clientIp(req), RULES.register);
  if (limited) return limited;

  const parsed = registerSchema.safeParse(await req.json().catch(() => null));

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

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

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
