import path from "node:path";
import dotenv from "dotenv";
dotenv.config({path: path.resolve(process.cwd(), "../../.env"), quiet: true});
dotenv.config({quiet: true});
import { eq, inArray } from "drizzle-orm";
import { createDatabase } from "./index";
import {careerRoles, roleRequirements, roleRequirementSkills, skillAliases, skillRelations, skills} from "./schema";

const databaseUrl = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL or DATABASE_URL_DIRECT is required.");
const {db, pool} = createDatabase(databaseUrl);
const skillSeed = [
  ["html", "HTML", "FRONTEND", ["html5", "semantic html"]], ["css", "CSS", "FRONTEND", ["css3"]],
  ["javascript", "JavaScript", "LANGUAGE", ["js", "ecmascript", "es6"]], ["typescript", "TypeScript", "LANGUAGE", ["ts"]],
  ["react", "React", "FRONTEND", ["react.js", "reactjs"]], ["responsive-design", "Responsive Design", "FRONTEND", ["responsive web design", "media queries"]],
  ["rest-api", "REST API", "BACKEND", ["restful api", "rest apis", "api integration"]], ["git", "Git", "TOOLS", ["github", "gitlab", "version control"]],
  ["react-query", "React Query", "FRONTEND", ["tanstack query", "@tanstack/react-query"]], ["zustand", "Zustand", "FRONTEND", []],
  ["redux", "Redux", "FRONTEND", ["redux toolkit", "rtk"]], ["react-hook-form", "React Hook Form", "FRONTEND", ["rhf"]],
  ["zod", "Zod", "TOOLS", []], ["react-router", "React Router", "FRONTEND", ["react-router-dom"]],
  ["frontend-testing", "Frontend Testing", "TESTING", ["react testing library", "vitest", "jest"]], ["accessibility", "Web Accessibility", "FRONTEND", ["wcag", "aria", "a11y"]],
  ["vite", "Vite", "TOOLS", []], ["nextjs", "Next.js", "FRONTEND", ["next js"]], ["tailwind", "Tailwind CSS", "FRONTEND", ["tailwind"]],
  ["nodejs", "Node.js", "BACKEND", ["node", "nodejs", "node js"]], ["express", "Express.js", "BACKEND", ["express", "expressjs", "express js"]],
  ["sql", "SQL", "DATABASE", []], ["postgresql", "PostgreSQL", "DATABASE", ["postgres", "psql"]], ["mysql", "MySQL", "DATABASE", []],
  ["authentication", "Authentication", "BACKEND", ["jwt", "oauth", "session authentication"]], ["drizzle", "Drizzle ORM", "DATABASE", ["drizzle-orm", "drizzle orm"]],
  ["prisma", "Prisma", "DATABASE", ["prisma orm"]], ["database-design", "Database Design", "DATABASE", ["schema design", "normalization", "database modelling"]],
  ["backend-testing", "Backend Testing", "TESTING", ["supertest", "integration testing", "api testing"]], ["api-documentation", "API Documentation", "BACKEND", ["swagger", "openapi"]],
  ["docker", "Docker", "DEVOPS", ["containerization", "containers"]], ["redis", "Redis", "DATABASE", ["caching"]], ["cicd", "CI/CD", "DEVOPS", ["github actions", "gitlab ci", "continuous integration"]],
  ["websocket", "WebSocket", "BACKEND", ["socket.io", "sse", "realtime communication"]], ["excel", "Microsoft Excel", "DATA_ANALYSIS", ["excel", "spreadsheets", "google sheets"]],
  ["data-cleaning", "Data Cleaning", "DATA_ANALYSIS", ["data preprocessing", "preprocessing"]], ["data-visualization", "Data Visualization", "DATA_ANALYSIS", ["charts", "dashboards", "visualisation"]],
  ["statistics", "Statistics", "DATA_ANALYSIS", ["probability", "basic statistics"]], ["data-interpretation", "Data Interpretation", "DATA_ANALYSIS", ["trend analysis", "insight generation"]],
  ["python", "Python", "LANGUAGE", []], ["pandas", "Pandas", "DATA_ANALYSIS", []], ["numpy", "NumPy", "DATA_ANALYSIS", []], ["power-bi", "Power BI", "DATA_ANALYSIS", ["powerbi"]],
  ["tableau", "Tableau", "DATA_ANALYSIS", []], ["eda", "Exploratory Data Analysis", "DATA_ANALYSIS", ["eda"]], ["figma", "Figma", "DESIGN", []],
  ["user-research", "User Research", "DESIGN", ["user interviews", "surveys"]], ["wireframing", "Wireframing", "DESIGN", ["wireframes"]],
  ["prototyping", "Prototyping", "DESIGN", ["interactive prototype", "prototype"]], ["user-flows", "User Flows", "DESIGN", ["task flows", "user flow"]],
  ["visual-design", "Visual Design", "DESIGN", ["typography", "color theory", "design hierarchy"]], ["usability-testing", "Usability Testing", "DESIGN", ["user testing", "usability tests"]],
  ["information-architecture", "Information Architecture", "DESIGN", ["sitemap", "navigation structure"]], ["design-systems", "Design Systems", "DESIGN", ["design tokens", "component library"]],
  ["interaction-design", "Interaction Design", "DESIGN", ["microinteractions"]], ["developer-handoff", "Developer Handoff", "DESIGN", ["design specs", "annotations"]],
] as const;
const roleSeed = [
  {slug: "frontend-developer", name: "Frontend Developer", description: "Builds accessible, responsive and maintainable web interfaces.", requirements: [
    ["HTML","CORE",3,["html"]],["CSS","CORE",3,["css"]],["JavaScript","CORE",3,["javascript"]],["React","CORE",3,["react"]],["Responsive Design","CORE",3,["responsive-design"]],["API Integration","CORE",3,["rest-api"]],["Version Control","CORE",3,["git"]],
    ["Type Safety","IMPORTANT",2,["typescript"]],["State Management","IMPORTANT",2,["react-query","zustand","redux"]],["Form Handling","IMPORTANT",2,["react-hook-form"]],["Validation","IMPORTANT",2,["zod"]],["Routing","IMPORTANT",2,["react-router"]],["Testing","IMPORTANT",2,["frontend-testing"]],["Accessibility","IMPORTANT",2,["accessibility"]],["Build Tooling","IMPORTANT",2,["vite"]],
    ["Framework","OPTIONAL",1,["nextjs"]],["Styling","OPTIONAL",1,["tailwind"]],["CI/CD","OPTIONAL",1,["cicd"]],
  ]},
  {slug: "backend-developer", name: "Backend Developer", description: "Designs secure APIs, databases and server-side application logic.", requirements: [
    ["JavaScript or TypeScript","CORE",3,["javascript","typescript"]],["Node.js","CORE",3,["nodejs"]],["Express.js","CORE",3,["express"]],["REST API","CORE",3,["rest-api"]],["SQL","CORE",3,["sql"]],["Relational Database","CORE",3,["postgresql","mysql"]],["Authentication","CORE",3,["authentication"]],["Version Control","CORE",3,["git"]],
    ["ORM","IMPORTANT",2,["drizzle","prisma"]],["Validation","IMPORTANT",2,["zod"]],["Database Design","IMPORTANT",2,["database-design"]],["Backend Testing","IMPORTANT",2,["backend-testing"]],["API Documentation","IMPORTANT",2,["api-documentation"]],
    ["Docker","OPTIONAL",1,["docker"]],["Redis","OPTIONAL",1,["redis"]],["CI/CD","OPTIONAL",1,["cicd"]],["Realtime","OPTIONAL",1,["websocket"]],
  ]},
  {slug: "full-stack-developer", name: "Full-Stack Developer", description: "Builds complete applications across browser, API and database layers.", requirements: [
    ["HTML","CORE",3,["html"]],["CSS","CORE",3,["css"]],["JavaScript or TypeScript","CORE",3,["javascript","typescript"]],["React","CORE",3,["react"]],["Node.js","CORE",3,["nodejs"]],["Express.js","CORE",3,["express"]],["REST API","CORE",3,["rest-api"]],["Relational Database","CORE",3,["postgresql","mysql"]],["Authentication","CORE",3,["authentication"]],
    ["Server State","IMPORTANT",2,["react-query"]],["Client State","IMPORTANT",2,["zustand","redux"]],["Validation","IMPORTANT",2,["zod"]],["ORM","IMPORTANT",2,["drizzle","prisma"]],["Responsive Design","IMPORTANT",2,["responsive-design"]],["Testing","IMPORTANT",2,["frontend-testing","backend-testing"]],
    ["Docker","OPTIONAL",1,["docker"]],["CI/CD","OPTIONAL",1,["cicd"]],["Realtime","OPTIONAL",1,["websocket"]],
  ]},
  {slug: "data-analyst", name: "Data Analyst", description: "Cleans, explores and communicates data to support decisions.", requirements: [
    ["Spreadsheets","CORE",3,["excel"]],["SQL","CORE",3,["sql"]],["Data Cleaning","CORE",3,["data-cleaning"]],["Data Visualization","CORE",3,["data-visualization"]],["Statistics","CORE",3,["statistics"]],["Data Interpretation","CORE",3,["data-interpretation"]],
    ["Programming","IMPORTANT",2,["python"]],["Data Manipulation","IMPORTANT",2,["pandas","numpy"]],["BI Tool","IMPORTANT",2,["power-bi","tableau"]],["Database","IMPORTANT",2,["postgresql","mysql"]],["Exploratory Analysis","IMPORTANT",2,["eda"]],["Version Control","OPTIONAL",1,["git"]],
  ]},
  {slug: "ui-ux-designer", name: "UI/UX Designer", description: "Researches users and creates usable, accessible digital experiences.", requirements: [
    ["Figma","CORE",3,["figma"]],["User Research","CORE",3,["user-research"]],["Wireframing","CORE",3,["wireframing"]],["Prototyping","CORE",3,["prototyping"]],["User Flows","CORE",3,["user-flows"]],["Visual Design","CORE",3,["visual-design"]],["Usability Testing","CORE",3,["usability-testing"]],
    ["Information Architecture","IMPORTANT",2,["information-architecture"]],["Responsive Design","IMPORTANT",2,["responsive-design"]],["Design Systems","IMPORTANT",2,["design-systems"]],["Interaction Design","IMPORTANT",2,["interaction-design"]],["Accessibility","IMPORTANT",2,["accessibility"]],["Developer Handoff","IMPORTANT",2,["developer-handoff"]],["Frontend Basics","OPTIONAL",1,["html","css"]],
  ]},
] as const;

