import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const HOSPITALS = [
  { name: "Square Hospital", address: "18/F Bir Uttam Qazi Nuruzzaman Sarak", city: "Dhaka", latitude: 23.7515, longitude: 90.3842 },
  { name: "Evercare Hospital", address: "Plot 81, Block E, Bashundhara R/A", city: "Dhaka", latitude: 23.8145, longitude: 90.4485 },
  { name: "Apollo Hospitals Dhaka", address: "Plot 81, Block E, Bashundhara R/A", city: "Dhaka", latitude: 23.8125, longitude: 90.4295 },
  { name: "Chattogram Metropolitan Hospital", address: "Panchlaish", city: "Chattogram", latitude: 22.3667, longitude: 91.8003 },
  { name: "Rangpur Community Medical College Hospital", address: "College Road", city: "Rangpur", latitude: 25.7439, longitude: 89.2752 },
];

const DOCTORS = [
  { name: "Farhana Akter", specialization: "Cardiology", feeBdt: 1500, experienceYrs: 12, hospitalIdx: 0, gender: "FEMALE", languages: ["Bengali", "English"], bio: "Consultant cardiologist specializing in interventional cardiology." },
  { name: "Kamal Hossain", specialization: "Medicine", feeBdt: 700, experienceYrs: 8, hospitalIdx: 0, gender: "MALE", languages: ["Bengali", "English", "Hindi"], bio: "General physician with focus on chronic disease management." },
  { name: "Nusrat Jahan", specialization: "Gynecology", feeBdt: 1200, experienceYrs: 15, hospitalIdx: 1, gender: "FEMALE", languages: ["Bengali", "English"], bio: "Senior consultant obstetrician and gynecologist." },
  { name: "Rafiqul Islam", specialization: "Orthopedics", feeBdt: 1300, experienceYrs: 10, hospitalIdx: 1, gender: "MALE", languages: ["Bengali", "English"], bio: "Specializes in joint replacement and sports injuries." },
  { name: "Shirin Sultana", specialization: "Pediatrics", feeBdt: 800, experienceYrs: 9, hospitalIdx: 2, gender: "FEMALE", languages: ["Bengali", "English"], bio: "Child specialist with a decade of NICU experience." },
  { name: "Abdul Kader", specialization: "Neurology", feeBdt: 1800, experienceYrs: 18, hospitalIdx: 2, gender: "MALE", languages: ["Bengali", "English", "Urdu"], bio: "Consultant neurologist, movement disorder specialist." },
  { name: "Taslima Begum", specialization: "Dermatology", feeBdt: 900, experienceYrs: 7, hospitalIdx: 3, gender: "FEMALE", languages: ["Bengali", "Chittagonian"], bio: "Cosmetic and clinical dermatology." },
  { name: "Mahfuzur Rahman", specialization: "Psychiatry", feeBdt: 1000, experienceYrs: 11, hospitalIdx: 3, gender: "MALE", languages: ["Bengali", "English"], bio: "Adult psychiatry, anxiety and mood disorders." },
  { name: "Sabina Yasmin", specialization: "Medicine", feeBdt: 600, experienceYrs: 5, hospitalIdx: 4, gender: "FEMALE", languages: ["Bengali"], bio: "General physician serving the Rangpur community." },
  { name: "Imran Chowdhury", specialization: "Cardiology", feeBdt: 1600, experienceYrs: 14, hospitalIdx: 4, gender: "MALE", languages: ["Bengali", "English"], bio: "Interventional cardiologist and echo specialist." },
];

/** Two extra doctors left PENDING so the admin queue has something in it. */
const PENDING_DOCTORS = [
  { name: "Nazmul Haque", specialization: "Dermatology", feeBdt: 850, experienceYrs: 4, gender: "MALE", bio: "Recently registered — awaiting verification." },
  { name: "Ayesha Siddiqua", specialization: "Pediatrics", feeBdt: 750, experienceYrs: 6, gender: "FEMALE", bio: "Recently registered — awaiting verification." },
];

