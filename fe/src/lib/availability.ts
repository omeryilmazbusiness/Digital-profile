const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface OfficeHours {
  timeZone: string;
  /** 0 = Sunday. */
  days: readonly number[];
  /** "HH:MM", 24-hour. */
  opens: string;
  closes: string;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** Weekday (0 = Sunday), minutes since midnight and "HH:MM" in a time zone. */
export function zonedClock(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    formatter(timeZone)
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);
  return {
    weekday: WEEKDAYS.indexOf(parts.weekday ?? ""),
    minutes: hour * 60 + minute,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

const toMinutes = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Whether the office is open at `date`, in its own time zone. */
export function isOpen(date: Date, hours: OfficeHours): boolean {
  const { weekday, minutes } = zonedClock(date, hours.timeZone);
  return (
    hours.days.includes(weekday) &&
    minutes >= toMinutes(hours.opens) &&
    minutes < toMinutes(hours.closes)
  );
}
