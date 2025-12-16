import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
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
  RotateCcw
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import type { Quiz, QuizQuestion, QuizAttempt, QuizDifficulty } from "@shared/schema";

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

export default function QuizSection({ topicId, hasSummaries }: QuizSectionProps) {
  const { t } = useTranslation();
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
      if (data.isExisting) {
        toast({
          title: t("quiz.title"),
          description: t("quiz.success.generated"),
        });
      } else {
        toast({
          title: t("quiz.title"),
          description: t("quiz.success.generated"),
        });
      }
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
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
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

  const getScoreMessage = (percentage: number) => {
    if (percentage >= 90) return t("quiz.results.excellent");
    if (percentage >= 70) return t("quiz.results.good");
    return t("quiz.results.needsImprovement");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!hasSummaries) {
    return (
      <Card className="border-dashed border-2 border-muted">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            {t("quiz.title")}
          </CardTitle>
          <CardDescription>{t("quiz.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Sparkles className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm font-medium">{t("quiz.empty.title")}</p>
            <p className="text-xs mt-1">{t("quiz.empty.noSummary")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (quizState === "setup") {
    return (
      <Card data-testid="quiz-section-setup">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            {t("quiz.title")}
          </CardTitle>
          <CardDescription>{t("quiz.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="difficulty">{t("quiz.difficulty.title")}</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as QuizDifficulty)}>
                <SelectTrigger id="difficulty" data-testid="select-difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">{t("quiz.difficulty.easy")}</SelectItem>
                  <SelectItem value="medium">{t("quiz.difficulty.medium")}</SelectItem>
                  <SelectItem value="hard">{t("quiz.difficulty.hard")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="questionCount">{t("quiz.questionCount")}</Label>
              <Select value={questionCount.toString()} onValueChange={(v) => setQuestionCount(parseInt(v))}>
                <SelectTrigger id="questionCount" data-testid="select-question-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 {t("quiz.questions")}</SelectItem>
                  <SelectItem value="10">10 {t("quiz.questions")}</SelectItem>
                  <SelectItem value="15">15 {t("quiz.questions")}</SelectItem>
                  <SelectItem value="20">20 {t("quiz.questions")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleStartQuiz}
            disabled={generateQuizMutation.isPending}
            data-testid="button-start-quiz"
          >
            {generateQuizMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("quiz.generating")}
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                {t("quiz.startQuiz")}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (quizState === "taking" && quizData && currentQuestion) {
    return (
      <Card data-testid="quiz-section-taking">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-primary" />
              {t("quiz.question")} {currentQuestionIndex + 1} {t("quiz.of")} {quizData.questions.length}
            </CardTitle>
            <Badge variant="outline">
              {answeredCount}/{quizData.questions.length}
            </Badge>
          </div>
          <Progress value={progress} className="h-2 mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestionIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <p className="text-base font-medium leading-relaxed" data-testid="quiz-question-text">
                {currentQuestion.questionText}
              </p>

              <RadioGroup
                value={answers[currentQuestion.id] || ""}
                onValueChange={(value) => handleSelectAnswer(currentQuestion.id, value)}
                className="space-y-3"
              >
                {currentQuestion.options.map((option, index) => (
                  <div
                    key={option.id}
                    className={`flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer hover-elevate ${
                      answers[currentQuestion.id] === option.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                    onClick={() => handleSelectAnswer(currentQuestion.id, option.id)}
                    data-testid={`quiz-option-${option.id}`}
                  >
                    <RadioGroupItem value={option.id} id={`option-${option.id}`} />
                    <Label
                      htmlFor={`option-${option.id}`}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      <span className="font-semibold mr-2">{option.id}.</span>
                      {option.text}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0}
              data-testid="button-previous-question"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t("quiz.previous")}
            </Button>

            {currentQuestionIndex === quizData.questions.length - 1 ? (
              <Button
                onClick={handleSubmitQuiz}
                disabled={!allAnswered || submitQuizMutation.isPending}
                data-testid="button-submit-quiz"
              >
                {submitQuizMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("quiz.submitting")}
                  </>
                ) : (
                  <>
                    <Target className="mr-2 h-4 w-4" />
                    {t("quiz.finish")}
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleNextQuestion} data-testid="button-next-question">
                {t("quiz.next")}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {quizData.questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestionIndex(idx)}
                className={`w-8 h-8 rounded-full text-xs font-medium transition-all ${
                  idx === currentQuestionIndex
                    ? "bg-primary text-primary-foreground"
                    : answers[q.id]
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
                data-testid={`quiz-nav-${idx + 1}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (quizState === "results" && results) {
    const timeSpentSeconds = startTime ? Math.floor((Date.now() - startTime) / 1000) : results.results.length * 60;
    
    return (
      <Card data-testid="quiz-section-results">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trophy className="h-5 w-5 text-yellow-500" />
            {t("quiz.results.title")}
          </CardTitle>
          <CardDescription>{getScoreMessage(results.percentage)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-lg bg-primary/5">
              <div className="text-2xl font-bold text-primary">{results.percentage}%</div>
              <div className="text-xs text-muted-foreground">{t("quiz.results.percentage")}</div>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10">
              <div className="text-2xl font-bold text-green-600">{results.score}</div>
              <div className="text-xs text-muted-foreground">{t("quiz.results.correct")}</div>
            </div>
            <div className="p-4 rounded-lg bg-red-500/10">
              <div className="text-2xl font-bold text-red-600">
                {results.totalQuestions - results.score}
              </div>
              <div className="text-xs text-muted-foreground">{t("quiz.results.incorrect")}</div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {t("quiz.results.timeSpent")}: {formatTime(timeSpentSeconds)}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleRetakeQuiz} data-testid="button-retake-quiz">
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("quiz.retakeQuiz")}
            </Button>
            <Button
              variant="outline"
              onClick={handleRegenerateQuiz}
              disabled={regenerateQuizMutation.isPending}
              data-testid="button-regenerate-quiz"
            >
              {regenerateQuizMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t("quiz.regenerate")}
            </Button>
            <Button variant="outline" onClick={handleBackToSetup} data-testid="button-back-setup">
              {t("common.back")}
            </Button>
          </div>

          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setShowExplanations(!showExplanations)}
            data-testid="button-toggle-explanations"
          >
            <Lightbulb className="mr-2 h-4 w-4" />
            {showExplanations ? t("quiz.results.hideDetails") : t("quiz.results.viewDetails")}
          </Button>

          <AnimatePresence>
            {showExplanations && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4"
              >
                {results.results.map((result, idx) => (
                  <div
                    key={result.questionId}
                    className={`p-4 rounded-lg border ${
                      result.isCorrect ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"
                    }`}
                    data-testid={`quiz-result-${idx + 1}`}
                  >
                    <div className="flex items-start gap-2 mb-3">
                      {result.isCorrect ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                      )}
                      <p className="font-medium text-sm">{result.questionText}</p>
                    </div>

                    <div className="space-y-2 ml-7 text-sm">
                      {!result.isCorrect && (
                        <div className="flex items-center gap-2 text-red-600">
                          <span className="font-medium">{t("quiz.explanation.yourAnswer")}:</span>
                          {result.options.find((o) => o.id === result.selectedOptionId)?.text}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-green-600">
                        <span className="font-medium">{t("quiz.explanation.correctAnswer")}:</span>
                        {result.options.find((o) => o.id === result.correctOptionId)?.text}
                      </div>
                      <div className="mt-2 p-3 rounded bg-muted/50 text-muted-foreground">
                        <span className="font-medium text-foreground">{t("quiz.explanation.title")}:</span>{" "}
                        {result.explanation}
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    );
  }

  return null;
}
