import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/reviews/:id/reply { body }
 * A doctor can publicly reply once to a review left on their own profile.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "DOCTOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId: (session.user as any).id },
  });
  if (!doctor) return NextResponse.json({ error: "Doctor not found" }, { status: 404 });

  const review = await prisma.review.findUnique({
    where: { id: params.id },
    include: { reply: true },
  });
  if (!review || review.doctorId !== doctor.id) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  if (review.reply) {
    return NextResponse.json({ error: "You have already replied to this review" }, { status: 409 });
  }

  const { body } = await req.json();
  if (!body || typeof body !== "string" || body.trim().length < 2) {
    return NextResponse.json({ error: "Reply text is required" }, { status: 400 });
  }

  const reply = await prisma.reviewReply.create({
    data: { reviewId: review.id, doctorId: doctor.id, body: body.trim() },
  });

  return NextResponse.json(reply, { status: 201 });
}
