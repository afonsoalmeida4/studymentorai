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

// Level definitions - 50 levels with progressive XP requirements
export const LEVELS = [
  { level: 1, name: "Curioso", icon: "feather", minXp: 0 },
  { level: 2, name: "Aprendiz", icon: "feather", minXp: 100 },
  { level: 3, name: "Estudante", icon: "feather", minXp: 250 },
  { level: 4, name: "Dedicado", icon: "feather", minXp: 450 },
  { level: 5, name: "Focado", icon: "book-open", minXp: 700 },
  { level: 6, name: "Aplicado", icon: "book-open", minXp: 1000 },
  { level: 7, name: "Persistente", icon: "book-open", minXp: 1350 },
  { level: 8, name: "Determinado", icon: "book-open", minXp: 1750 },
  { level: 9, name: "Comprometido", icon: "book-open", minXp: 2200 },
  { level: 10, name: "Explorador", icon: "compass", minXp: 2700 },
  { level: 11, name: "Descobridor", icon: "compass", minXp: 3250 },
  { level: 12, name: "Investigador", icon: "compass", minXp: 3850 },
  { level: 13, name: "Pesquisador", icon: "compass", minXp: 4500 },
  { level: 14, name: "Analista", icon: "compass", minXp: 5200 },
  { level: 15, name: "Estrategista", icon: "target", minXp: 5950 },
  { level: 16, name: "Metódico", icon: "target", minXp: 6750 },
  { level: 17, name: "Organizado", icon: "target", minXp: 7600 },
  { level: 18, name: "Eficiente", icon: "target", minXp: 8500 },
  { level: 19, name: "Produtivo", icon: "target", minXp: 9450 },
  { level: 20, name: "Mentor Iniciante", icon: "brain", minXp: 10450 },
  { level: 21, name: "Mentor", icon: "brain", minXp: 11500 },
  { level: 22, name: "Mentor Avançado", icon: "brain", minXp: 12600 },
  { level: 23, name: "Conselheiro", icon: "brain", minXp: 13750 },
  { level: 24, name: "Guia", icon: "brain", minXp: 14950 },
  { level: 25, name: "Especialista", icon: "award", minXp: 16200 },
  { level: 26, name: "Expert", icon: "award", minXp: 17500 },
  { level: 27, name: "Profissional", icon: "award", minXp: 18850 },
  { level: 28, name: "Veterano", icon: "award", minXp: 20250 },
  { level: 29, name: "Mestre Iniciante", icon: "award", minXp: 21700 },
  { level: 30, name: "Mestre", icon: "trophy", minXp: 23200 },
  { level: 31, name: "Mestre Avançado", icon: "trophy", minXp: 24750 },
  { level: 32, name: "Grão-Mestre", icon: "trophy", minXp: 26350 },
  { level: 33, name: "Sábio Iniciante", icon: "trophy", minXp: 28000 },
  { level: 34, name: "Sábio", icon: "trophy", minXp: 29700 },
  { level: 35, name: "Sábio Avançado", icon: "sparkles", minXp: 31450 },
  { level: 36, name: "Iluminado", icon: "sparkles", minXp: 33250 },
  { level: 37, name: "Visionário", icon: "sparkles", minXp: 35100 },
  { level: 38, name: "Génio Iniciante", icon: "sparkles", minXp: 37000 },
  { level: 39, name: "Génio", icon: "sparkles", minXp: 38950 },
  { level: 40, name: "Génio Avançado", icon: "crown", minXp: 40950 },
  { level: 41, name: "Virtuoso", icon: "crown", minXp: 43000 },
  { level: 42, name: "Prodígio", icon: "crown", minXp: 45100 },
  { level: 43, name: "Fenómeno", icon: "crown", minXp: 47250 },
  { level: 44, name: "Elite", icon: "crown", minXp: 49450 },
  { level: 45, name: "Lenda Iniciante", icon: "rocket", minXp: 51700 },
  { level: 46, name: "Lenda", icon: "rocket", minXp: 54000 },
  { level: 47, name: "Lenda Avançada", icon: "rocket", minXp: 56350 },
  { level: 48, name: "Mito", icon: "rocket", minXp: 58750 },
  { level: 49, name: "Transcendente", icon: "rocket", minXp: 61200 },
  { level: 50, name: "Mestre do Foco", icon: "rocket", minXp: 63700 },
] as const;

export const TOTAL_LEVELS = LEVELS.length;

// Helper function to get current level from XP
export function getLevelFromXP(totalXp: number): {
  level: string;
  levelNumber: number;
  icon: string;
  name: string;
  progress: number;
  nextLevelXp: number;
  currentLevelXp: number;
  totalLevels: number;
} {
  let currentLevelIndex = 0;
  
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVELS[i].minXp) {
      currentLevelIndex = i;
      break;
    }
  }
  
  const currentLevel = LEVELS[currentLevelIndex];
  const nextLevel = LEVELS[currentLevelIndex + 1];
  
  if (!nextLevel) {
    return {
      level: `level_${currentLevel.level}`,
      levelNumber: currentLevel.level,
      icon: currentLevel.icon,
      name: currentLevel.name,
      progress: 100,
      nextLevelXp: Infinity,
      currentLevelXp: currentLevel.minXp,
      totalLevels: TOTAL_LEVELS,
    };
  }
  
  const xpInCurrentLevel = totalXp - currentLevel.minXp;
  const xpNeededForNextLevel = nextLevel.minXp - currentLevel.minXp;
  const progress = (xpInCurrentLevel / xpNeededForNextLevel) * 100;
  
  return {
    level: `level_${currentLevel.level}`,
    levelNumber: currentLevel.level,
    icon: currentLevel.icon,
    name: currentLevel.name,
    progress: Math.min(progress, 100),
    nextLevelXp: nextLevel.minXp,
    currentLevelXp: currentLevel.minXp,
    totalLevels: TOTAL_LEVELS,
  };
}

// Motivational messages based on ranking position
export function getMotivationalMessage(position: number, pointsToNext?: number): string {
  if (position === 1) {
    return `You're #1! Incredible work! Keep up this pace!`;
  } else if (position === 2) {
    return `In second place! ${pointsToNext ? `Only ${pointsToNext} XP to reach #1!` : "Keep going!"}`;
  } else if (position === 3) {
    return `On the podium! ${pointsToNext ? `Just ${pointsToNext} XP to move up!` : "Excellent!"}`;
  } else if (position <= 10) {
    return `Top 10! ${pointsToNext ? `${pointsToNext} XP to overtake the next!` : "Keep studying!"}`;
  } else {
    return "Keep earning XP and climb the rankings! Every study counts!";
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
