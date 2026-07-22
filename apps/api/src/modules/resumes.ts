import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Router } from "express";
import mammoth from "mammoth";
import {
  resumeSkills,
  resumes,
  skillAliases,
  skills,
} from "@skillbridge/database";
import {
  addResumeSkillInputSchema,
  createResumeUploadIntentInputSchema,
} from "@skillbridge/shared";
import { db } from "../config/database.js";
import { AppError } from "../lib/errors.js";
import {
  createSignedResumeUploadUrl,
  downloadResumeObject,
  removeResumeObject,
} from "../lib/storage/supabase.js";
import { authenticate } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";

export const resumeRouter = Router();
resumeRouter.use(authenticate);

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const allowedMimeTypes = new Set([PDF_MIME, DOCX_MIME]);

const validSignature = (buffer: Buffer, mime: string) =>
  mime === PDF_MIME
    ? buffer.subarray(0, 5).toString("ascii") === "%PDF-"
    : buffer[0] === 0x50 && buffer[1] === 0x4b;

const extensionForMime = (mime: string) => (mime === PDF_MIME ? "pdf" : "docx");
const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function evidenceMeta(before: string) {
  const recent = before.slice(-600).toLowerCase();
  if (/experience|employment|internship/.test(recent)) {
    return { source: "EXPERIENCE" as const, factor: 10_000 };
  }
  if (/projects?|portfolio/.test(recent)) {
    return { source: "PROJECT" as const, factor: 10_000 };
  }
  if (/certifications?|courses?/.test(recent)) {
    return { source: "CERTIFICATION" as const, factor: 9_000 };
  }
  if (/summary|profile|objective/.test(recent)) {
    return { source: "SUMMARY" as const, factor: 8_500 };
  }
  if (/skills?|technologies|tools/.test(recent)) {
    return { source: "SKILLS_LIST" as const, factor: 8_000 };
  }
  return { source: "OTHER" as const, factor: 7_000 };
}

function evidenceSentence(text: string, index: number) {
  const start = Math.max(
    text.lastIndexOf("\n", index),
    text.lastIndexOf(".", index - 1),
    index - 180,
  );
  const ends = [text.indexOf("\n", index), text.indexOf(".", index + 1)].filter(
    (value) => value > index,
  );
  const end = ends.length ? Math.min(...ends) + 1 : Math.min(text.length, index + 220);
  return text
    .slice(Math.max(0, start + 1), end)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

async function extractPdf(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise;

  if (document.numPages > 20) {
    throw new AppError(
      422,
      "RESUME_TOO_MANY_PAGES",
      "Resume PDFs may contain at most 20 pages.",
    );
  }

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }

  return pages.join("\n");
}

async function downloadResume(storagePath: string) {
  try {
    return await downloadResumeObject(storagePath);
  } catch {
    throw new AppError(
      500,
      "RESUME_STORAGE_DOWNLOAD_FAILED",
      "The stored resume could not be downloaded.",
    );
  }
}

