import { NextRequest, NextResponse } from "next/server";
import {
  getQuestionsForSpecialization,
  EMERGENCY_NOTICE,
  CRISIS_RESOURCES,
} from "@/lib/intake-questions";

/**
 * GET /api/intake-questions?specialization=Cardiology
 * Returns the questionnaire the patient fills in before booking, plus the
 * safety notices shown alongside it.
 */
export async function GET(req: NextRequest) {
  const specialization = req.nextUrl.searchParams.get("specialization") || "Medicine";

  return NextResponse.json({
    specialization,
    questions: getQuestionsForSpecialization(specialization),
    emergencyNotice: EMERGENCY_NOTICE,
    crisisResources: CRISIS_RESOURCES,
  });
}
