"use client";

import { useMemo, useState } from "react";
import styles from "./date-time-picker.module.css";

type Props = {
  name: string;
  initialValue?: string;
  disabled?: boolean;
};

const dayLabel = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  weekday: "short",
  day: "2-digit",
  month: "short",
});

function dayValue(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function buildDays(initialDate?: string) {
  const now = new Date();
  const dates = Array.from({ length: 120 }, (_, index) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + index);
    return date;
  });
  const values = dates.map((date, index) => ({
    value: dayValue(date),
    label: index === 0 ? `Hoy · ${dayLabel.format(date)}` : index === 1 ? `Mañana · ${dayLabel.format(date)}` : dayLabel.format(date),
  }));
  if (initialDate && !values.some((item) => item.value === initialDate)) {
    const parsed = new Date(`${initialDate}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) values.unshift({ value: initialDate, label: dayLabel.format(parsed) });
  }
  return values;
}

function buildTimes(initialTime?: string) {
  const values = Array.from({ length: 29 }, (_, index) => {
    const total = 7 * 60 + index * 30;
    const hour = String(Math.floor(total / 60)).padStart(2, "0");
    const minute = String(total % 60).padStart(2, "0");
    const value = `${hour}:${minute}`;
    return { value, label: value };
  });
  if (initialTime && !values.some((item) => item.value === initialTime)) values.push({ value: initialTime, label: initialTime });
  return values.sort((a, b) => a.value.localeCompare(b.value));
}

export function DateTimePicker({ name, initialValue = "", disabled = false }: Props) {
  const [initialDate = "", initialTime = ""] = initialValue.split("T");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const days = useMemo(() => buildDays(initialDate), [initialDate]);
  const times = useMemo(() => buildTimes(initialTime), [initialTime]);
  const value = date && time ? `${date}T${time}` : "";

  return (
    <div className={styles.field}>
      <input type="hidden" name={name} value={value} />
      <select className={styles.select} value={date} onChange={(event) => setDate(event.target.value)} disabled={disabled} aria-label="Día de siguiente acción">
        <option value="">Sin fecha</option>
        {days.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <select className={styles.select} value={time} onChange={(event) => setTime(event.target.value)} disabled={disabled || !date} aria-label="Hora de siguiente acción">
        <option value="">Hora</option>
        {times.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </div>
  );
}
