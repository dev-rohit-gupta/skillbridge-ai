import {asc, eq, ilike, or} from "drizzle-orm";
import {Router} from "express";
import {careerRoles, roleRequirements, roleRequirementSkills, skills} from "@skillbridge/database";
import {db} from "../config/database";
import {authenticate} from "../middleware/auth";
export const referenceRouter = Router(); referenceRouter.use(authenticate);
referenceRouter.get("/career-roles", async (_req, res, next) => {
  try {
    const roles = await db.select().from(careerRoles).where(eq(careerRoles.isActive, true)).orderBy(asc(careerRoles.name));
    const rows = await db.select({id: roleRequirements.id, careerRoleId: roleRequirements.careerRoleId, name: roleRequirements.name, importance: roleRequirements.importance, weight: roleRequirements.weight, skillId: skills.id, skillName: skills.name})
      .from(roleRequirements).leftJoin(roleRequirementSkills, eq(roleRequirementSkills.roleRequirementId, roleRequirements.id)).leftJoin(skills, eq(skills.id, roleRequirementSkills.skillId)).where(eq(roleRequirements.isActive, true)).orderBy(asc(roleRequirements.sortOrder));
    const data = roles.map((role) => ({...role, requirements: Object.values(rows.filter((row) => row.careerRoleId === role.id).reduce<Record<string, {id: string; name: string; importance: string; weight: number; skills: {id: string; name: string}[]}>>((acc, row) => {acc[row.id] ??= {id: row.id, name: row.name, importance: row.importance, weight: row.weight, skills: []}; if (row.skillId && row.skillName) acc[row.id]!.skills.push({id: row.skillId, name: row.skillName}); return acc}, {}))}));
    res.json({success: true, data});
  } catch (error) {next(error)}
});
referenceRouter.get("/skills/search", async (req, res, next) => {try {const q = String(req.query.q ?? "").trim(); if (!q) return res.json({success: true, data: []}); const data = await db.select({id: skills.id, slug: skills.slug, name: skills.name, category: skills.category}).from(skills).where(or(ilike(skills.name, `%${q}%`), ilike(skills.slug, `%${q}%`))).limit(20); res.json({success: true, data})} catch (error) {next(error)}});
