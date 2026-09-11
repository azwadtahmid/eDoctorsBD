/**
 * Pre-consultation intake questionnaire.
 *
 * DESIGN PRINCIPLE — read this before changing anything here:
 *
 * This questionnaire COLLECTS information and SHOWS it to the doctor.
 * It does not diagnose, trot out a probable cause, score severity, or
 * decide anything clinical. The doctor reads the answers and makes every
 * call (accept / reject / mark urgent / propose a different time).
 *
 * The only automated behaviour is SAFETY ROUTING:
 *   - Emergency-symptom answers show the patient emergency numbers
 *     immediately and flag the appointment to the top of the doctor's queue.
 *   - A patient indicating thoughts of self-harm is shown crisis helpline
 *     details right away and the appointment is flagged.
 * Flagging surfaces information to a human faster. It never replaces one.
 */

export type QuestionType = "text" | "textarea" | "select" | "multiselect" | "scale";

export interface IntakeQuestion {
  id: string;
  label: string;
  labelBn?: string;
  type: QuestionType;
  options?: string[];
  optionsBn?: string[];
  required?: boolean;
  helpText?: string;
  /** Answers listed here flag the appointment for the doctor's attention. */
  flagIfAnswerIn?: string[];
  flagReason?: string;
  /** Show crisis-support resources to the patient if one of these is chosen. */
  showCrisisSupportIfAnswerIn?: string[];
}

/** Shown above every questionnaire, before any question. */
export const EMERGENCY_NOTICE = {
  en: {
    title: "This platform is not for emergencies",
    body:
      "If you or the person you are booking for has severe chest pain, difficulty breathing, heavy bleeding, sudden weakness or slurred speech, a serious injury, or is unconscious — do not wait for an appointment.",
    action: "Call 999 (national emergency) or go to your nearest hospital now.",
  },
  bn: {
    title: "এই প্ল্যাটফর্মটি জরুরি অবস্থার জন্য নয়",
    body:
      "আপনার বা যার জন্য বুকিং করছেন তার যদি তীব্র বুকে ব্যথা, শ্বাসকষ্ট, অতিরিক্ত রক্তক্ষরণ, হঠাৎ দুর্বলতা বা কথা জড়িয়ে যাওয়া, গুরুতর আঘাত থাকে বা অজ্ঞান হয়ে থাকেন — অ্যাপয়েন্টমেন্টের জন্য অপেক্ষা করবেন না।",
    action: "এখনই ৯৯৯ (জাতীয় জরুরি সেবা) নম্বরে কল করুন অথবা নিকটস্থ হাসপাতালে যান।",
  },
};

/**
 * Crisis resources for Bangladesh. Verify these are current before any real
 * deployment — helpline numbers and operating hours do change.
 */
export const CRISIS_RESOURCES = {
  en: {
    title: "Support is available right now",
    body:
      "You do not have to wait for this appointment to talk to someone. Trained listeners are available and the call is confidential.",
    resources: [
      "Kaan Pete Roi — 09612-119911 (every day, 3:00 PM – 3:00 AM)",
      "Moner Bondhu — 01776-632344",
      "National emergency — 999",
    ],
    footer:
      "If you are in immediate danger, please call 999 or go to your nearest hospital.",
  },
  bn: {
    title: "এখনই সহায়তা পাওয়া যাচ্ছে",
    body:
      "কারও সাথে কথা বলার জন্য আপনাকে এই অ্যাপয়েন্টমেন্ট পর্যন্ত অপেক্ষা করতে হবে না। প্রশিক্ষিত শ্রোতারা আছেন এবং কল গোপনীয় থাকবে।",
    resources: [
      "কান পেতে রই — ০৯৬১২-১১৯৯১১ (প্রতিদিন, বিকাল ৩টা – রাত ৩টা)",
      "মনের বন্ধু — ০১৭৭৬-৬৩২৩৪৪",
      "জাতীয় জরুরি সেবা — ৯৯৯",
    ],
    footer:
      "আপনি যদি তাৎক্ষণিক বিপদে থাকেন, অনুগ্রহ করে ৯৯৯ এ কল করুন অথবা নিকটস্থ হাসপাতালে যান।",
  },
};

