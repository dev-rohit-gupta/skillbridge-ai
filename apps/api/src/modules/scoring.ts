export type ScoringRequirement = {
  id: string;
  name: string;
  importance: "CORE" | "IMPORTANT" | "OPTIONAL";
  weight: number;
  acceptedSkillIds: string[];
};
export type CandidateSkill = {
  skillId: string;
  evidenceFactorBp: number;
  evidenceSource: string;
};
export type Relation = {
  sourceSkillId: string;
  targetSkillId: string;
  matchFactorBp: number;
};
export type MatchLevel =
  | "STRONG_MATCH"
  | "GOOD_MATCH"
  | "DEVELOPING_MATCH"
  | "SIGNIFICANT_GAPS";
const BP = 10000;
const mul = (a: number, b: number) => Math.round((a * b) / BP);
const weightedAverage = (items: { scoreBp: number; weight: number }[]) => {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  return total
    ? Math.round(
        items.reduce((sum, item) => sum + item.scoreBp * item.weight, 0) /
          total,
      )
    : 0;
};
function coverage(
  requirements: ScoringRequirement[],
  candidates: CandidateSkill[],
  relations: Relation[],
) {
  return weightedAverage(
    requirements
      .filter((r) => r.importance !== "OPTIONAL")
      .map((requirement) => {
        let best = 0;
        for (const target of requirement.acceptedSkillIds)
          for (const candidate of candidates) {
            const relation = relations.find(
              (item) =>
                item.sourceSkillId === candidate.skillId &&
                item.targetSkillId === target,
            );
            const factor =
              candidate.skillId === target
                ? BP
                : (relation?.matchFactorBp ?? 0);
            best = Math.max(best, mul(factor, candidate.evidenceFactorBp));
          }
        return { scoreBp: best, weight: requirement.weight };
      }),
  );
}
export function scoreAnalysis(input: {
  requirements: ScoringRequirement[];
  candidateSkills: CandidateSkill[];
  relations: Relation[];
  experienceLevel: string;
}) {
  const results = input.requirements.map((requirement) => {
    let best = {
      effectiveBp: 0,
      matchedSkillId: null as string | null,
      matchType: "MISSING" as "EXACT" | "RELATED" | "MISSING",
      evidenceSource: null as string | null,
    };
    for (const target of requirement.acceptedSkillIds)
      for (const candidate of input.candidateSkills) {
        const relation = input.relations.find(
          (item) =>
            item.sourceSkillId === candidate.skillId &&
            item.targetSkillId === target,
        );
        const factor =
          candidate.skillId === target ? BP : (relation?.matchFactorBp ?? 0);
        const effectiveBp = mul(factor, candidate.evidenceFactorBp);
        if (effectiveBp > best.effectiveBp)
          best = {
            effectiveBp,
            matchedSkillId: candidate.skillId,
            matchType: candidate.skillId === target ? "EXACT" : "RELATED",
            evidenceSource: candidate.evidenceSource,
          };
      }
    return { ...requirement, ...best };
  });
  const core = results.filter((r) => r.importance === "CORE");
  const base = results.filter((r) => r.importance !== "OPTIONAL");
  const optional = results.filter((r) => r.importance === "OPTIONAL");
  const coreCoverageBp = weightedAverage(
    core.map((r) => ({ scoreBp: r.effectiveBp, weight: r.weight })),
  );
  const baseSkillCoverageBp = weightedAverage(
    base.map((r) => ({ scoreBp: r.effectiveBp, weight: r.weight })),
  );
  const optionalCoverageBp = weightedAverage(
    optional.map((r) => ({ scoreBp: r.effectiveBp, weight: r.weight })),
  );
  const optionalBonusBp = Math.min(500, mul(optionalCoverageBp, 500));
  const skillScoreBp = Math.min(BP, baseSkillCoverageBp + optionalBonusBp);
  const projectScoreBp = coverage(
    input.requirements,
    input.candidateSkills.filter((s) => s.evidenceSource === "PROJECT"),
    input.relations,
  );
  const experienceSkills = input.candidateSkills.filter(
    (s) => s.evidenceSource === "EXPERIENCE",
  );
  const experienceScoreBp = coverage(
    input.requirements,
    experienceSkills,
    input.relations,
  );
  const fresher = ["STUDENT", "FRESHER"].includes(input.experienceLevel);
  const weights = fresher
    ? experienceSkills.length
      ? { skill: 7000, project: 2500, experience: 500 }
      : { skill: 7300, project: 2700, experience: 0 }
    : { skill: 6500, project: 1500, experience: 2000 };
  const overallScoreBp = Math.round(
    (skillScoreBp * weights.skill +
      projectScoreBp * weights.project +
      experienceScoreBp * weights.experience) /
      BP,
  );
  const matchLevel: MatchLevel =
    overallScoreBp >= 8500 && coreCoverageBp >= 8500
      ? "STRONG_MATCH"
      : overallScoreBp >= 7000 && coreCoverageBp >= 7000
        ? "GOOD_MATCH"
        : overallScoreBp >= 5000 || coreCoverageBp >= 5000
          ? "DEVELOPING_MATCH"
          : "SIGNIFICANT_GAPS";
  return {
    overallScoreBp,
    matchLevel,
    components: {
      coreCoverageBp,
      baseSkillCoverageBp,
      optionalCoverageBp,
      optionalBonusBp,
      skillScoreBp,
      projectScoreBp,
      experienceScoreBp,
    },
    weights,
    requirements: results,
  };
}
