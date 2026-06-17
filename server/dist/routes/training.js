import { Router } from "express";
import { z } from "zod";
import { getBaseModels, MIN_EXAMPLES, TrainingValidationError, createTrainingJob, deleteTrainingJob, listTrainingJobs, syncActiveTrainingJobs, syncTrainingJob, } from "../lib/finetune.js";
import { MissingOpenAIKeyError } from "../lib/openai.js";
import { MissingTogetherKeyError } from "../lib/together.js";
import { MissingMistralKeyError } from "../lib/mistral.js";
const router = Router();
const CreateJobBody = z.object({
    name: z.string().min(1).max(100),
    baseModel: z.string().min(1),
    source: z.enum(["conversations", "examples", "jsonl"]),
    conversationIds: z.array(z.number()).optional(),
    examples: z
        .array(z.object({
        system: z.string().optional(),
        prompt: z.string(),
        completion: z.string(),
    }))
        .optional(),
    jsonl: z.string().optional(),
    hyperparameters: z
        .object({
        nEpochs: z.number().int().min(1).max(20).optional(),
        batchSize: z.number().int().min(1).max(1024).optional(),
        learningRate: z.number().positive().max(1).optional(),
        learningRateMultiplier: z.number().positive().max(100).optional(),
        loraR: z.number().int().min(1).max(256).optional(),
        loraAlpha: z.number().int().min(1).max(512).optional(),
        trainingSteps: z.number().int().min(1).max(10000).optional(),
    })
        .optional(),
});
router.get("/training/base-models", (_req, res) => {
    res.json({ baseModels: getBaseModels(), minExamples: MIN_EXAMPLES });
});
router.get("/training/jobs", async (_req, res) => {
    await syncActiveTrainingJobs();
    res.json(await listTrainingJobs());
});
router.post("/training/jobs", async (req, res) => {
    const body = CreateJobBody.parse(req.body);
    try {
        const job = await createTrainingJob(body);
        res.status(201).json(job);
    }
    catch (err) {
        if (err instanceof TrainingValidationError ||
            err instanceof MissingOpenAIKeyError ||
            err instanceof MissingTogetherKeyError ||
            err instanceof MissingMistralKeyError) {
            res.status(400).json({ error: err.message });
            return;
        }
        // Provider rejected the upload/job (bad key, invalid file, outage, etc.).
        const message = err instanceof Error ? err.message : "Failed to start the fine-tuning job.";
        res.status(502).json({ error: message });
    }
});
router.post("/training/jobs/:id/refresh", async (req, res) => {
    const id = Number(req.params.id);
    const job = await syncTrainingJob(id);
    if (!job) {
        res.status(404).json({ error: "Training job not found" });
        return;
    }
    res.json(job);
});
router.delete("/training/jobs/:id", async (req, res) => {
    const id = Number(req.params.id);
    const ok = await deleteTrainingJob(id);
    if (!ok) {
        res.status(404).json({ error: "Training job not found" });
        return;
    }
    res.status(204).end();
});
export default router;