async function main() {
  await db.transaction(async (tx) => {
    const slugs = skillSeed.map(([slug]) => slug);
    const existing = await tx.select().from(skills).where(inArray(skills.slug, slugs));
    const skillMap = new Map(existing.map((skill) => [skill.slug, skill]));
    for (const [slug, name, category, aliases] of skillSeed) {
      let skill = skillMap.get(slug);
      if (!skill) {
        [skill] = await tx.insert(skills).values({slug, name, category}).returning();
        if (!skill) throw new Error(`Failed to create ${slug}`);
        skillMap.set(slug, skill);
      }
      for (const alias of aliases) {
        const normalizedAlias = alias.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
        await tx.insert(skillAliases).values({skillId: skill.id, alias, normalizedAlias}).onConflictDoNothing();
      }
    }
    for (const [source, target, matchFactorBp] of [["nodejs","express",5000],["react","javascript",5000],["postgresql","sql",7500],["mysql","sql",7500],["power-bi","data-visualization",7500],["figma","visual-design",5000]] as const) {
      const sourceSkill = skillMap.get(source); const targetSkill = skillMap.get(target);
      if (sourceSkill && targetSkill) await tx.insert(skillRelations).values({sourceSkillId: sourceSkill.id, targetSkillId: targetSkill.id, matchFactorBp}).onConflictDoNothing();
    }
    for (const roleData of roleSeed) {
      let [role] = await tx.select().from(careerRoles).where(eq(careerRoles.slug, roleData.slug)).limit(1);
      if (!role) [role] = await tx.insert(careerRoles).values({slug: roleData.slug, name: roleData.name, description: roleData.description}).returning();
      if (!role) throw new Error(`Failed role ${roleData.slug}`);
      const existingRequirements = await tx.select().from(roleRequirements).where(eq(roleRequirements.careerRoleId, role.id));
      if (existingRequirements.length) continue;
      let sortOrder = 0;
      for (const [name, importance, weight, acceptedSlugs] of roleData.requirements) {
        const [requirement] = await tx.insert(roleRequirements).values({careerRoleId: role.id, name, importance, weight, matchMode: "ANY", sortOrder: sortOrder++}).returning();
        if (!requirement) throw new Error(`Failed requirement ${name}`);
        for (const slug of acceptedSlugs) {
          const skill = skillMap.get(slug); if (!skill) throw new Error(`Unknown skill ${slug}`);
          await tx.insert(roleRequirementSkills).values({roleRequirementId: requirement.id, skillId: skill.id, isPrimary: acceptedSlugs[0] === slug});
        }
      }
    }
  });
  console.log("Seed completed.");
}
main().finally(async () => pool.end());
