import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format, isAfter, isBefore, isToday, differenceInDays, startOfDay } from "date-fns";
import { Calendar as CalendarIcon, Plus, Trash2, Edit, Check, X, CalendarDays, ListTodo, BookOpen } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CalendarEvent } from "@shared/schema";

type ViewMode = "month" | "list";
type FilterType = "all" | "exam" | "assignment" | "upcoming" | "past" | "completed";

export default function CalendarPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [filterType, setFilterType] = useState<FilterType>("upcoming");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const { data: eventsData, isLoading } = useQuery<{ success: boolean; events: CalendarEvent[] }>({
    queryKey: ["/api/calendar/events"],
  });

  const { data: subjectsData } = useQuery({
    queryKey: ["/api/subjects"],
  });

  const createEvent = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/calendar/events", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({
        title: t("calendar.createSuccess"),
        description: t("calendar.createSuccessMessage"),
      });
      setCreateDialogOpen(false);
    },
    onError: (error: any) => {
      const errorCode = error?.errorCode;
      if (errorCode === "PREMIUM_REQUIRED") {
        toast({
          variant: "destructive",
          title: t("calendar.premiumRequired"),
          description: t("calendar.premiumRequiredMessage"),
        });
      } else {
        toast({
          variant: "destructive",
          title: t("calendar.createError"),
          description: error?.message || t("calendar.createError"),
        });
      }
    },
  });

  const updateEvent = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/calendar/events/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({
        title: t("calendar.updateSuccess"),
        description: t("calendar.updateSuccessMessage"),
      });
      setEditingEvent(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: t("calendar.updateError"),
      });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/calendar/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({
        title: t("calendar.deleteSuccess"),
        description: t("calendar.deleteSuccessMessage"),
      });
      setDeletingEventId(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: t("calendar.deleteError"),
      });
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/calendar/events/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
    },
  });

  const events = eventsData?.events || [];
  const subjects = (subjectsData as any)?.subjects || [];

  const getFilteredEvents = () => {
    const now = startOfDay(new Date());
    return events.filter((event) => {
      const eventDate = startOfDay(new Date(event.eventDate));

      if (filterType === "exam" && event.eventType !== "exam") return false;
      if (filterType === "assignment" && event.eventType !== "assignment") return false;
      if (filterType === "upcoming" && !isAfter(eventDate, now) && !isToday(eventDate)) return false;
      if (filterType === "past" && isAfter(eventDate, now)) return false;
      if (filterType === "completed" && !event.completed) return false;

      return true;
    });
  };

  const filteredEvents = getFilteredEvents();

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventDate = startOfDay(new Date(event.eventDate));
      const checkDate = startOfDay(date);
      return eventDate.getTime() === checkDate.getTime();
    });
  };

  const getDaysUntil = (eventDate: Date) => {
    const days = differenceInDays(startOfDay(new Date(eventDate)), startOfDay(new Date()));
    if (days < 0) return t("calendar.overdue");
    if (days === 0) return t("calendar.today");
    if (days === 1) return `1 ${t("calendar.dayUntil")}`;
    return `${days} ${t("calendar.daysUntil")}`;
  };

  const getEventTypeColor = (type: string) => {
    return type === "exam" ? "bg-red-500/10 text-red-700 dark:text-red-400" : "bg-blue-500/10 text-blue-700 dark:text-blue-400";
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground animate-pulse" />
          <p className="mt-4 text-muted-foreground">{t("calendar.events")}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="title-calendar">{t("calendar.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {filteredEvents.length} {t("calendar.events").toLowerCase()}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterType} onValueChange={(value) => setFilterType(value as FilterType)}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("calendar.allEvents")}</SelectItem>
                <SelectItem value="upcoming">{t("calendar.upcomingEvents")}</SelectItem>
                <SelectItem value="past">{t("calendar.pastEvents")}</SelectItem>
                <SelectItem value="exam">{t("calendar.exams")}</SelectItem>
                <SelectItem value="assignment">{t("calendar.assignments")}</SelectItem>
                <SelectItem value="completed">{t("calendar.completed")}</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 border rounded-md">
              <Button
                variant={viewMode === "month" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("month")}
                data-testid="button-view-month"
              >
                <CalendarIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                data-testid="button-view-list"
              >
                <ListTodo className="h-4 w-4" />
              </Button>
            </div>

            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-event">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("calendar.createEvent")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <EventForm
                  subjects={subjects}
                  onSubmit={(data) => createEvent.mutate(data)}
                  isPending={createEvent.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {viewMode === "month" ? (
          <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
            <Card className="w-fit">
              <CardContent className="p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md"
                  modifiers={{
                    hasEvent: events.map((e) => new Date(e.eventDate)),
                  }}
                  modifiersClassNames={{
                    hasEvent: "font-bold underline decoration-primary decoration-2",
                  }}
                />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    {selectedDate ? format(selectedDate, "MMMM d, yyyy") : t("calendar.selectDate")}
                  </CardTitle>
                  <CardDescription>
                    {selectedDate && getEventsForDate(selectedDate).length > 0
                      ? `${getEventsForDate(selectedDate).length} ${t("calendar.events").toLowerCase()}`
                      : t("calendar.noEvents")}
                  </CardDescription>
                </CardHeader>
                {selectedDate && getEventsForDate(selectedDate).length > 0 && (
                  <CardContent className="space-y-2">
                    {getEventsForDate(selectedDate).map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        subjects={subjects}
                        onEdit={() => setEditingEvent(event)}
                        onDelete={() => setDeletingEventId(event.id)}
                        onToggleComplete={() => toggleComplete.mutate(event.id)}
                      />
                    ))}
                  </CardContent>
                )}
              </Card>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvents.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{t("calendar.noEvents")}</h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    {t("calendar.noEventsDescription")}
                  </p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t("calendar.createEvent")}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredEvents
                .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
                .map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    subjects={subjects}
                    onEdit={() => setEditingEvent(event)}
                    onDelete={() => setDeletingEventId(event.id)}
                    onToggleComplete={() => toggleComplete.mutate(event.id)}
                    showDate
                  />
                ))
            )}
          </div>
        )}
      </div>

      <Dialog open={!!editingEvent} onOpenChange={() => setEditingEvent(null)}>
        <DialogContent>
          {editingEvent && (
            <EventForm
              event={editingEvent}
              subjects={subjects}
              onSubmit={(data) => updateEvent.mutate({ id: editingEvent.id, data })}
              isPending={updateEvent.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingEventId} onOpenChange={() => setDeletingEventId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("calendar.deleteDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("calendar.deleteDialogDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">{t("calendar.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingEventId && deleteEvent.mutate(deletingEventId)}
              data-testid="button-confirm-delete"
            >
              {t("calendar.deleteEvent")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EventCard({
  event,
  subjects,
  onEdit,
  onDelete,
  onToggleComplete,
  showDate = false,
}: {
  event: CalendarEvent;
  subjects: any[];
  onEdit: () => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  showDate?: boolean;
}) {
  const { t } = useTranslation();
  const subject = subjects.find((s) => s.id === event.subjectId);
  const isPast = isBefore(startOfDay(new Date(event.eventDate)), startOfDay(new Date()));
  const isOverdue = isPast && !event.completed;

  return (
    <Card className={event.completed ? "opacity-60" : ""} data-testid={`card-event-${event.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`${event.eventType === "exam" ? "bg-red-500/10 text-red-700 dark:text-red-400" : "bg-blue-500/10 text-blue-700 dark:text-blue-400"}`}>
                {event.eventType === "exam" ? t("calendar.exam") : t("calendar.assignment")}
              </Badge>
              {showDate && (
                <span className="text-sm text-muted-foreground">
                  {format(new Date(event.eventDate), "MMM d, yyyy")}
                </span>
              )}
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">
                  {t("calendar.overdue")}
                </Badge>
              )}
              {event.completed && (
                <Badge variant="secondary" className="text-xs">
                  <Check className="mr-1 h-3 w-3" />
                  {t("calendar.completed")}
                </Badge>
              )}
            </div>

            <div>
              <h4 className={`font-semibold ${event.completed ? "line-through" : ""}`} data-testid={`text-event-title-${event.id}`}>
                {event.title}
              </h4>
              {event.description && (
                <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
              )}
            </div>

            {subject && (
              <div className="flex items-center gap-2 text-sm">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{subject.name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleComplete}
              data-testid={`button-toggle-complete-${event.id}`}
            >
              {event.completed ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onEdit} data-testid={`button-edit-${event.id}`}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} data-testid={`button-delete-${event.id}`}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EventForm({
  event,
  subjects,
  onSubmit,
  isPending,
}: {
  event?: CalendarEvent;
  subjects: any[];
  onSubmit: (data: any) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [eventType, setEventType] = useState<"exam" | "assignment">(event?.eventType as any || "exam");
  const [eventDate, setEventDate] = useState<Date | undefined>(event ? new Date(event.eventDate) : new Date());
  const [subjectId, setSubjectId] = useState<string | undefined>(event?.subjectId || undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !eventDate || !subjectId) return;

    onSubmit({
      title,
      description: description || null,
      eventType,
      eventDate: eventDate.toISOString(),
      subjectId,
      topicId: null,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{event ? t("calendar.editEvent") : t("calendar.createEvent")}</DialogTitle>
        <DialogDescription>
          {event ? t("calendar.editEvent") : t("calendar.createEvent")}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="title">{t("calendar.eventTitle")}</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("calendar.eventTitlePlaceholder")}
            required
            data-testid="input-event-title"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t("calendar.eventDescription")}</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("calendar.eventDescriptionPlaceholder")}
            rows={3}
            data-testid="input-event-description"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="eventType">{t("calendar.eventType")}</Label>
          <Select value={eventType} onValueChange={(value: any) => setEventType(value)}>
            <SelectTrigger id="eventType" data-testid="select-event-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exam">{t("calendar.exam")}</SelectItem>
              <SelectItem value="assignment">{t("calendar.assignment")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("calendar.eventDate")}</Label>
          <div className="overflow-x-auto">
            <Calendar
              mode="single"
              selected={eventDate}
              onSelect={setEventDate}
              className="rounded-md border"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">{t("calendar.subject")}</Label>
          <Select value={subjectId} onValueChange={setSubjectId} required>
            <SelectTrigger id="subject" data-testid="select-subject">
              <SelectValue placeholder={t("calendar.selectSubject")} />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isPending || !title || !eventDate || !subjectId} data-testid="button-submit-event">
          {isPending ? t("calendar.creating") : event ? t("calendar.save") : t("calendar.createEvent")}
        </Button>
      </DialogFooter>
    </form>
  );
}
