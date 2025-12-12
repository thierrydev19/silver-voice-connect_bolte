import { addDays, setHours, setMinutes, startOfDay } from 'date-fns';

interface ParsedReminder {
  text: string;
  dueAt: Date;
}

export const parseFrenchDate = (input: string): ParsedReminder => {
  const now = new Date();
  let dueAt = new Date();
  let text = input;

  // Normalize input
  const normalized = input.toLowerCase().trim();

  // Extract time patterns
  const timePatterns = [
    /(?:à\s*)?(\d{1,2})\s*[h:]\s*(\d{2})?/i,  // "10h30", "à 10h", "10:30"
    /(?:à\s*)?(\d{1,2})\s*heures?\s*(\d{2})?/i,  // "10 heures", "10 heures 30"
  ];

  let hours = 9; // Default to 9 AM
  let minutes = 0;

  for (const pattern of timePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      hours = parseInt(match[1], 10);
      minutes = match[2] ? parseInt(match[2], 10) : 0;
      text = input.replace(pattern, '').trim();
      break;
    }
  }

  // Extract date patterns
  const datePatterns: { pattern: RegExp; getDays: () => number }[] = [
    { pattern: /demain/i, getDays: () => 1 },
    { pattern: /après[- ]?demain/i, getDays: () => 2 },
    { pattern: /dans\s*(\d+)\s*jours?/i, getDays: () => {
      const match = normalized.match(/dans\s*(\d+)\s*jours?/i);
      return match ? parseInt(match[1], 10) : 0;
    }},
    { pattern: /lundi/i, getDays: () => getNextDayOfWeek(1) },
    { pattern: /mardi/i, getDays: () => getNextDayOfWeek(2) },
    { pattern: /mercredi/i, getDays: () => getNextDayOfWeek(3) },
    { pattern: /jeudi/i, getDays: () => getNextDayOfWeek(4) },
    { pattern: /vendredi/i, getDays: () => getNextDayOfWeek(5) },
    { pattern: /samedi/i, getDays: () => getNextDayOfWeek(6) },
    { pattern: /dimanche/i, getDays: () => getNextDayOfWeek(0) },
  ];

  let daysToAdd = 0;
  let foundDate = false;

  for (const { pattern, getDays } of datePatterns) {
    if (pattern.test(normalized)) {
      daysToAdd = getDays();
      text = text.replace(pattern, '').trim();
      foundDate = true;
      break;
    }
  }

  // If no date found and time is in the past today, assume tomorrow
  if (!foundDate) {
    const todayWithTime = setMinutes(setHours(now, hours), minutes);
    if (todayWithTime <= now) {
      daysToAdd = 1;
    }
  }

  // Build the final date
  dueAt = startOfDay(addDays(now, daysToAdd));
  dueAt = setHours(dueAt, hours);
  dueAt = setMinutes(dueAt, minutes);

  // Clean up the text
  text = text
    .replace(/rappelle[- ]?moi/gi, '')
    .replace(/rappeler/gi, '')
    .replace(/de\s+/gi, '')
    .replace(/le\s+/gi, '')
    .replace(/la\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalize first letter
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return { text, dueAt };
};

// Helper function to get days until next occurrence of a day of week
function getNextDayOfWeek(targetDay: number): number {
  const today = new Date().getDay();
  let daysUntil = targetDay - today;
  if (daysUntil <= 0) {
    daysUntil += 7;
  }
  return daysUntil;
}

export const formatTimeForSpeech = (date: Date): string => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  
  if (minutes === 0) {
    return `${hours} heures`;
  }
  return `${hours} heures ${minutes}`;
};

export const formatDateForSpeech = (date: Date): string => {
  const now = new Date();
  const today = startOfDay(now);
  const targetDay = startOfDay(date);
  const diffDays = Math.round((targetDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "aujourd'hui";
  } else if (diffDays === 1) {
    return "demain";
  } else if (diffDays === 2) {
    return "après-demain";
  } else {
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    return days[date.getDay()];
  }
};
