import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Clock, CheckCircle2 } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Reminder {
  id: string;
  text: string;
  due_at: string;
  status: string;
}

interface DayReminders {
  date: Date;
  dayName: string;
  dayNumber: number;
  reminders: Reminder[];
}

export const WeeklyCalendar = ({ circleId }: { circleId?: string | null }) => {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [remindersByDay, setRemindersByDay] = useState<DayReminders[]>([]);
  const [loading, setLoading] = useState(true);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      date,
      dayName: format(date, 'EEEE', { locale: fr }).charAt(0).toUpperCase() +
               format(date, 'EEEE', { locale: fr }).slice(1),
      dayNumber: date.getDate(),
    };
  });

  useEffect(() => {
    const fetchWeekReminders = async () => {
      if (!circleId || !user) return;

      setLoading(true);

      const weekEnd = addDays(weekStart, 7);

      const { data: reminders, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('circle_id', circleId)
        .gte('due_at', weekStart.toISOString())
        .lt('due_at', weekEnd.toISOString())
        .order('due_at', { ascending: true });

      if (!error && reminders) {
        const grouped = weekDays.map(day => ({
          ...day,
          reminders: reminders.filter(r =>
            isSameDay(parseISO(r.due_at), day.date)
          )
        }));
        setRemindersByDay(grouped);
      }

      setLoading(false);
    };

    fetchWeekReminders();

    if (circleId) {
      const channel = supabase
        .channel('weekly-calendar')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'reminders',
          filter: `circle_id=eq.${circleId}`
        }, () => fetchWeekReminders())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [circleId, weekStart, user, weekDays]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-blue-100 text-blue-800';
      case 'snoozed':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'done':
        return 'Fait';
      case 'pending':
        return 'En attente';
      case 'snoozed':
        return 'Reporté';
      case 'cancelled':
        return 'Annulé';
      default:
        return status;
    }
  };

  const totalReminders = remindersByDay.reduce((sum, day) => sum + day.reminders.length, 0);

  return (
    <div className="w-full space-y-4 pb-20">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-2xl font-bold">Semaine</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Semaine précédente"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="text-sm font-medium px-3 py-2 hover:bg-muted rounded-lg transition-colors"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Semaine suivante"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="px-4">
        <p className="text-sm text-muted-foreground">
          {format(weekStart, 'd MMMM', { locale: fr })} - {format(addDays(weekStart, 6), 'd MMMM yyyy', { locale: fr })}
        </p>
      </div>

      {loading ? (
        <div className="px-4">
          <p className="text-center text-muted-foreground">Chargement...</p>
        </div>
      ) : (
        <div className="space-y-2 px-4">
          {/* Summary card */}
          <Card className="p-4 bg-primary/5 border-primary/20">
            <p className="text-sm font-semibold text-primary">
              {totalReminders} rappel{totalReminders !== 1 ? 's' : ''} cette semaine
            </p>
          </Card>

          {/* Daily cards */}
          <div className="grid grid-cols-7 gap-2">
            {remindersByDay.map((day) => (
              <Card
                key={day.date.toISOString()}
                className={cn(
                  'p-3 cursor-pointer transition-all hover:shadow-md',
                  isSameDay(day.date, new Date())
                    ? 'ring-2 ring-primary border-primary'
                    : ''
                )}
              >
                <div className="text-center space-y-2">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase">
                      {day.dayName}
                    </p>
                    <p className="text-lg font-bold">{day.dayNumber}</p>
                  </div>

                  {day.reminders.length > 0 ? (
                    <Badge variant="secondary" className="w-full justify-center">
                      {day.reminders.length}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="w-full justify-center opacity-50">
                      0
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Detailed list */}
          <div className="space-y-3 mt-6">
            {remindersByDay.map((day) => (
              day.reminders.length > 0 && (
                <div key={day.date.toISOString()}>
                  <h3 className="font-semibold text-sm mb-2">
                    {format(day.date, 'EEEE d MMMM', { locale: fr })}
                  </h3>
                  <div className="space-y-2">
                    {day.reminders.map((reminder) => (
                      <Card key={reminder.id} className="p-3 border-l-4 border-l-primary">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium line-clamp-2">
                              {reminder.text}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <p className="text-xs text-muted-foreground">
                                {format(parseISO(reminder.due_at), 'HH:mm')}
                              </p>
                              <Badge
                                variant="outline"
                                className={cn('text-xs ml-auto', getStatusColor(reminder.status))}
                              >
                                {getStatusLabel(reminder.status)}
                              </Badge>
                            </div>
                          </div>
                          {reminder.status === 'done' && (
                            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>

          {totalReminders === 0 && (
            <Card className="p-6 text-center border-dashed">
              <p className="text-muted-foreground">Aucun rappel cette semaine</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
