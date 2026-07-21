import {describe, expect, it} from "vitest";
import {scoreAnalysis} from "../src/modules/scoring";
describe("scoreAnalysis", () => {
  it("scores exact skills", () => {
    const result = scoreAnalysis({experienceLevel: "FRESHER", relations: [], candidateSkills: [{skillId: "react", evidenceFactorBp: 10000, evidenceSource: "PROJECT"}], requirements: [{id: "1", name: "React", importance: "CORE", weight: 3, acceptedSkillIds: ["react"]}]});
    expect(result.components.baseSkillCoverageBp).toBe(10000); expect(result.requirements[0]?.effectiveBp).toBe(10000);
  });
  it("uses direct relations", () => {
    const result = scoreAnalysis({experienceLevel: "STUDENT", candidateSkills: [{skillId: "node", evidenceFactorBp: 10000, evidenceSource: "PROJECT"}], relations: [{sourceSkillId: "node", targetSkillId: "express", matchFactorBp: 5000}], requirements: [{id: "1", name: "Express", importance: "CORE", weight: 3, acceptedSkillIds: ["express"]}]});
    expect(result.requirements[0]?.effectiveBp).toBe(5000);
  });
});
