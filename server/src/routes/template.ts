import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { getRegTemplate, setRegTemplate } from '../services/db'
import defaultTemplate from '../config/defaultTemplate'

const router = Router()

const guidedFieldSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  labelKey: z.string().max(128).optional(),
  placeholder: z.string().max(512).optional(),
  placeholderKey: z.string().max(128).optional(),
  type: z.enum(['text', 'textarea']),
})

const stepSchema = z.object({
  label: z.string().min(1).max(128),
  labelKey: z.string().max(128).optional(),
  description: z.string().max(512).optional(),
  descriptionKey: z.string().max(128).optional(),
  sectionLabelEn: z.string().max(128).optional(),
  systemContext: z.string().min(1).max(8000),
  promptSuffix: z.string().max(512).optional(),
  guidedFields: z.array(guidedFieldSchema).max(8).optional(),
  guidedPromptSuffix: z.string().max(1024).optional(),
})

const templateSchema = z.object({
  meta: z.object({
    company: z.string().max(128).optional(),
    domain: z.string().max(64).optional(),
    version: z.string().max(32).optional(),
    description: z.string().max(512).optional(),
  }).optional(),
  rag: z.object({
    maxPriorSections: z.number().int().min(0).max(10),
    maxContextFileChars: z.number().int().min(0).max(200_000),
    maxSectionChars: z.number().int().min(0).max(10_000),
    maxIdeaChars: z.number().int().min(0).max(10_000),
    maxConstraintsChars: z.number().int().min(0).max(10_000),
  }).optional(),
  workflow: z.object({
    order: z.array(z.string().min(1).max(64)).min(1).max(20),
  }),
  steps: z.record(z.string(), stepSchema),
})

// GET /template — return current workflow template
router.get('/', (_req: Request, res: Response) => {
  return res.json({ success: true, data: getRegTemplate() })
})

// PUT /template — update workflow template
router.put('/', (req: Request, res: Response) => {
  const parsed = templateSchema.safeParse(req.body)
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.') || 'input')
    return res.status(400).json({ success: false, error: 'Validation failed', fields })
  }

  // Ensure every step referenced in workflow.order exists in steps
  const { workflow, steps } = parsed.data
  const missing = workflow.order.filter((key) => !(key in steps))
  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'workflow.order references steps that do not exist',
      fields: missing,
    })
  }

  setRegTemplate(parsed.data)
  return res.json({ success: true, data: parsed.data })
})

// POST /template/reset — restore factory defaults
router.post('/reset', (_req: Request, res: Response) => {
  setRegTemplate(defaultTemplate)
  return res.json({ success: true, data: defaultTemplate })
})

export default router
