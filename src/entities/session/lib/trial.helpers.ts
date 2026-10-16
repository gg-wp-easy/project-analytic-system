import type { SessionUser } from "../model/session.types";

/** Срок действующего пробного «Про» или null, если пробного периода сейчас нет. */
export function activeTrialEnd(user: SessionUser | null): Date | null {
  if (!user?.trial_ends_at) {
    return null;
  }
  const end = new Date(user.trial_ends_at);
  return end.getTime() > Date.now() ? end : null;
}

/** Дата для подписи «пробный период до …» на языке интерфейса. */
export function formatTrialDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
