// XP rewards for different actions
export const XP_REWARDS = {
  UPLOAD_PDF: 50,
  GENERATE_SUMMARY: 100,
  CREATE_FLASHCARDS: 30,
  ANSWER_FLASHCARD: 5, // Per flashcard answered
  ANSWER_FLASHCARD_CORRECT_BONUS: 3, // Bonus for correct answer
  COMPLETE_STUDY_SESSION_BASE: 20,
  CORRECT_FLASHCARD_BONUS: 5,
  DAILY_STREAK_BONUS: 25,  // After 3+ consecutive days
  DAILY_CHAT_INTERACTION: 40, // Once per day for Premium users
  LEVEL_UP_BONUS: 50,
} as const;

// Helper function to calculate study session XP
export function calculateStudySessionXP(correctCards: number): number {
  return XP_REWARDS.COMPLETE_STUDY_SESSION_BASE + (correctCards * XP_REWARDS.CORRECT_FLASHCARD_BONUS);
}

// Helper function to get current level from XP
export function getLevelFromXP(totalXp: number): {
  level: string;
  icon: string; // lucide-react icon name
  name: string;
  progress: number; // 0-100%
  nextLevelXp: number;
  currentLevelXp: number;
} {
  if (totalXp >= 2000) {
    return {
      level: "mestre",
      icon: "rocket",
      name: "Mestre do Foco",
      progress: 100,
      nextLevelXp: Infinity,
      currentLevelXp: 2000,
    };
  } else if (totalXp >= 900) {
    const progress = ((totalXp - 900) / (2000 - 900)) * 100;
    return {
      level: "mentor",
      icon: "brain",
      name: "Mentor",
      progress: Math.min(progress, 100),
      nextLevelXp: 2000,
      currentLevelXp: 900,
    };
  } else if (totalXp >= 300) {
    const progress = ((totalXp - 300) / (900 - 300)) * 100;
    return {
      level: "explorador",
      icon: "book-open",
      name: "Explorador",
      progress: Math.min(progress, 100),
      nextLevelXp: 900,
      currentLevelXp: 300,
    };
  } else {
    const progress = (totalXp / 300) * 100;
    return {
      level: "iniciante",
      icon: "feather",
      name: "Iniciante",
      progress: Math.min(progress, 100),
      nextLevelXp: 300,
      currentLevelXp: 0,
    };
  }
}

// Motivational messages based on ranking position
export function getMotivationalMessage(position: number, pointsToNext?: number): string {
  if (position === 1) {
    return `És o número 1! Incrível trabalho! Continue neste ritmo!`;
  } else if (position === 2) {
    return `Em segundo lugar! ${pointsToNext ? `Faltam apenas ${pointsToNext} XP para o 1º lugar!` : "Continua assim!"}`;
  } else if (position === 3) {
    return `No pódio! ${pointsToNext ? `Só precisas de mais ${pointsToNext} XP para subir!` : "Excelente!"}`;
  } else if (position <= 10) {
    return `No Top 10! ${pointsToNext ? `Faltam ${pointsToNext} XP para ultrapassares o próximo!` : "Continua a estudar!"}`;
  } else {
    return "Continua a ganhar XP e sobe no ranking! Cada estudo conta!";
  }
}

// Premium benefits description (icons are lucide-react icon names)
export const PREMIUM_BENEFITS = [
  {
    icon: "graduation-cap",
    title: "Resumos Ilimitados",
    description: "Gere tantos resumos quantos precisares, sem limites",
  },
  {
    icon: "brain",
    title: "Mentor IA Exclusivo",
    description: "Chat com um mentor motivador que te ajuda a estudar melhor",
  },
  {
    icon: "layers",
    title: "Flashcards Premium",
    description: "Até 20 flashcards por resumo (vs. 5-10 no plano gratuito)",
  },
  {
    icon: "gem",
    title: "Tema Dourado Exclusivo",
    description: "Interface premium com cores e ícones especiais",
  },
  {
    icon: "bar-chart-3",
    title: "Estatísticas Avançadas",
    description: "Análises detalhadas do teu progresso e desempenho",
  },
  {
    icon: "zap",
    title: "XP Bónus Diário",
    description: "Ganha +40 XP por cada conversa diária com o mentor",
  },
] as const;