/** Asked for every specialization. */
const COMMON_QUESTIONS: IntakeQuestion[] = [
  {
    id: "main_concern",
    label: "In your own words, what would you like the doctor to help with?",
    labelBn: "আপনার নিজের ভাষায়, ডাক্তারের কাছে কী বিষয়ে সাহায্য চান?",
    type: "textarea",
    required: true,
    helpText: "A sentence or two is enough.",
  },
  {
    id: "concern_nature",
    label: "Is your concern mainly physical, mental/emotional, or both?",
    labelBn: "আপনার সমস্যাটি প্রধানত শারীরিক, মানসিক, নাকি উভয়?",
    type: "select",
    options: ["Physical", "Mental or emotional", "Both", "Not sure"],
    optionsBn: ["শারীরিক", "মানসিক বা আবেগজনিত", "উভয়", "নিশ্চিত নই"],
    required: true,
  },
  {
    id: "body_area",
    label: "Which area of the body is affected?",
    labelBn: "শরীরের কোন অংশে সমস্যা?",
    type: "multiselect",
    options: [
      "Head or neck",
      "Chest",
      "Abdomen or stomach",
      "Back",
      "Arms or hands",
      "Legs or feet",
      "Skin",
      "Whole body / general",
      "Not applicable",
    ],
    optionsBn: [
      "মাথা বা ঘাড়",
      "বুক",
      "পেট",
      "পিঠ",
      "হাত",
      "পা",
      "ত্বক",
      "সারা শরীর / সাধারণ",
      "প্রযোজ্য নয়",
    ],
    required: true,
  },
  {
    id: "duration",
    label: "How long has this been going on?",
    labelBn: "কতদিন ধরে এই সমস্যা চলছে?",
    type: "select",
    options: [
      "Less than 24 hours",
      "1–7 days",
      "1–4 weeks",
      "1–6 months",
      "More than 6 months",
    ],
    optionsBn: [
      "২৪ ঘণ্টার কম",
      "১–৭ দিন",
      "১–৪ সপ্তাহ",
      "১–৬ মাস",
      "৬ মাসের বেশি",
    ],
    required: true,
  },
  {
    id: "severity",
    label: "How much is it affecting your daily life right now? (1 = not much, 10 = severely)",
    labelBn: "এই মুহূর্তে এটি আপনার দৈনন্দিন জীবনে কতটা প্রভাব ফেলছে? (১ = সামান্য, ১০ = তীব্র)",
    type: "scale",
    required: true,
  },
  {
    id: "trajectory",
    label: "Is it getting worse, staying the same, or improving?",
    labelBn: "এটি কি খারাপ হচ্ছে, একই রকম আছে, নাকি উন্নতি হচ্ছে?",
    type: "select",
    options: ["Getting worse", "Staying the same", "Improving", "Comes and goes"],
    optionsBn: ["খারাপ হচ্ছে", "একই রকম", "উন্নতি হচ্ছে", "আসা-যাওয়া করে"],
    required: true,
  },
  {
    id: "current_medication",
    label: "Are you currently taking any medication for this? If yes, which?",
    labelBn: "এর জন্য বর্তমানে কোনো ওষুধ খাচ্ছেন? হ্যাঁ হলে কোনটি?",
    type: "textarea",
    helpText: "Include anything bought without a prescription. Write 'None' if not.",
  },
  {
    id: "existing_conditions",
    label: "Any ongoing conditions, past surgeries, or known allergies the doctor should know about?",
    labelBn: "ডাক্তারের জানা দরকার এমন কোনো দীর্ঘমেয়াদি রোগ, অতীতের অস্ত্রোপচার বা অ্যালার্জি আছে?",
    type: "textarea",
    helpText: "For example diabetes, high blood pressure, asthma. Write 'None' if not.",
  },
];

