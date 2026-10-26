// Kind words: one a day, as a small surprise in the afternoon.

export const KIND_WORDS = [
  "You're doing so much better than you think.",
  "Small steps still move you forward. Every one counts.",
  "You are allowed to rest. Rest is part of the plan.",
  "Your brain works differently, and that is not a flaw.",
  "You've handled every hard day so far. That's a 100% record.",
  "Done is better than perfect. And you get things done.",
  "You deserve the same kindness you give everyone else.",
  "Look how far you've come since last year.",
  "You make the people around you feel cared for.",
  "It's okay to start again, as many times as you need.",
  "Your home doesn't have to be perfect to be lovely.",
  "You are more than your to-do list.",
  "Five minutes of something is a win. Celebrate it.",
  "Pari is lucky to have you. So is everyone else.",
  "You have a gift for making things beautiful.",
  "Being gentle with yourself is a skill. You're getting good at it.",
  "Today you only have to do the next small thing.",
  "You are capable, clever and worth celebrating.",
  "Whatever you got done today is enough.",
  "Your future self is already thanking you.",
  "You bring warmth wherever you go.",
  "Progress, not perfection. You're making progress.",
  "You are allowed to take up space.",
  "Your ideas matter. Your voice matters. You matter.",
  "It's brave to keep trying. You keep trying.",
  "You've got this, and if not today, then tomorrow.",
  "Take a deep breath. You're exactly where you need to be.",
  "Good things are on their way to you.",
  "You attract calm, abundance and good people.",
  "Money flows to you easily and you use it wisely.",
  "Every day you're building the life you want.",
  "You are becoming the person you dreamed of being.",
  "Your kindness is your superpower.",
  "You are loved more than you know.",
  "You can do hard things. You've done them before.",
  "A messy day doesn't undo your progress.",
  "You are worthy of good things, exactly as you are.",
  "Drink some water and give yourself some credit.",
  "You are strong, soft and brilliant all at once.",
  "Your effort is beautiful, even when no one sees it.",
  "Today is a good day to be proud of yourself.",
  "You're allowed to do things your own way.",
  "Your glow is coming from the inside out.",
  "You are safe, you are calm, you are enough.",
  "The life you're creating is full of meaning.",
  "You inspire people just by being you.",
  "Every small habit is a gift to future you.",
  "You are open to joy and joy finds you.",
  "You have everything you need to handle today.",
  "Remember: you're the main character.",
];

/** Same word and time for a given day, so planning the week again doesn't change them.
 *  `own`: your own kind words (Settings), mixed in with these. */
export function kindWordFor(dayKey: string, own: string[] = []) {
  const words = [...KIND_WORDS, ...own.filter((w) => w.trim())];
  let h = 7;
  for (const c of dayKey) h = Math.imul(h ^ c.charCodeAt(0), 0x5bd1e995);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = (h ^ (h >>> 13)) >>> 0;
  // Between 13:00 and 17:00, on a quarter hour.
  const minutes = 13 * 60 + (h % 17) * 15;
  return { text: words[h % words.length], hour: Math.floor(minutes / 60), minute: minutes % 60 };
}
