'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/src/lib/utils';
import { Calendar, Clock, Rocket, ChevronLeft, ChevronRight } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import {
  format,
  addDays,
  startOfDay,
  isSameDay,
  isToday,
  isBefore,
  setHours,
  setMinutes,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Mirror backend DISPATCH_WINDOWS (packages/shared)
const DISPATCH_WINDOWS = [
  { start: 9, end: 12 },
  { start: 14, end: 18 },
] as const;

const SLOT_MINUTES = 30;
const DAYS_VISIBLE = 7;
const BRT_OFFSET = -3;

type SlotStatus = 'available' | 'outside' | 'past';

interface TimeSlot {
  hour: number;
  minute: number;
  status: SlotStatus;
  date: Date;
}

interface DispatchSchedulerProps {
  value: string | null; // ISO string or null (= send now)
  onChange: (scheduledAt: string | null) => void;
}

function getBrtNow(): Date {
  return new Date();
}

function isInWindow(hour: number): boolean {
  return DISPATCH_WINDOWS.some((w) => hour >= w.start && hour < w.end);
}

function generateSlots(day: Date): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const now = getBrtNow();

  // Generate all half-hour slots from 0-23
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      const slotDate = setMinutes(setHours(startOfDay(day), h), m);

      let status: SlotStatus = 'outside';
      if (isInWindow(h)) {
        status = isBefore(slotDate, now) && isSameDay(slotDate, now) ? 'past' : 'available';
      }

      slots.push({ hour: h, minute: m, status, date: slotDate });
    }
  }

  return slots;
}

function getWindowSlots(day: Date): TimeSlot[] {
  const allSlots = generateSlots(day);
  // Only show slots inside dispatch windows
  return allSlots.filter((s) => s.status !== 'outside');
}

export function DispatchScheduler({ value, onChange }: DispatchSchedulerProps) {
  const [isScheduled, setIsScheduled] = useState(value !== null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<Date>(startOfDay(new Date()));

  const days = useMemo(() => {
    const base = addDays(startOfDay(new Date()), weekOffset * DAYS_VISIBLE);
    return Array.from({ length: DAYS_VISIBLE }, (_, i) => addDays(base, i));
  }, [weekOffset]);

  const slots = useMemo(() => getWindowSlots(selectedDay), [selectedDay]);

  const selectedSlotTime = value ? new Date(value) : null;

  const handleToggle = (checked: boolean) => {
    setIsScheduled(checked);
    if (!checked) {
      onChange(null);
    }
  };

  const handleSlotClick = (slot: TimeSlot) => {
    if (slot.status !== 'available') return;
    onChange(slot.date.toISOString());
  };

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
        <div className="flex items-center gap-2">
          {isScheduled ? (
            <Calendar className="h-4 w-4 text-primary" />
          ) : (
            <Rocket className="h-4 w-4 text-primary" />
          )}
          <Label htmlFor="schedule-toggle" className="cursor-pointer text-sm">
            {isScheduled ? 'Agendar para' : 'Disparar agora'}
          </Label>
        </div>
        <Switch
          id="schedule-toggle"
          checked={isScheduled}
          onCheckedChange={handleToggle}
        />
      </div>

      {isScheduled && (
        <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
          {/* Day selector */}
          <div className="flex items-center border-b border-border/50 px-2 py-2">
            <button
              onClick={() => setWeekOffset((w) => Math.max(w - 1, 0))}
              disabled={weekOffset === 0}
              className="rounded p-1 hover:bg-secondary/50 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex flex-1 gap-1 overflow-x-auto px-1">
              {days.map((day) => {
                const isPast = isBefore(day, startOfDay(new Date())) && !isToday(day);
                const isSelected = isSameDay(day, selectedDay);

                return (
                  <button
                    key={day.toISOString()}
                    disabled={isPast}
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      'flex min-w-[48px] flex-col items-center rounded-lg px-2 py-1.5 text-xs transition-colors',
                      isPast && 'opacity-30',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-secondary/50',
                      isToday(day) && !isSelected && 'ring-1 ring-primary/50'
                    )}
                  >
                    <span className="text-[10px] uppercase">
                      {format(day, 'EEE', { locale: ptBR })}
                    </span>
                    <span className="font-semibold">{format(day, 'dd')}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(day, 'MMM', { locale: ptBR })}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="rounded p-1 hover:bg-secondary/50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Time windows label */}
          <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Janelas: 09h–12h e 14h–18h (BRT)
            </span>
          </div>

          {/* Slot grid */}
          <div className="p-3">
            {DISPATCH_WINDOWS.map((window, wi) => (
              <div key={wi} className="mb-3 last:mb-0">
                <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {window.start < 13 ? 'Manhã' : 'Tarde'} · {window.start}h–{window.end}h
                </span>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6">
                  {slots
                    .filter(
                      (s) => s.hour >= window.start && s.hour < window.end
                    )
                    .map((slot) => {
                      const isSelected =
                        selectedSlotTime &&
                        isSameDay(slot.date, selectedSlotTime) &&
                        slot.hour === selectedSlotTime.getHours() &&
                        slot.minute === selectedSlotTime.getMinutes();

                      return (
                        <button
                          key={`${slot.hour}:${slot.minute}`}
                          disabled={slot.status === 'past'}
                          onClick={() => handleSlotClick(slot)}
                          className={cn(
                            'rounded-md px-2 py-2 text-xs font-medium transition-all',
                            slot.status === 'past' &&
                              'cursor-not-allowed bg-secondary/20 text-muted-foreground/40 line-through',
                            slot.status === 'available' &&
                              !isSelected &&
                              'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 hover:ring-1 hover:ring-emerald-500/30',
                            isSelected &&
                              'bg-primary text-primary-foreground ring-2 ring-primary/50'
                          )}
                        >
                          {String(slot.hour).padStart(2, '0')}:
                          {String(slot.minute).padStart(2, '0')}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}

            {slots.filter((s) => s.status === 'available').length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Sem horários disponíveis neste dia. Selecione outro dia.
              </p>
            )}
          </div>

          {/* Selected summary */}
          {value && (
            <div className="border-t border-border/50 bg-primary/5 px-3 py-2">
              <p className="text-xs text-primary">
                <Calendar className="mr-1 inline h-3 w-3" />
                Agendado para{' '}
                <span className="font-semibold">
                  {format(new Date(value), "EEEE, dd 'de' MMMM 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </span>{' '}
                (BRT)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
