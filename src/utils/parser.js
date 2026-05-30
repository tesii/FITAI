export function normalizeLevel(text) {
  text = text.toLowerCase();

  if (text.includes("begin")) return "beginner";
  if (text.includes("inter")) return "intermediate";
  if (text.includes("expert") || text.includes("advanced")) return "expert";

  return "beginner";
}

export function normalizeMuscle(text) {
  text = text.toLowerCase();

  if (text.includes("glute")) return "glute";
  if (text.includes("leg")) return "leg";
  if (text.includes("chest")) return "chest";

  return "glute";
}

export function extractExclusions(text) {
  const exclusions = [];
  const match = text.match(/(no|avoid|skip|without)\s([a-z\s]+)/);

  if (match) exclusions.push(match[2].trim());

  return exclusions;
}