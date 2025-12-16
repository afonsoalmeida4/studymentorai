import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Brain, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  ChevronLeft,
  RefreshCw,
  Trophy,
  Clock,
  Target,
  Lightbulb,
  Play,
  RotateCcw,
  Zap,
  Flame,
  GraduationCap,
  Star,
  Award,
  TrendingUp,
  PartyPopper
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import type { Quiz, QuizQuestion, QuizDifficulty } from "@shared/schema";

interface QuizSectionProps {
  topicId: string;
  hasSummaries: boolean;
}

interface QuizOption {
  id: string;
  text: string;
}

interface QuizQuestionWithOptions extends QuizQuestion {
  options: QuizOption[];
}

interface GenerateQuizResponse {
  success: boolean;
  quiz: Quiz;
  questions: QuizQuestionWithOptions[];
  isExisting: boolean;
}

interface SubmitQuizResponse {
  success: boolean;
  attemptId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  results: {
    questionId: string;
    questionText: string;
    selectedOptionId: string;
    correctOptionId: string;
    isCorrect: boolean;
    explanation: string;
    options: QuizOption[];
  }[];
}

type QuizState = "setup" | "taking" | "results";

const difficultyConfig = {
  easy: {
    icon: Zap,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    selectedBg: "bg-emerald-500",
    selectedBorder: "border-emerald-500",
    gradient: "from-emerald-500/20 to-emerald-600/10"
  },
  medium: {
    icon: Flame,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    selectedBg: "bg-amber-500",
    selectedBorder: "border-amber-500",
    gradient: "from-amber-500/20 to-amber-600/10"
  },
  hard: {
    icon: GraduationCap,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-500/30",
    selectedBg: "bg-rose-500",
    selectedBorder: "border-rose-500",
    gradient: "from-rose-500/20 to-rose-600/10"
  }
};

const questionCountOptions = [5, 10, 15, 20];

