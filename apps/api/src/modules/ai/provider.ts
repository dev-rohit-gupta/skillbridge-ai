export type ExtractedRequirement = {
  skillId: string;
  originalText: string;
  importance: "CORE" | "IMPORTANT" | "OPTIONAL";
  weight: number;
  confidenceBp: number;
};

export type JobExtractionInput = {
  title: string;
  description: string;
  skills: Array<{ id: string; name: string; slug: string; aliases: string[] }>;
};

export interface AiProvider {
  readonly name: string;
  extractJobRequirements(
    input: JobExtractionInput,
  ): Promise<ExtractedRequirement[]>;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim();
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function requirementContext(text: string, index: number) {
  const previousBoundaries = [
    text.lastIndexOf(".", index - 1),
    text.lastIndexOf("\n", index - 1),
    text.lastIndexOf(";", index - 1),
  ];
  const start = Math.max(0, Math.max(...previousBoundaries) + 1);
  const nextBoundaries = [
    text.indexOf(".", index),
    text.indexOf("\n", index),
    text.indexOf(";", index),
  ].filter((value) => value >= 0);
  const end = nextBoundaries.length
    ? Math.min(...nextBoundaries) + 1
    : Math.min(text.length, index + 260);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function classifyImportance(context: string) {
  const value = context.toLowerCase();
  if (
    /preferred|nice to have|good to have|bonus|familiarity with|optional/.test(
      value,
    )
  ) {
    return { importance: "OPTIONAL" as const, weight: 1 };
  }
  if (
    /must have|required|mandatory|strong knowledge|proficien|hands-on|minimum .*experience/.test(
      value,
    )
  ) {
    return { importance: "CORE" as const, weight: 3 };
  }
  return { importance: "IMPORTANT" as const, weight: 2 };
}

/**
 * Offline, deterministic provider used by default. A watsonx/OpenAI adapter can
 * implement the same interface later without changing the domain services.
 */
export class DeterministicAiProvider implements AiProvider {
  readonly name = "deterministic-taxonomy-v1";

  async extractJobRequirements(
    input: JobExtractionInput,
  ): Promise<ExtractedRequirement[]> {
    const normalizedDescription = normalize(input.description);
    const found = new Map<string, ExtractedRequirement>();

    const terms = input.skills
      .flatMap((skill) =>
        [skill.name, skill.slug, ...skill.aliases]
          .filter(Boolean)
          .map((term) => ({ skill, term, normalizedTerm: normalize(term) })),
      )
      .filter((entry) => entry.normalizedTerm.length > 1)
      .sort((a, b) => b.normalizedTerm.length - a.normalizedTerm.length);

    for (const entry of terms) {
      if (found.has(entry.skill.id)) continue;
      const pattern = new RegExp(
        `(^|[^a-z0-9+#])${escapeRegex(entry.normalizedTerm).replace(/\\ /g, "\\s+")}([^a-z0-9+#]|$)`,
        "i",
      );
      const match = pattern.exec(normalizedDescription);
      if (!match) continue;
      const rawIndex = input.description
        .toLowerCase()
        .indexOf(entry.term.toLowerCase());
      const index = rawIndex >= 0 ? rawIndex : match.index;
      const originalText = requirementContext(input.description, index);
      const classification = classifyImportance(originalText);
      found.set(entry.skill.id, {
        skillId: entry.skill.id,
        originalText,
        ...classification,
        confidenceBp: entry.term === entry.skill.name ? 9500 : 9000,
      });
    }

    return [...found.values()];
  }
}