const REVIEW_COMMENTS = [
  "Very attentive and explained everything clearly.",
  "Short wait time, professional service.",
  "Helped me a lot, highly recommend.",
  "Good doctor but the wait was a bit long.",
  "Excellent bedside manner, will book again.",
  null,
];

/** A realistic-looking intake answer set for the seeded past appointments. */
function sampleAnswers(specialization: string) {
  return [
    { questionId: "main_concern", question: "In your own words, what would you like the doctor to help with?", answer: "Been feeling unwell for a while and wanted it checked properly." },
    { questionId: "concern_nature", question: "Is your concern mainly physical, mental/emotional, or both?", answer: specialization === "Psychiatry" ? "Mental or emotional" : "Physical" },
    { questionId: "body_area", question: "Which area of the body is affected?", answer: ["Whole body / general"] },
    { questionId: "duration", question: "How long has this been going on?", answer: "1–4 weeks" },
    { questionId: "severity", question: "How much is it affecting your daily life right now?", answer: 5 },
    { questionId: "trajectory", question: "Is it getting worse, staying the same, or improving?", answer: "Staying the same" },
    { questionId: "current_medication", question: "Are you currently taking any medication for this?", answer: "None" },
    { questionId: "existing_conditions", question: "Any ongoing conditions, past surgeries, or known allergies?", answer: "None" },
  ];
}

