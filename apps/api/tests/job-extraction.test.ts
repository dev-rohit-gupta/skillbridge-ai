import {describe, expect, it} from "vitest";
import {DeterministicAiProvider} from "../src/modules/ai/provider.js";

describe("deterministic job requirement extraction", () => {
  it("extracts and classifies canonical skills", async () => {
    const provider = new DeterministicAiProvider();
    const result = await provider.extractJobRequirements({
      title: "Backend Developer",
      description: "Node.js and Express are required. PostgreSQL experience is mandatory. Docker is nice to have.",
      skills: [
        {id: "node", name: "Node.js", slug: "nodejs", aliases: ["node js"]},
        {id: "express", name: "Express.js", slug: "expressjs", aliases: ["express"]},
        {id: "postgres", name: "PostgreSQL", slug: "postgresql", aliases: ["postgres"]},
        {id: "docker", name: "Docker", slug: "docker", aliases: []},
      ],
    });
    expect(result).toHaveLength(4);
    expect(result.find((item) => item.skillId === "postgres")?.importance).toBe("CORE");
    expect(result.find((item) => item.skillId === "docker")?.importance).toBe("OPTIONAL");
  });
});
