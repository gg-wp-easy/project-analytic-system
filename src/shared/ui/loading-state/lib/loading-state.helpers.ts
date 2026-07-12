export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function getLoadingBarClassName(accentClassName: string): string {
  return accentClassName.replace("text-", "bg-");
}