function jitter(lat: number, lng: number) {
  return {
    latitude: lat + (Math.random() - 0.5) * 0.01,
    longitude: lng + (Math.random() - 0.5) * 0.01,
  };
}

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 10);

  // --- Admin ---
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Platform Admin",
      passwordHash,
      role: "ADMIN",
      patientProfiles: { create: { name: "Platform Admin", relationship: "Self", isSelf: true } },
    },
  });

  // --- Demo patient, with a family member ---
  const demoPatient = await prisma.user.create({
    data: {
      email: "patient@example.com",
      name: "Rahim Uddin",
      passwordHash,
      phone: "01711111111",
      role: "PATIENT",
      patientProfiles: {
        create: [
          { name: "Rahim Uddin", relationship: "Self", isSelf: true, gender: "MALE" },
          { name: "Ayaan Uddin", relationship: "Child", gender: "MALE", dateOfBirth: new Date("2019-04-12") },
          { name: "Amina Khatun", relationship: "Parent", gender: "FEMALE", dateOfBirth: new Date("1958-09-03") },
        ],
      },
    },
    include: { patientProfiles: true },
  });

  const selfProfile = demoPatient.patientProfiles.find((p: any) => p.isSelf)!;

  // --- Hospitals ---
  const hospitals: any[] = [];
  for (const h of HOSPITALS) {
    hospitals.push(await prisma.hospital.create({ data: h }));
  }

  // --- Approved doctors ---
  let firstDoctor = true;
  for (let i = 0; i < DOCTORS.length; i++) {
    const d = DOCTORS[i];
    const hospital = hospitals[d.hospitalIdx];
    const email = firstDoctor
      ? "doctor@example.com"
      : `${d.name.toLowerCase().replace(/\s+/g, ".")}@edoctorsbd.demo`;

    const user = await prisma.user.create({
      data: {
        email,
        name: d.name,
        passwordHash,
        phone: "017" + String(10000000 + i * 7654321).slice(0, 8),
        role: "DOCTOR",
        patientProfiles: { create: { name: d.name, relationship: "Self", isSelf: true } },
      },
    });
    firstDoctor = false;

    const { latitude, longitude } = jitter(hospital.latitude, hospital.longitude);

    const doctorProfile = await prisma.doctorProfile.create({
      data: {
        userId: user.id,
        bmdcNumber: `A-${10000 + i}`,
        specialization: d.specialization,
        bio: d.bio,
        experienceYrs: d.experienceYrs,
        feeBdt: d.feeBdt,
        hospitalId: hospital.id,
        latitude,
        longitude,
        gender: d.gender as any,
        languages: d.languages,
        verificationStatus: "APPROVED",
        verifiedAt: new Date(),
      },
    });

    // Recurring availability rule (Sun/Tue/Thu mornings)
    for (const day of [0, 2, 4]) {
      await prisma.availabilityTemplate.create({
        data: {
          doctorId: doctorProfile.id,
          dayOfWeek: day,
          startTime: "10:00",
          endTime: "13:00",
          slotDurationMins: 20,
        },
      });
    }

    // Upcoming bookable slots, next 7 days
    const now = new Date();
    for (let day = 1; day <= 7; day++) {
      for (const hour of [10, 14, 17]) {
        const start = new Date(now);
        start.setDate(start.getDate() + day);
        start.setHours(hour, 0, 0, 0);
        const end = new Date(start.getTime() + 20 * 60_000);
        await prisma.slot.create({
          data: { doctorId: doctorProfile.id, startTime: start, endTime: end },
        });
      }
    }

    // Past completed appointments + reviews so ratings have data
    const reviewCount = 2 + Math.floor(Math.random() * 4);
    let ratingSum = 0;

    for (let r = 0; r < reviewCount; r++) {
      const pastStart = new Date(now);
      pastStart.setDate(pastStart.getDate() - (r + 1) * 3);
      pastStart.setHours(11, 0, 0, 0);
      const pastEnd = new Date(pastStart.getTime() + 20 * 60_000);

      const pastSlot = await prisma.slot.create({
        data: {
          doctorId: doctorProfile.id,
          startTime: pastStart,
          endTime: pastEnd,
          isBooked: true,
        },
      });

      const appointment = await prisma.appointment.create({
        data: {
          patientId: demoPatient.id,
          patientProfileId: selfProfile.id,
          doctorId: doctorProfile.id,
          slotId: pastSlot.id,
          feeBdt: d.feeBdt,
          status: "COMPLETED",
          consultationNotes:
            "Discussed the patient's symptoms and history. Advised rest, hydration and a follow-up in two weeks if things do not improve.",
          prescription: "Paracetamol 500mg — as needed for pain, maximum 4 times daily.",
          doctorDecisionAt: pastStart,
        },
      });

      await prisma.intakeResponse.create({
        data: {
          appointmentId: appointment.id,
          specialization: d.specialization,
          answers: sampleAnswers(d.specialization),
          flaggedForReview: false,
        },
      });

      await prisma.payment.create({
        data: {
          appointmentId: appointment.id,
          tranId: `SEED-${appointment.id}`,
          amountBdt: d.feeBdt,
          status: "PAID",
        },
      });

      const rating = 3 + Math.floor(Math.random() * 3);
      ratingSum += rating;
      const comment = REVIEW_COMMENTS[Math.floor(Math.random() * REVIEW_COMMENTS.length)];

      const review = await prisma.review.create({
        data: {
          appointmentId: appointment.id,
          patientId: demoPatient.id,
          doctorId: doctorProfile.id,
          rating,
          comment: comment ?? undefined,
        },
      });

      // The first doctor replies to one review, so the feature is visible
      if (i === 0 && r === 0) {
        await prisma.reviewReply.create({
          data: {
            reviewId: review.id,
            doctorId: doctorProfile.id,
            body: "Thank you for the kind words — glad the advice helped. Do come back if anything changes.",
          },
        });
      }
    }

    await prisma.doctorProfile.update({
      where: { id: doctorProfile.id },
      data: { avgRating: ratingSum / reviewCount, reviewCount },
    });
  }

  // --- Pending doctors for the admin queue ---
  for (let i = 0; i < PENDING_DOCTORS.length; i++) {
    const d = PENDING_DOCTORS[i];
    const user = await prisma.user.create({
      data: {
        email: `${d.name.toLowerCase().replace(/\s+/g, ".")}@edoctorsbd.demo`,
        name: d.name,
        passwordHash,
        phone: "0199" + String(1000000 + i),
        role: "DOCTOR",
        patientProfiles: { create: { name: d.name, relationship: "Self", isSelf: true } },
      },
    });

    await prisma.doctorProfile.create({
      data: {
        userId: user.id,
        bmdcNumber: `A-${20000 + i}`,
        specialization: d.specialization,
        bio: d.bio,
        experienceYrs: d.experienceYrs,
        feeBdt: d.feeBdt,
        latitude: 23.8103,
        longitude: 90.4125,
        gender: d.gender as any,
        verificationStatus: "PENDING",
      },
    });
  }

  // --- One live appointment awaiting doctor review, with a flagged intake ---
  const cardiologist = await prisma.doctorProfile.findFirst({
    where: { specialization: "Cardiology", verificationStatus: "APPROVED" },
  });

  if (cardiologist) {
    const upcomingSlot = await prisma.slot.findFirst({
      where: { doctorId: cardiologist.id, isBooked: false, startTime: { gte: new Date() } },
      orderBy: { startTime: "asc" },
    });

    if (upcomingSlot) {
      await prisma.slot.update({ where: { id: upcomingSlot.id }, data: { isBooked: true } });

      const parentProfile = demoPatient.patientProfiles.find((p: any) => p.relationship === "Parent")!;

      const appt = await prisma.appointment.create({
        data: {
          patientId: demoPatient.id,
          patientProfileId: parentProfile.id,
          doctorId: cardiologist.id,
          slotId: upcomingSlot.id,
          feeBdt: cardiologist.feeBdt,
          status: "PENDING_DOCTOR_REVIEW",
        },
      });

      await prisma.intakeResponse.create({
        data: {
          appointmentId: appt.id,
          specialization: "Cardiology",
          answers: [
            { questionId: "main_concern", question: "In your own words, what would you like the doctor to help with?", answer: "My mother gets out of breath walking to the market and it has got worse this month." },
            { questionId: "concern_nature", question: "Is your concern mainly physical, mental/emotional, or both?", answer: "Physical" },
            { questionId: "body_area", question: "Which area of the body is affected?", answer: ["Chest", "Legs or feet"] },
            { questionId: "duration", question: "How long has this been going on?", answer: "1–6 months" },
            { questionId: "severity", question: "How much is it affecting your daily life right now?", answer: 8 },
            { questionId: "trajectory", question: "Is it getting worse, staying the same, or improving?", answer: "Getting worse" },
            { questionId: "current_medication", question: "Are you currently taking any medication for this?", answer: "Blood pressure tablets, name unknown" },
            { questionId: "existing_conditions", question: "Any ongoing conditions, past surgeries, or known allergies?", answer: "High blood pressure for about 10 years" },
            { questionId: "card_exertion", question: "Do you get chest discomfort or breathlessness when walking or climbing stairs?", answer: "Yes, often" },
            { questionId: "card_palpitations", question: "Do you notice palpitations, dizziness, or swelling in your legs?", answer: ["Swelling in legs"] },
            { questionId: "card_history", question: "Has anyone in your immediate family had heart disease or a stroke before age 60?", answer: "Yes" },
          ],
          flaggedForReview: true,
          flagReason:
            "Reports frequent chest discomfort or breathlessness on exertion • Rated daily-life impact 8/10",
        },
      });

      await prisma.payment.create({
        data: {
          appointmentId: appt.id,
          tranId: `SEED-PENDING-${appt.id}`,
          amountBdt: cardiologist.feeBdt,
          status: "PAID",
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log("  patient@example.com / password123");
  console.log("  doctor@example.com  / password123");
  console.log("  admin@example.com   / password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
