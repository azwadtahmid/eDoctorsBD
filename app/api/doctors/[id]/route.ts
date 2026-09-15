import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, RULES } from "@/lib/rate-limit";

/**
 * GET /api/doctors/:id — the public profile page.
 *
 * Only APPROVED doctors are addressable. The listing endpoint already filters
 * on verification status, but this one did not, so a pending or rejected
 * doctor's full profile — including the BMDC number they registered and their
 * contact-adjacent details — was readable by anyone who had the id. A rejected
 * applicant is not a public record.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const limited = rateLimit("doctor-detail", clientIp(req), RULES.read);
  if (limited) return limited;

  const doctor = await prisma.doctorProfile.findFirst({
    where: { id: id, verificationStatus: "APPROVED" },
    include: {
      user: { select: { name: true } },
      hospital: true,
      slots: {
        where: { isBooked: false, startTime: { gte: new Date() } },
        orderBy: { startTime: "asc" },
        take: 60,
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          patient: { select: { name: true } },
          reply: true,
        },
      },
    },
  });

  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: doctor.id,
    name: doctor.user.name,
    specialization: doctor.specialization,
    bio: doctor.bio,
    experienceYrs: doctor.experienceYrs,
    feeBdt: doctor.feeBdt,
    bmdcNumber: doctor.bmdcNumber,
    gender: doctor.gender,
    languages: doctor.languages,
    verificationStatus: doctor.verificationStatus,
    avgRating: doctor.avgRating,
    reviewCount: doctor.reviewCount,
    hospital: doctor.hospital,
    slots: doctor.slots,
    reviews: doctor.reviews.map((r: any) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      patientName: r.patient.name,
      createdAt: r.createdAt,
      reply: r.reply ? { body: r.reply.body, createdAt: r.reply.createdAt } : null,
    })),
  });
}