/** Extra questions layered on top of the common set, per specialization. */
const SPECIALIZATION_QUESTIONS: Record<string, IntakeQuestion[]> = {
  Cardiology: [
    {
      id: "card_exertion",
      label: "Do you get chest discomfort or breathlessness when walking or climbing stairs?",
      labelBn: "হাঁটা বা সিঁড়ি ওঠার সময় বুকে অস্বস্তি বা শ্বাসকষ্ট হয়?",
      type: "select",
      options: ["Yes, often", "Yes, occasionally", "No"],
      optionsBn: ["হ্যাঁ, প্রায়ই", "হ্যাঁ, মাঝে মাঝে", "না"],
      required: true,
      flagIfAnswerIn: ["Yes, often"],
      flagReason: "Reports frequent chest discomfort or breathlessness on exertion",
    },
    {
      id: "card_palpitations",
      label: "Do you notice palpitations, dizziness, or swelling in your legs?",
      labelBn: "বুক ধড়फড়, মাথা ঘোরা, বা পা ফোলা লক্ষ্য করেন?",
      type: "multiselect",
      options: ["Palpitations", "Dizziness or fainting", "Swelling in legs", "None of these"],
      optionsBn: ["বুক ধড়ফড়", "মাথা ঘোরা বা অজ্ঞান হওয়া", "পা ফোলা", "এর কোনোটিই নয়"],
      flagIfAnswerIn: ["Dizziness or fainting"],
      flagReason: "Reports dizziness or fainting episodes",
    },
    {
      id: "card_history",
      label: "Has anyone in your immediate family had heart disease or a stroke before age 60?",
      labelBn: "আপনার নিকট আত্মীয়ের কারও ৬০ বছর বয়সের আগে হৃদরোগ বা স্ট্রোক হয়েছে?",
      type: "select",
      options: ["Yes", "No", "Don't know"],
      optionsBn: ["হ্যাঁ", "না", "জানি না"],
    },
  ],
  Psychiatry: [
    {
      id: "psy_duration_mood",
      label: "How long have you been feeling this way?",
      labelBn: "কতদিন ধরে এমন অনুভব করছেন?",
      type: "select",
      options: ["Less than 2 weeks", "2 weeks – 3 months", "3–12 months", "More than a year"],
      optionsBn: ["২ সপ্তাহের কম", "২ সপ্তাহ – ৩ মাস", "৩–১২ মাস", "এক বছরের বেশি"],
      required: true,
    },
    {
      id: "psy_sleep_appetite",
      label: "Have there been changes in your sleep, appetite, or energy?",
      labelBn: "আপনার ঘুম, ক্ষুধা বা শক্তিতে পরিবর্তন এসেছে?",
      type: "multiselect",
      options: [
        "Sleeping much less",
        "Sleeping much more",
        "Eating much less",
        "Eating much more",
        "Very low energy",
        "No major change",
      ],
      optionsBn: [
        "অনেক কম ঘুমাচ্ছি",
        "অনেক বেশি ঘুমাচ্ছি",
        "অনেক কম খাচ্ছি",
        "অনেক বেশি খাচ্ছি",
        "খুব কম শক্তি",
        "উল্লেখযোগ্য পরিবর্তন নেই",
      ],
    },
    {
      id: "psy_support",
      label: "Is there someone in your life you can talk to about this?",
      labelBn: "আপনার জীবনে এমন কেউ আছেন যার সাথে এ বিষয়ে কথা বলতে পারেন?",
      type: "select",
      options: ["Yes", "Not really", "No one"],
      optionsBn: ["হ্যাঁ", "তেমন নয়", "কেউ না"],
    },
    {
      id: "psy_safety",
      label:
        "In the past two weeks, have you had thoughts of harming yourself or that you would be better off not alive?",
      labelBn:
        "গত দুই সপ্তাহে কি নিজের ক্ষতি করার বা বেঁচে না থাকাই ভালো হতো এমন চিন্তা এসেছে?",
      type: "select",
      options: ["No", "Yes, occasionally", "Yes, often", "I would rather not answer"],
      optionsBn: [
        "না",
        "হ্যাঁ, মাঝে মাঝে",
        "হ্যাঁ, প্রায়ই",
        "উত্তর দিতে চাই না",
      ],
      required: true,
      helpText:
        "You can answer honestly here. It goes only to the doctor you are booking.",
      flagIfAnswerIn: ["Yes, occasionally", "Yes, often"],
      flagReason: "Patient reported thoughts of self-harm on the intake form",
      showCrisisSupportIfAnswerIn: ["Yes, occasionally", "Yes, often"],
    },
  ],
  Medicine: [
    {
      id: "med_fever",
      label: "Do you have a fever, and if so for how long?",
      labelBn: "জ্বর আছে? থাকলে কতদিন ধরে?",
      type: "select",
      options: ["No fever", "Fever under 3 days", "Fever 3–7 days", "Fever more than a week"],
      optionsBn: ["জ্বর নেই", "৩ দিনের কম", "৩–৭ দিন", "এক সপ্তাহের বেশি"],
      required: true,
      flagIfAnswerIn: ["Fever more than a week"],
      flagReason: "Fever lasting more than a week",
    },
    {
      id: "med_weight",
      label: "Any unexplained weight loss or loss of appetite recently?",
      labelBn: "সম্প্রতি কোনো অব্যাখ্যাত ওজন হ্রাস বা ক্ষুধামন্দা?",
      type: "select",
      options: ["Yes", "No", "Not sure"],
      optionsBn: ["হ্যাঁ", "না", "নিশ্চিত নই"],
    },
    {
      id: "med_tests",
      label: "Have you had any recent tests done for this? (blood test, X-ray, etc.)",
      labelBn: "এর জন্য সম্প্রতি কোনো পরীক্ষা করিয়েছেন? (রক্ত পরীক্ষা, এক্স-রে ইত্যাদি)",
      type: "textarea",
      helpText: "You can bring the reports to your consultation.",
    },
  ],
  Pediatrics: [
    {
      id: "ped_age",
      label: "How old is the child?",
      labelBn: "শিশুটির বয়স কত?",
      type: "text",
      required: true,
    },
    {
      id: "ped_feeding",
      label: "Any change in feeding, drinking, or wet nappies/urination?",
      labelBn: "খাওয়া, পানি পান বা প্রস্রাবে কোনো পরিবর্তন?",
      type: "select",
      options: ["Feeding normally", "Feeding less than usual", "Refusing to feed", "Not sure"],
      optionsBn: ["স্বাভাবিক খাচ্ছে", "স্বাভাবিকের চেয়ে কম খাচ্ছে", "খেতে অস্বীকার করছে", "নিশ্চিত নই"],
      required: true,
      flagIfAnswerIn: ["Refusing to feed"],
      flagReason: "Child is refusing to feed",
    },
    {
      id: "ped_behaviour",
      label: "Is the child unusually drowsy, irritable, or less active than normal?",
      labelBn: "শিশুটি কি অস্বাভাবিকভাবে ঝিমিয়ে, খিটখিটে, বা কম সক্রিয়?",
      type: "select",
      options: ["Behaving normally", "A little off", "Very drowsy or hard to wake"],
      optionsBn: ["স্বাভাবিক আচরণ", "কিছুটা অস্বাভাবিক", "খুব ঝিমিয়ে বা জাগানো কঠিন"],
      required: true,
      flagIfAnswerIn: ["Very drowsy or hard to wake"],
      flagReason: "Child described as very drowsy or hard to wake",
    },
    {
      id: "ped_vaccination",
      label: "Are the child's vaccinations up to date?",
      labelBn: "শিশুটির টিকা কি হালনাগাদ আছে?",
      type: "select",
      options: ["Yes", "No", "Not sure"],
      optionsBn: ["হ্যাঁ", "না", "নিশ্চিত নই"],
    },
  ],
  Dermatology: [
    {
      id: "derm_appearance",
      label: "How would you describe the skin problem?",
      labelBn: "ত্বকের সমস্যাটি কেমন?",
      type: "multiselect",
      options: ["Rash", "Itching", "Dry or flaking", "Acne or pimples", "Hair loss", "Nail changes", "A mole or lump"],
      optionsBn: ["র‍্যাশ", "চুলকানি", "শুষ্ক বা খসখসে", "ব্রণ", "চুল পড়া", "নখের পরিবর্তন", "তিল বা গোটা"],
      required: true,
    },
    {
      id: "derm_spreading",
      label: "Is it spreading to other parts of the body?",
      labelBn: "এটি কি শরীরের অন্য অংশে ছড়াচ্ছে?",
      type: "select",
      options: ["Yes, quickly", "Yes, slowly", "No, staying in one place"],
      optionsBn: ["হ্যাঁ, দ্রুত", "হ্যাঁ, ধীরে", "না, এক জায়গায় আছে"],
      required: true,
    },
    {
      id: "derm_products",
      label: "Have you used any cream, ointment, or home remedy on it?",
      labelBn: "এতে কোনো ক্রিম, মলম বা ঘরোয়া চিকিৎসা ব্যবহার করেছেন?",
      type: "textarea",
    },
  ],
  Gynecology: [
    {
      id: "gyn_pregnancy",
      label: "Are you currently pregnant, or could you be?",
      labelBn: "আপনি কি বর্তমানে গর্ভবতী, বা হতে পারেন?",
      type: "select",
      options: ["Yes", "No", "Possibly / not sure", "Prefer not to say"],
      optionsBn: ["হ্যাঁ", "না", "সম্ভবত / নিশ্চিত নই", "বলতে চাই না"],
      required: true,
    },
    {
      id: "gyn_cycle",
      label: "Any changes to your menstrual cycle?",
      labelBn: "মাসিক চক্রে কোনো পরিবর্তন?",
      type: "multiselect",
      options: ["Irregular timing", "Heavier than usual", "Lighter than usual", "More painful", "Stopped", "No change"],
      optionsBn: ["অনিয়মিত", "স্বাভাবিকের চেয়ে বেশি", "স্বাভাবিকের চেয়ে কম", "বেশি ব্যথা", "বন্ধ হয়ে গেছে", "কোনো পরিবর্তন নেই"],
    },
    {
      id: "gyn_bleeding",
      label: "Are you having any unusual bleeding right now?",
      labelBn: "এই মুহূর্তে কোনো অস্বাভাবিক রক্তক্ষরণ হচ্ছে?",
      type: "select",
      options: ["No", "Light spotting", "Heavy bleeding"],
      optionsBn: ["না", "হালকা দাগ", "ভারী রক্তক্ষরণ"],
      required: true,
      flagIfAnswerIn: ["Heavy bleeding"],
      flagReason: "Reports heavy bleeding",
    },
  ],
  Orthopedics: [
    {
      id: "ortho_cause",
      label: "Did this start after an injury, fall, or accident?",
      labelBn: "এটি কি কোনো আঘাত, পড়ে যাওয়া বা দুর্ঘটনার পর শুরু হয়েছে?",
      type: "select",
      options: ["Yes, a specific injury", "No, it came on gradually", "Not sure"],
      optionsBn: ["হ্যাঁ, নির্দিষ্ট আঘাত", "না, ধীরে ধীরে শুরু হয়েছে", "নিশ্চিত নই"],
      required: true,
    },
    {
      id: "ortho_weight",
      label: "Can you put weight on it / use it normally?",
      labelBn: "এতে ভর দিতে বা স্বাভাবিকভাবে ব্যবহার করতে পারেন?",
      type: "select",
      options: ["Yes, normally", "Yes, but it hurts", "No, I cannot"],
      optionsBn: ["হ্যাঁ, স্বাভাবিকভাবে", "হ্যাঁ, কিন্তু ব্যথা করে", "না, পারি না"],
      required: true,
      flagIfAnswerIn: ["No, I cannot"],
      flagReason: "Unable to bear weight on / use the affected area",
    },
    {
      id: "ortho_swelling",
      label: "Is there visible swelling, bruising, or deformity?",
      labelBn: "দৃশ্যমান ফোলা, কালশিটে দাগ বা বিকৃতি আছে?",
      type: "multiselect",
      options: ["Swelling", "Bruising", "Visible deformity", "None of these"],
      optionsBn: ["ফোলা", "কালশিটে দাগ", "দৃশ্যমান বিকৃতি", "এর কোনোটিই নয়"],
      flagIfAnswerIn: ["Visible deformity"],
      flagReason: "Reports visible deformity",
    },
  ],
  Neurology: [
    {
      id: "neuro_symptoms",
      label: "Which of these are you experiencing?",
      labelBn: "এগুলোর মধ্যে কোনটি অনুভব করছেন?",
      type: "multiselect",
      options: [
        "Headaches",
        "Numbness or tingling",
        "Weakness in an arm or leg",
        "Difficulty speaking",
        "Memory problems",
        "Tremor or shaking",
        "None of these",
      ],
      optionsBn: [
        "মাথাব্যথা",
        "অসাড়তা বা ঝিনঝিন",
        "হাত বা পায়ে দুর্বলতা",
        "কথা বলতে অসুবিধা",
        "স্মৃতিশক্তির সমস্যা",
        "কাঁপুনি",
        "এর কোনোটিই নয়",
      ],
      required: true,
      flagIfAnswerIn: ["Weakness in an arm or leg", "Difficulty speaking"],
      flagReason: "Reports limb weakness or speech difficulty",
    },
    {
      id: "neuro_onset",
      label: "Did the symptoms come on suddenly or gradually?",
      labelBn: "উপসর্গগুলো কি হঠাৎ নাকি ধীরে ধীরে শুরু হয়েছে?",
      type: "select",
      options: ["Suddenly, within minutes or hours", "Gradually over days or weeks", "Not sure"],
      optionsBn: ["হঠাৎ, মিনিট বা ঘণ্টার মধ্যে", "ধীরে ধীরে, দিন বা সপ্তাহ ধরে", "নিশ্চিত নই"],
      required: true,
      flagIfAnswerIn: ["Suddenly, within minutes or hours"],
      flagReason: "Sudden onset of neurological symptoms",
    },
    {
      id: "neuro_seizure",
      label: "Have you had any fainting episodes, blackouts, or seizures?",
      labelBn: "কোনো অজ্ঞান হওয়া, ব্ল্যাকআউট বা খিঁচুনি হয়েছে?",
      type: "select",
      options: ["No", "Yes, once", "Yes, more than once"],
      optionsBn: ["না", "হ্যাঁ, একবার", "হ্যাঁ, একাধিকবার"],
      flagIfAnswerIn: ["Yes, more than once"],
      flagReason: "Multiple fainting or seizure episodes",
    },
  ],
};

