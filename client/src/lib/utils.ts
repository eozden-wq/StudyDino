// Utility helpers shared across UI components
import { Filter } from 'bad-words';

export function cn(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(" ");
}

export function getMaxDateForEvent(): string {
  const maxDate = new Date(2030, 11, 31, 23, 59); // December 31, 2030, 23:59
  // Format to YYYY-MM-DDTHH:mm for datetime-local input
  const year = maxDate.getFullYear();
  const month = (maxDate.getMonth() + 1).toString().padStart(2, '0');
  const day = maxDate.getDate().toString().padStart(2, '0');
  const hours = maxDate.getHours().toString().padStart(2, '0');
  const minutes = maxDate.getMinutes().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const filter = new Filter();

export function containsProfanity(text: string): boolean {
  return filter.isProfane(text);
}