export default function QuizSection({ topicId, hasSummaries }: QuizSectionProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  
  const [quizState, setQuizState] = useState<QuizState>("setup");
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("medium");
  const [questionCount, setQuestionCount] = useState(10);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizData, setQuizData] = useState<GenerateQuizResponse | null>(null);
  const [results, setResults] = useState<SubmitQuizResponse | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [showExplanations, setShowExplanations] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  const previousLanguageRef = useRef(i18n.language);
  
  useEffect(() => {
    if (previousLanguageRef.current !== i18n.language) {
      if (quizState !== "setup") {
        setQuizState("setup");
        setQuizData(null);
        setResults(null);
        setAnswers({});
        setCurrentQuestionIndex(0);
        setStartTime(null);
        setShowExplanations(false);
      }
      previousLanguageRef.current = i18n.language;
    }
  }, [i18n.language, quizState]);

  const generateQuizMutation = useMutation({
    mutationFn: async ({ topicId, difficulty, questionCount }: { topicId: string; difficulty: QuizDifficulty; questionCount: number }) => {
      const response = await apiRequest("POST", "/api/quizzes/generate", {
        topicId,
        difficulty,
        questionCount,
      });
      return response as GenerateQuizResponse;
    },
    onSuccess: (data) => {
      setQuizData(data);
      setQuizState("taking");
      setCurrentQuestionIndex(0);
      setAnswers({});
      setStartTime(Date.now());
      toast({
        title: t("quiz.title"),
        description: t("quiz.success.generated"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("quiz.error.generate"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const submitQuizMutation = useMutation({
    mutationFn: async ({ quizId, answers, timeSpentSeconds }: { quizId: string; answers: { questionId: string; selectedOptionId: string }[]; timeSpentSeconds: number }) => {
      const response = await apiRequest("POST", `/api/quizzes/${quizId}/submit`, {
        answers,
        timeSpentSeconds,
      });
      return response as SubmitQuizResponse;
    },
    onSuccess: (data) => {
      setResults(data);
      setQuizState("results");
      toast({
        title: t("quiz.success.submitted"),
        description: `${data.score}/${data.totalQuestions} (${data.percentage}%)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("quiz.error.submit"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const regenerateQuizMutation = useMutation({
    mutationFn: async (quizId: string) => {
      const response = await apiRequest("POST", `/api/quizzes/${quizId}/regenerate`, {});
      return response as GenerateQuizResponse;
    },
    onSuccess: (data) => {
      setQuizData(data);
      setQuizState("taking");
      setCurrentQuestionIndex(0);
      setAnswers({});
      setStartTime(Date.now());
      toast({
        title: t("quiz.regenerate"),
        description: t("quiz.success.generated"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("quiz.error.generate"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleStartQuiz = () => {
    generateQuizMutation.mutate({ topicId, difficulty, questionCount });
  };

  const handleSelectAnswer = (questionId: string, optionId: string) => {
    setSelectedOption(optionId);
    setTimeout(() => {
      setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
      setSelectedOption(null);
    }, 150);
  };

  const handleNextQuestion = () => {
    if (quizData && currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleSubmitQuiz = () => {
    if (!quizData) return;

    const timeSpentSeconds = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    const answersArray = Object.entries(answers).map(([questionId, selectedOptionId]) => ({
      questionId,
      selectedOptionId,
    }));

    submitQuizMutation.mutate({
      quizId: quizData.quiz.id,
      answers: answersArray,
      timeSpentSeconds,
    });
  };

  const handleRetakeQuiz = () => {
    setQuizState("taking");
    setCurrentQuestionIndex(0);
    setAnswers({});
    setStartTime(Date.now());
    setResults(null);
    setShowExplanations(false);
  };

  const handleRegenerateQuiz = () => {
    if (quizData?.quiz.id) {
      regenerateQuizMutation.mutate(quizData.quiz.id);
    }
  };

  const handleBackToSetup = () => {
    setQuizState("setup");
    setQuizData(null);
    setResults(null);
    setAnswers({});
    setShowExplanations(false);
  };

  const currentQuestion = quizData?.questions[currentQuestionIndex];
  const progress = quizData ? ((currentQuestionIndex + 1) / quizData.questions.length) * 100 : 0;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = quizData ? answeredCount === quizData.questions.length : false;

  const getMasteryLevel = (percentage: number) => {
    if (percentage >= 90) return { level: "mastered", color: "text-emerald-500", bg: "bg-emerald-500/10", icon: Trophy };
    if (percentage >= 70) return { level: "familiar", color: "text-blue-500", bg: "bg-blue-500/10", icon: Star };
    if (percentage >= 50) return { level: "learning", color: "text-amber-500", bg: "bg-amber-500/10", icon: TrendingUp };
    return { level: "unfamiliar", color: "text-rose-500", bg: "bg-rose-500/10", icon: Target };
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!hasSummaries) {
    return (
      <Card className="border-dashed border-2 border-muted overflow-visible">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20">
              <Brain className="h-5 w-5 text-violet-500" />
            </div>
            {t("quiz.title")}
          </CardTitle>
          <CardDescription>{t("quiz.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <div className="p-4 rounded-2xl bg-muted/50 mb-4">
              <Sparkles className="h-10 w-10 opacity-50" />
            </div>
            <p className="text-sm font-medium">{t("quiz.empty.title")}</p>
            <p className="text-xs mt-1 text-muted-foreground/70">{t("quiz.empty.noSummary")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (quizState === "setup") {
    const DifficultyIcon = difficultyConfig[difficulty].icon;
    
    return (
      <Card data-testid="quiz-section-setup" className="overflow-visible">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20">
              <Brain className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <CardTitle className="text-lg">{t("quiz.title")}</CardTitle>
              <CardDescription className="text-sm">{t("quiz.subtitle")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">{t("quiz.difficulty.title")}</label>
            <div className="grid grid-cols-3 gap-3">
              {(["easy", "medium", "hard"] as QuizDifficulty[]).map((level) => {
                const config = difficultyConfig[level];
                const Icon = config.icon;
                const isSelected = difficulty === level;
                
                return (
                  <motion.button
                    key={level}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setDifficulty(level)}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      isSelected 
                        ? `${config.selectedBorder} ${config.bgColor}` 
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                    data-testid={`difficulty-${level}`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`p-2 rounded-lg ${config.bgColor}`}>
                        <Icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <span className={`text-sm font-medium ${isSelected ? config.color : "text-foreground"}`}>
                        {t(`quiz.difficulty.${level}`)}
                      </span>
                    </div>
                    {isSelected && (
                      <motion.div
                        layoutId="difficulty-indicator"
                        className={`absolute -top-1 -right-1 w-4 h-4 rounded-full ${config.selectedBg} flex items-center justify-center`}
                      >
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground">{t("quiz.questionCount")}</label>
            <div className="flex gap-2 flex-wrap">
              {questionCountOptions.map((count) => (
                <motion.button
                  key={count}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setQuestionCount(count)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    questionCount === count
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  data-testid={`question-count-${count}`}
                >
                  {count} {t("quiz.questions")}
                </motion.button>
              ))}
            </div>
          </div>

          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <Button
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25"
              onClick={handleStartQuiz}
              disabled={generateQuizMutation.isPending}
              data-testid="button-start-quiz"
            >
              {generateQuizMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t("quiz.generating")}
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  {t("quiz.startQuiz")}
                </>
              )}
            </Button>
          </motion.div>

          <div className="flex items-center justify-center gap-6 pt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" />
              <span>{t("quiz.aiPowered")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" />
              <span>{t("quiz.withExplanations")}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (quizState === "taking" && quizData && currentQuestion) {
    return (
      <Card data-testid="quiz-section-taking" className="overflow-visible">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20">
                <Brain className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {t("quiz.question")} {currentQuestionIndex + 1} {t("quiz.of")} {quizData.questions.length}
                </CardTitle>
              </div>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              <Target className="h-3 w-3 mr-1" />
              {answeredCount}/{quizData.questions.length}
            </Badge>
          </div>
          <div className="mt-3">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
              <span>{Math.round(progress)}% {t("quiz.progress")}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {startTime && formatTime(Math.floor((Date.now() - startTime) / 1000))}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <p className="text-base font-medium leading-relaxed py-2" data-testid="quiz-question-text">
                {currentQuestion.questionText}
              </p>

              <div className="space-y-2.5">
                {currentQuestion.options.map((option) => {
                  const isSelected = answers[currentQuestion.id] === option.id;
                  const isAnimating = selectedOption === option.id;
                  
                  return (
                    <motion.button
                      key={option.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      animate={isAnimating ? { scale: [1, 0.98, 1] } : {}}
                      onClick={() => handleSelectAnswer(currentQuestion.id, option.id)}
                      className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
                      }`}
                      data-testid={`quiz-option-${option.id}`}
                    >
                      <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {option.id}
                      </div>
                      <span className="text-sm pt-0.5">{option.text}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between pt-4 border-t gap-3">
            <Button
              variant="outline"
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0}
              data-testid="button-previous-question"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">{t("quiz.previous")}</span>
            </Button>

            <div className="flex gap-1.5 overflow-x-auto py-1 px-1 max-w-[200px] sm:max-w-none">
              {quizData.questions.map((q, idx) => (
                <motion.button
                  key={q.id}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`flex-shrink-0 w-7 h-7 rounded-full text-xs font-semibold transition-all ${
                    idx === currentQuestionIndex
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : answers[q.id]
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  data-testid={`quiz-nav-${idx + 1}`}
                >
                  {answers[q.id] ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    idx + 1
                  )}
                </motion.button>
              ))}
            </div>

            {currentQuestionIndex === quizData.questions.length - 1 ? (
              <Button
                onClick={handleSubmitQuiz}
                disabled={!allAnswered || submitQuizMutation.isPending}
                className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
                data-testid="button-submit-quiz"
              >
                {submitQuizMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">{t("quiz.finish")}</span>
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleNextQuestion} data-testid="button-next-question">
                <span className="hidden sm:inline">{t("quiz.next")}</span>
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (quizState === "results" && results) {
    const timeSpentSeconds = startTime ? Math.floor((Date.now() - startTime) / 1000) : results.results.length * 60;
    const mastery = getMasteryLevel(results.percentage);
    const MasteryIcon = mastery.icon;
    
    return (
      <Card data-testid="quiz-section-results" className="overflow-visible">
        <CardHeader className="pb-4 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="mx-auto mb-3"
          >
            {results.percentage >= 70 ? (
              <div className="relative">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-400/20 to-yellow-500/20">
                  <Trophy className="h-10 w-10 text-amber-500" />
                </div>
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="absolute -top-1 -right-1"
                >
                  <PartyPopper className="h-5 w-5 text-amber-500" />
                </motion.div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20">
                <Award className="h-10 w-10 text-violet-500" />
              </div>
            )}
          </motion.div>
          <CardTitle className="text-xl">{t("quiz.results.title")}</CardTitle>
          <CardDescription className="text-base">
            {results.percentage >= 90 ? t("quiz.results.excellent") : 
             results.percentage >= 70 ? t("quiz.results.good") : 
             t("quiz.results.needsImprovement")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative"
          >
            <div className="flex items-center justify-center py-6">
              <div className="relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-muted/30"
                  />
                  <motion.circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeLinecap="round"
                    className={results.percentage >= 70 ? "text-emerald-500" : results.percentage >= 50 ? "text-amber-500" : "text-rose-500"}
                    initial={{ strokeDasharray: "0 352" }}
                    animate={{ strokeDasharray: `${(results.percentage / 100) * 352} 352` }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-3xl font-bold"
                  >
                    {results.percentage}%
                  </motion.span>
                  <span className="text-xs text-muted-foreground">{t("quiz.results.score")}</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-3 gap-3"
          >
            <div className="p-3 rounded-xl bg-muted/50 text-center">
              <div className="text-xl font-bold">{results.score}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                {t("quiz.results.correct")}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 text-center">
              <div className="text-xl font-bold">{results.totalQuestions - results.score}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <XCircle className="h-3 w-3 text-rose-500" />
                {t("quiz.results.incorrect")}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 text-center">
              <div className="text-xl font-bold">{formatTime(timeSpentSeconds)}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" />
                {t("quiz.results.time")}
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className={`p-3 rounded-xl ${mastery.bg} flex items-center justify-center gap-2`}
          >
            <MasteryIcon className={`h-5 w-5 ${mastery.color}`} />
            <span className={`text-sm font-medium ${mastery.color}`}>
              {t(`quiz.mastery.${mastery.level}`)}
            </span>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap gap-2"
          >
            <Button variant="outline" onClick={handleRetakeQuiz} className="flex-1 min-w-[120px]" data-testid="button-retake-quiz">
              <RotateCcw className="h-4 w-4 mr-2" />
              {t("quiz.retakeQuiz")}
            </Button>
            <Button
              variant="outline"
              onClick={handleRegenerateQuiz}
              disabled={regenerateQuizMutation.isPending}
              className="flex-1 min-w-[120px]"
              data-testid="button-regenerate-quiz"
            >
              {regenerateQuizMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t("quiz.regenerate")}
            </Button>
          </motion.div>

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setShowExplanations(!showExplanations)}
            data-testid="button-toggle-explanations"
          >
            <Lightbulb className={`h-4 w-4 mr-2 transition-colors ${showExplanations ? "text-amber-500" : ""}`} />
            {showExplanations ? t("quiz.results.hideDetails") : t("quiz.results.viewDetails")}
          </Button>

          <AnimatePresence>
            {showExplanations && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                {results.results.map((result, idx) => (
                  <motion.div
                    key={result.questionId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`p-4 rounded-xl border-2 ${
                      result.isCorrect 
                        ? "border-emerald-500/30 bg-emerald-500/5" 
                        : "border-rose-500/30 bg-rose-500/5"
                    }`}
                    data-testid={`quiz-result-${idx + 1}`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                        result.isCorrect ? "bg-emerald-500" : "bg-rose-500"
                      }`}>
                        {result.isCorrect ? (
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        ) : (
                          <XCircle className="h-4 w-4 text-white" />
                        )}
                      </div>
                      <p className="font-medium text-sm leading-relaxed">{result.questionText}</p>
                    </div>

                    <div className="space-y-2 ml-9 text-sm">
                      {!result.isCorrect && (
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-rose-500/10">
                          <XCircle className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">{t("quiz.explanation.yourAnswer")}</span>
                            <p className="text-foreground">{result.options.find((o) => o.id === result.selectedOptionId)?.text}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/10">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{t("quiz.explanation.correctAnswer")}</span>
                          <p className="text-foreground">{result.options.find((o) => o.id === result.correctOptionId)?.text}</p>
                        </div>
                      </div>
                      <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{t("quiz.explanation.title")}</span>
                            <p className="text-muted-foreground mt-1">{result.explanation}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                <Button 
                  variant="outline" 
                  onClick={handleBackToSetup} 
                  className="w-full mt-4"
                  data-testid="button-back-setup"
                >
                  {t("common.back")}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    );
  }

  return null;
}