/** Build the full question list for a given specialization. */
export function getQuestionsForSpecialization(specialization: string): IntakeQuestion[] {
  const extra = SPECIALIZATION_QUESTIONS[specialization] ?? [];
  return [...COMMON_QUESTIONS, ...extra];
}

export interface SubmittedAnswer {
  questionId: string;
  question: string;
  answer: string | string[] | number;
}

/**
 * Decide whether a set of answers should be flagged for the doctor's
 * attention. Returns the reasons, not a diagnosis or a severity score.
 */
export function evaluateFlags(
  specialization: string,
  answers: SubmittedAnswer[]
): { flagged: boolean; reasons: string[] } {
  const questions = getQuestionsForSpecialization(specialization);
  const reasons: string[] = [];

  for (const q of questions) {
    if (!q.flagIfAnswerIn?.length) continue;
    const submitted = answers.find((a) => a.questionId === q.id);
    if (!submitted) continue;

    const given = Array.isArray(submitted.answer)
      ? submitted.answer
      : [String(submitted.answer)];

    if (given.some((g) => q.flagIfAnswerIn!.includes(g))) {
      reasons.push(q.flagReason ?? `Flagged answer to: ${q.label}`);
    }
  }

  // A very high daily-life impact rating also surfaces to the doctor.
  const severity = answers.find((a) => a.questionId === "severity");
  if (severity && Number(severity.answer) >= 8) {
    reasons.push(`Rated daily-life impact ${severity.answer}/10`);
  }

  return { flagged: reasons.length > 0, reasons };
}

/** Does this answer set warrant showing crisis resources to the patient? */
export function shouldShowCrisisSupport(
  specialization: string,
  answers: SubmittedAnswer[]
): boolean {
  const questions = getQuestionsForSpecialization(specialization);

  for (const q of questions) {
    if (!q.showCrisisSupportIfAnswerIn?.length) continue;
    const submitted = answers.find((a) => a.questionId === q.id);
    if (!submitted) continue;

    const given = Array.isArray(submitted.answer)
      ? submitted.answer
      : [String(submitted.answer)];

    if (given.some((g) => q.showCrisisSupportIfAnswerIn!.includes(g))) return true;
  }
  return false;
}
