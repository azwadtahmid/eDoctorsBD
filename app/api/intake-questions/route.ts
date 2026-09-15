import { NextRequest, NextResponse } from "next/server";
import {
  getQuestionsForSpecialization,
  EMERGENCY_NOTICE,
  CRISIS_RESOURCES,
} from "@/lib/intake-questions";
import { clientIp, rateLimit, RULES } from "@/lib/rate-limit";

/**
 * GET /api/intake-questions?specialization=Cardiology
 * Returns the questionnaire the patient fills in before booking, plus the
 * safety notices shown alongside it.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit("intake-questions", clientIp(req), RULES.read);
  if (limited) return limited;

  const specialization = req.nextUrl.searchParams.get("specialization") || "Medicine";

  return NextResponse.json({
    specialization,
    questions: getQuestionsForSpecialization(specialization),
    emergencyNotice: EMERGENCY_NOTICE,
    crisisResources: CRISIS_RESOURCES,
  });
}
