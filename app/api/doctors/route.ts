import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { distanceKm } from "@/lib/distance";
import { clientIp, rateLimit, RULES } from "@/lib/rate-limit";

/**
 * GET /api/doctors
 *   ?specialization= &minFee= &maxFee= &hospitalId= &minRating=
 *   &gender= &language= &availableToday=
 *   &lat= &lng= &maxDistanceKm= &availableFrom= &availableTo= &sort=
 *
 * Only APPROVED doctors are ever returned.
 */
export async function GET(req: NextRequest) {
  // Unauthenticated and query-heavy, so throttled per IP.
  const limited = rateLimit("doctor-search", clientIp(req), RULES.read);
  if (limited) return limited;

  const sp = req.nextUrl.searchParams;

  const specialization = sp.get("specialization") || undefined;
  const minFee = sp.get("minFee") ? Number(sp.get("minFee")) : undefined;
  const maxFee = sp.get("maxFee") ? Number(sp.get("maxFee")) : undefined;
  const hospitalId = sp.get("hospitalId") || undefined;
  const minRating = sp.get("minRating") ? Number(sp.get("minRating")) : undefined;
  const gender = sp.get("gender") || undefined;
  const language = sp.get("language") || undefined;
  const availableToday = sp.get("availableToday") === "true";
  const lat = sp.get("lat") ? Number(sp.get("lat")) : undefined;
  const lng = sp.get("lng") ? Number(sp.get("lng")) : undefined;
  const maxDistanceKm = sp.get("maxDistanceKm") ? Number(sp.get("maxDistanceKm")) : undefined;
  const availableFrom = sp.get("availableFrom") || undefined;
  const availableTo = sp.get("availableTo") || undefined;
  const sort = sp.get("sort") || "rating";

  // Built inline so Prisma infers the where-clause type from the schema.
  const slotWindow = (() => {
    if (availableToday) {
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      return { gte: new Date(), lte: endOfDay };
    }
    if (availableFrom || availableTo) {
      return {
        ...(availableFrom && { gte: new Date(availableFrom) }),
        ...(availableTo && { lte: new Date(availableTo) }),
      };
    }
    return null;
  })();

  const doctors = await prisma.doctorProfile.findMany({
    where: {
      verificationStatus: "APPROVED",
      ...(specialization && {
        specialization: { equals: specialization, mode: "insensitive" as const },
      }),
      ...(hospitalId && { hospitalId }),
      ...(minRating !== undefined && { avgRating: { gte: minRating } }),
      ...(gender && { gender: gender as any }),
      ...(language && { languages: { has: language } }),
      ...((minFee !== undefined || maxFee !== undefined) && {
        feeBdt: {
          ...(minFee !== undefined && { gte: minFee }),
          ...(maxFee !== undefined && { lte: maxFee }),
        },
      }),
      ...(slotWindow && {
        slots: { some: { isBooked: false, startTime: slotWindow } },
      }),
    },
    include: {
      user: { select: { name: true } },
      hospital: true,
      slots: {
        where: { isBooked: false, startTime: { gte: new Date() } },
        orderBy: { startTime: "asc" },
        take: 5,
      },
    },
  });

  // Which of these has the logged-in patient saved?
  const session = await getServerSession(authOptions);
  let favoriteIds = new Set<string>();
  if (session?.user) {
    const favs = await prisma.favorite.findMany({
      where: { patientId: (session.user as any).id },
      select: { doctorId: true },
    });
    favoriteIds = new Set(favs.map((f: any) => f.doctorId));
  }

  let results = doctors.map((d: any) => {
    const dist =
      lat !== undefined && lng !== undefined
        ? distanceKm(lat, lng, d.latitude, d.longitude)
        : null;

    return {
      id: d.id,
      name: d.user.name,
      specialization: d.specialization,
      feeBdt: d.feeBdt,
      experienceYrs: d.experienceYrs,
      avgRating: d.avgRating,
      reviewCount: d.reviewCount,
      gender: d.gender,
      languages: d.languages,
      hospital: d.hospital
        ? { id: d.hospital.id, name: d.hospital.name, city: d.hospital.city }
        : null,
      distanceKm: dist !== null ? Math.round(dist * 10) / 10 : null,
      nextSlots: d.slots,
      isFavorite: favoriteIds.has(d.id),
    };
  });

  if (maxDistanceKm !== undefined && lat !== undefined && lng !== undefined) {
    results = results.filter((d: any) => d.distanceKm !== null && d.distanceKm <= maxDistanceKm);
  }

  results.sort((a: any, b: any) => {
    if (sort === "fee") return a.feeBdt - b.feeBdt;
    if (sort === "distance") {
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    }
    if (sort === "experience") return b.experienceYrs - a.experienceYrs;
    return b.avgRating - a.avgRating;
  });

  return NextResponse.json({ count: results.length, doctors: results });
}
