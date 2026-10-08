import { format, startOfDay, startOfYear, subDays, subMonths, differenceInCalendarDays } from "date-fns";

export const PERIODS = [
  { value: "today", label: "Aujourd’hui" }, { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" }, { value: "3m", label: "3 derniers mois" },
  { value: "year", label: "Année en cours" },
] as const;
export type PilotagePeriod = typeof PERIODS[number]["value"];
export function periodBounds(period: PilotagePeriod, now = new Date()) {
  const end = startOfDay(now);
  const start = period === "today" ? end : period === "7d" ? subDays(end, 6) : period === "30d" ? subDays(end, 29) : period === "3m" ? subMonths(end, 3) : startOfYear(end);
  const days = differenceInCalendarDays(end, start) + 1;
  return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd"), previousStart: format(subDays(start, days), "yyyy-MM-dd"), previousEnd: format(subDays(start, 1), "yyyy-MM-dd"), year: now.getFullYear() };
}
export function presenceRate(rows: Array<{ statut: string }>) {
  const present = rows.filter(p => p.statut === "present").length;
  const absent = rows.filter(p => p.statut === "absent").length;
  return { present, absent, rate: present + absent ? Math.round(present * 100 / (present + absent)) : null };
}