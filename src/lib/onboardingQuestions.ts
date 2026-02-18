export interface WizardQuestion {
  id: string;
  question: string;
  multiSelect?: boolean;
  maxSelect?: number;
  options: string[];
}

export const WIZARD_QUESTIONS: WizardQuestion[] = [
  {
    id: "purpose",
    question: "What will you primarily use this vault for?",
    options: [
      "Personal knowledge",
      "Work",
      "Academic/Research",
      "Creative/Projects",
      "General second brain",
    ],
  },
  {
    id: "topics",
    question: "What topics interest you most? (pick up to 3)",
    multiSelect: true,
    maxSelect: 3,
    options: [
      "Technology",
      "Business",
      "Science",
      "Arts",
      "Self-improvement",
      "Mixed",
    ],
  },
  {
    id: "organization",
    question: "How do you prefer to organize?",
    options: ["By topic", "By project", "Flat with links", "Chronological"],
  },
  {
    id: "starter",
    question: "What starter content would help?",
    options: [
      "Templates & examples",
      "Pre-filled notes",
      "Empty structure only",
      "Full starter kit",
    ],
  },
];
