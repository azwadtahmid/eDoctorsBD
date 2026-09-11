import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: params.id },
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