async function processResume(resumeId: string): Promise<"PROCESSED" | "FAILED"> {
  try {
    const [resume] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, resumeId))
      .limit(1);

    if (!resume) {
      return "FAILED";
    }

    await db
      .update(resumes)
      .set({ status: "PROCESSING", processingError: null, updatedAt: new Date() })
      .where(eq(resumes.id, resumeId));

    const buffer = await downloadResume(resume.storagePath);

    if (
      buffer.byteLength === 0 ||
      buffer.byteLength > MAX_RESUME_BYTES ||
      buffer.byteLength !== resume.fileSizeBytes
    ) {
      throw new AppError(
        422,
        "RESUME_FILE_SIZE_MISMATCH",
        "The uploaded resume size does not match the prepared upload.",
      );
    }

    if (!allowedMimeTypes.has(resume.mimeType) || !validSignature(buffer, resume.mimeType)) {
      throw new AppError(
        415,
        "RESUME_INVALID_FILE_TYPE",
        "Only valid PDF and DOCX files are accepted.",
      );
    }

    const extracted =
      resume.mimeType === PDF_MIME
        ? await extractPdf(buffer)
        : (await mammoth.extractRawText({ buffer })).value;

    const text = extracted
      .replace(/\u0000/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (text.length < 100) {
      throw new AppError(
        422,
        "RESUME_UNREADABLE",
        "This resume does not contain enough readable text.",
      );
    }

    const canonical = await db
      .select({ id: skills.id, name: skills.name, slug: skills.slug })
      .from(skills)
      .where(eq(skills.isActive, true));
    const aliases = await db
      .select({ skillId: skillAliases.skillId, alias: skillAliases.alias })
      .from(skillAliases);

    const aliasesBySkill = new Map<string, string[]>();
    for (const alias of aliases) {
      const list = aliasesBySkill.get(alias.skillId) ?? [];
      list.push(alias.alias);
      aliasesBySkill.set(alias.skillId, list);
    }

    const terms = canonical
      .flatMap((skill) => [
        { skillId: skill.id, display: skill.name, term: skill.name, confidence: 9_500 },
        { skillId: skill.id, display: skill.name, term: skill.slug, confidence: 9_000 },
        ...(aliasesBySkill.get(skill.id) ?? []).map((alias) => ({
          skillId: skill.id,
          display: skill.name,
          term: alias,
          confidence: 9_000,
        })),
      ])
      .sort((a, b) => b.term.length - a.term.length);

    const normalizedText = normalize(text);
    const detected = new Map<
      string,
      {
        skillId: string;
        originalText: string;
        evidenceText: string;
        evidenceSource:
          | "EXPERIENCE"
          | "PROJECT"
          | "CERTIFICATION"
          | "SUMMARY"
          | "SKILLS_LIST"
          | "OTHER";
        evidenceFactorBp: number;
        confidenceBp: number;
      }
    >();

    for (const item of terms) {
      const term = normalize(item.term);
      if (term.length <= 1) continue;

      const match = new RegExp(
        `(^|[^a-z0-9+#])${escape(term).replace(/\\ /g, "\\s+")}([^a-z0-9+#]|$)`,
        "i",
      ).exec(normalizedText);
      if (!match) continue;

      const rawIndex = text.toLowerCase().indexOf(item.term.toLowerCase());
      const index = rawIndex >= 0 ? rawIndex : Math.min(text.length - 1, match.index);
      const meta = evidenceMeta(text.slice(0, index));
      const previous = detected.get(item.skillId);

      if (!previous || meta.factor > previous.evidenceFactorBp) {
        detected.set(item.skillId, {
          skillId: item.skillId,
          originalText: item.display,
          evidenceText: evidenceSentence(text, index) || item.display,
          evidenceSource: meta.source,
          evidenceFactorBp: meta.factor,
          confidenceBp: item.confidence,
        });
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(resumeSkills).where(eq(resumeSkills.resumeId, resumeId));
      if (detected.size) {
        await tx
          .insert(resumeSkills)
          .values([...detected.values()].map((skill) => ({ resumeId, ...skill })));
      }
      await tx
        .update(resumes)
        .set({
          status: "PROCESSED",
          extractedText: text.slice(0, 500_000),
          contentRevision: Math.max(1, resume.contentRevision + 1),
          confirmedRevision: 0,
          processedAt: new Date(),
          processingError: null,
          updatedAt: new Date(),
        })
        .where(eq(resumes.id, resumeId));
    });

    return "PROCESSED";
  } catch (error) {
    await db
      .update(resumes)
      .set({
        status: "FAILED",
        processingError: error instanceof Error ? error.message : "Resume processing failed.",
        updatedAt: new Date(),
      })
      .where(eq(resumes.id, resumeId));
    return "FAILED";
  }
}

