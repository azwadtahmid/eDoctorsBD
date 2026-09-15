import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, RULES } from "@/lib/rate-limit";

/** GET /api/favorites — the patient's saved doctors */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limited = rateLimit("favorites", (session.user as any).id, RULES.read);
  if (limited) return limited;

  const favorites = await prisma.favorite.findMany({
    where: { patientId: (session.user as any).id },
    include: {
      doctor: {
        include: {
          user: { select: { name: true } },
          hospital: true,
          slots: {
            where: { isBooked: false, startTime: { gte: new Date() } },
            orderBy: { startTime: "asc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ favorites });
}

/** POST /api/favorites { doctorId } — save a doctor */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limited = rateLimit("favorites", (session.user as any).id, RULES.write);
  if (limited) return limited;

  const { doctorId } = await req.json();
  if (!doctorId) return NextResponse.json({ error: "doctorId required" }, { status: 400 });

  try {
    const favorite = await prisma.favorite.create({
      data: { patientId: (session.user as any).id, doctorId },
    });
    return NextResponse.json(favorite, { status: 201 });
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ ok: true, alreadySaved: true });
    }
    throw err;
  }
}

/** DELETE /api/favorites?doctorId=... */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const limited = rateLimit("favorites", (session.user as any).id, RULES.write);
  if (limited) return limited;

  const doctorId = req.nextUrl.searchParams.get("doctorId");
  if (!doctorId) return NextResponse.json({ error: "doctorId required" }, { status: 400 });

  await prisma.favorite.deleteMany({
    where: { patientId: (session.user as any).id, doctorId },
  });

  return NextResponse.json({ ok: true });
}