resumeRouter.post(
  "/upload-intent",
  validateBody(createResumeUploadIntentInputSchema),
  async (req, res, next) => {
    try {
      const input = createResumeUploadIntentInputSchema.parse(req.body);
      const extension = extensionForMime(input.mimeType);
      const lowerFilename = input.originalFilename.toLowerCase();

      if (!allowedMimeTypes.has(input.mimeType)) {
        throw new AppError(
          415,
          "RESUME_INVALID_FILE_TYPE",
          "Only PDF and DOCX files are accepted.",
        );
      }

      if (!lowerFilename.endsWith(`.${extension}`)) {
        throw new AppError(
          415,
          "RESUME_EXTENSION_MISMATCH",
          `The selected file must use the .${extension} extension.`,
        );
      }

      const resumeId = randomUUID();
      const storagePath = [
        req.auth!.userId,
        resumeId,
        `original.${extension}`,
      ].join("/");

      let signedUpload: { signedUrl: string };
      try {
        signedUpload = await createSignedResumeUploadUrl(storagePath);
      } catch {
        throw new AppError(
          500,
          "RESUME_UPLOAD_URL_FAILED",
          "Could not prepare the resume upload.",
        );
      }

      const created = await db.transaction(async (tx) => {
        await tx
          .update(resumes)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(resumes.userId, req.auth!.userId),
              eq(resumes.isActive, true),
            ),
          );

        const [row] = await tx
          .insert(resumes)
          .values({
            id: resumeId,
            userId: req.auth!.userId,
            originalFilename: input.originalFilename,
            displayName: input.displayName || input.originalFilename,
            storagePath,
            mimeType: input.mimeType,
            fileSizeBytes: input.fileSizeBytes,
            isActive: true,
          })
          .returning();

        if (!row) throw new Error("Resume creation failed");
        return row;
      });

      res.status(201).json({
        success: true,
        data: {
          resumeId: created.id,
          signedUrl: signedUpload.signedUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

resumeRouter.post("/:resumeId/complete-upload", async (req, res, next) => {
  try {
    const [resume] = await db
      .select()
      .from(resumes)
      .where(
        and(
          eq(resumes.id, req.params.resumeId as string),
          eq(resumes.userId, req.auth!.userId),
          isNull(resumes.deletedAt),
        ),
      )
      .limit(1);

    if (!resume) {
      throw new AppError(404, "RESUME_NOT_FOUND", "Resume not found.");
    }

    if (resume.status === "PROCESSING") {
      throw new AppError(409, "RESUME_ALREADY_PROCESSING", "This resume is already processing.");
    }

    const status = resume.status === "PROCESSED" ? "PROCESSED" : await processResume(resume.id);
    const [updated] = await db
      .select({
        id: resumes.id,
        displayName: resumes.displayName,
        status: resumes.status,
        processingError: resumes.processingError,
      })
      .from(resumes)
      .where(eq(resumes.id, resume.id))
      .limit(1);

    res.status(status === "PROCESSED" ? 200 : 422).json({
      success: status === "PROCESSED",
      ...(status === "PROCESSED"
        ? { data: updated }
        : {
            error: {
              code: "RESUME_PROCESSING_FAILED",
              message: updated?.processingError || "Resume processing failed.",
            },
          }),
    });
  } catch (error) {
    next(error);
  }
});

resumeRouter.get("/", async (req, res, next) => {
  try {
    const data = await db
      .select({
        id: resumes.id,
        displayName: resumes.displayName,
        originalFilename: resumes.originalFilename,
        status: resumes.status,
        isActive: resumes.isActive,
        contentRevision: resumes.contentRevision,
        confirmedRevision: resumes.confirmedRevision,
        processingError: resumes.processingError,
        createdAt: resumes.createdAt,
        processedAt: resumes.processedAt,
      })
      .from(resumes)
      .where(and(eq(resumes.userId, req.auth!.userId), isNull(resumes.deletedAt)))
      .orderBy(desc(resumes.createdAt));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

resumeRouter.get("/:resumeId", async (req, res, next) => {
  try {
    const [resume] = await db
      .select({
        id: resumes.id,
        displayName: resumes.displayName,
        originalFilename: resumes.originalFilename,
        status: resumes.status,
        isActive: resumes.isActive,
        extractedText: resumes.extractedText,
        contentRevision: resumes.contentRevision,
        confirmedRevision: resumes.confirmedRevision,
        processingError: resumes.processingError,
        createdAt: resumes.createdAt,
        processedAt: resumes.processedAt,
      })
      .from(resumes)
      .where(
        and(
          eq(resumes.id, req.params.resumeId as string),
          eq(resumes.userId, req.auth!.userId),
          isNull(resumes.deletedAt),
        ),
      )
      .limit(1);

    if (!resume) {
      throw new AppError(404, "RESUME_NOT_FOUND", "Resume not found.");
    }

    const detected = await db
      .select({
        id: resumeSkills.id,
        skillId: resumeSkills.skillId,
        name: skills.name,
        category: skills.category,
        evidenceText: resumeSkills.evidenceText,
        evidenceSource: resumeSkills.evidenceSource,
        confidenceBp: resumeSkills.confidenceBp,
        isRemoved: resumeSkills.isRemoved,
      })
      .from(resumeSkills)
      .innerJoin(skills, eq(skills.id, resumeSkills.skillId))
      .where(eq(resumeSkills.resumeId, resume.id));

    res.json({ success: true, data: { ...resume, skills: detected } });
  } catch (error) {
    next(error);
  }
});

resumeRouter.post("/:resumeId/confirm", async (req, res, next) => {
  try {
    const [resume] = await db
      .select()
      .from(resumes)
      .where(
        and(
          eq(resumes.id, req.params.resumeId as string),
          eq(resumes.userId, req.auth!.userId),
        ),
      )
      .limit(1);

    if (!resume) throw new AppError(404, "RESUME_NOT_FOUND", "Resume not found.");
    if (resume.status !== "PROCESSED") {
      throw new AppError(409, "RESUME_NOT_PROCESSED", "Wait for resume processing to finish.");
    }

    const [data] = await db
      .update(resumes)
      .set({ confirmedRevision: resume.contentRevision, updatedAt: new Date() })
      .where(eq(resumes.id, resume.id))
      .returning();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

resumeRouter.post("/:resumeId/reprocess", async (req, res, next) => {
  try {
    const [resume] = await db
      .select()
      .from(resumes)
      .where(
        and(
          eq(resumes.id, req.params.resumeId as string),
          eq(resumes.userId, req.auth!.userId),
          isNull(resumes.deletedAt),
        ),
      )
      .limit(1);

    if (!resume) throw new AppError(404, "RESUME_NOT_FOUND", "Resume not found.");

    const status = await processResume(resume.id);
    const [updated] = await db
      .select({
        id: resumes.id,
        status: resumes.status,
        processingError: resumes.processingError,
      })
      .from(resumes)
      .where(eq(resumes.id, resume.id))
      .limit(1);

    res.status(status === "PROCESSED" ? 200 : 422).json({
      success: status === "PROCESSED",
      ...(status === "PROCESSED"
        ? { data: updated }
        : {
            error: {
              code: "RESUME_PROCESSING_FAILED",
              message: updated?.processingError || "Resume processing failed.",
            },
          }),
    });
  } catch (error) {
    next(error);
  }
});

resumeRouter.patch("/:resumeId/active", async (req, res, next) => {
  try {
    const [resume] = await db
      .select()
      .from(resumes)
      .where(
        and(
          eq(resumes.id, req.params.resumeId as string),
          eq(resumes.userId, req.auth!.userId),
          isNull(resumes.deletedAt),
        ),
      )
      .limit(1);

    if (!resume) throw new AppError(404, "RESUME_NOT_FOUND", "Resume not found.");

    await db.transaction(async (tx) => {
      await tx
        .update(resumes)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(resumes.userId, req.auth!.userId));
      await tx
        .update(resumes)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(resumes.id, resume.id));
    });

    res.json({ success: true, data: { id: resume.id, isActive: true } });
  } catch (error) {
    next(error);
  }
});

resumeRouter.post(
  "/:resumeId/skills",
  validateBody(addResumeSkillInputSchema),
  async (req, res, next) => {
    try {
      const [resume] = await db
        .select()
        .from(resumes)
        .where(
          and(
            eq(resumes.id, req.params.resumeId as string),
            eq(resumes.userId, req.auth!.userId),
            isNull(resumes.deletedAt),
          ),
        )
        .limit(1);

      if (!resume) throw new AppError(404, "RESUME_NOT_FOUND", "Resume not found.");

      const input = addResumeSkillInputSchema.parse(req.body);
      const [skill] = await db
        .select()
        .from(skills)
        .where(and(eq(skills.id, input.skillId), eq(skills.isActive, true)))
        .limit(1);

      if (!skill) throw new AppError(404, "SKILL_NOT_FOUND", "Skill not found.");

      const [created] = await db
        .insert(resumeSkills)
        .values({
          resumeId: resume.id,
          skillId: skill.id,
          originalText: skill.name,
          evidenceText: input.evidenceText,
          evidenceSource: "MANUAL",
          evidenceFactorBp: 6_000,
          confidenceBp: 10_000,
          isManual: true,
        })
        .returning();

      await db
        .update(resumes)
        .set({ contentRevision: resume.contentRevision + 1, updatedAt: new Date() })
        .where(eq(resumes.id, resume.id));

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  },
);

resumeRouter.delete("/:resumeId/skills/:resumeSkillId", async (req, res, next) => {
  try {
    const [resume] = await db
      .select()
      .from(resumes)
      .where(
        and(
          eq(resumes.id, req.params.resumeId as string),
          eq(resumes.userId, req.auth!.userId),
          isNull(resumes.deletedAt),
        ),
      )
      .limit(1);

    if (!resume) throw new AppError(404, "RESUME_NOT_FOUND", "Resume not found.");

    const [updated] = await db
      .update(resumeSkills)
      .set({ isRemoved: true, updatedAt: new Date() })
      .where(
        and(
          eq(resumeSkills.id, req.params.resumeSkillId as string),
          eq(resumeSkills.resumeId, resume.id),
        ),
      )
      .returning();

    if (!updated) {
      throw new AppError(404, "RESUME_SKILL_NOT_FOUND", "Resume skill not found.");
    }

    await db
      .update(resumes)
      .set({ contentRevision: resume.contentRevision + 1, updatedAt: new Date() })
      .where(eq(resumes.id, resume.id));

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

resumeRouter.delete("/:resumeId", async (req, res, next) => {
  try {
    const [resume] = await db
      .select()
      .from(resumes)
      .where(
        and(
          eq(resumes.id, req.params.resumeId as string),
          eq(resumes.userId, req.auth!.userId),
          isNull(resumes.deletedAt),
        ),
      )
      .limit(1);

    if (!resume) throw new AppError(404, "RESUME_NOT_FOUND", "Resume not found.");

    try {
      await removeResumeObject(resume.storagePath);
    } catch {
      throw new AppError(
        500,
        "RESUME_STORAGE_DELETE_FAILED",
        "The resume file could not be removed from storage.",
      );
    }

    await db
      .update(resumes)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(eq(resumes.id, resume.id));

    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    next(error);
  }
});
