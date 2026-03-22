import { z } from "zod";

export const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const responseMetaSchema = paginationMetaSchema
  .partial()
  .extend({
    requestId: z.string().min(1),
    timestamp: z.string().datetime(),
    pagination: paginationMetaSchema.optional(),
  })
  .omit({
    page: true,
    limit: true,
    total: true,
    totalPages: true,
  });

export const successEnvelopeSchema = <TData extends z.ZodType>(dataSchema: TData) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: responseMetaSchema,
  });

export const errorBodySchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: errorBodySchema,
  meta: responseMetaSchema,
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type ResponseMeta = z.infer<typeof responseMetaSchema>;
export type ErrorBody = z.infer<typeof errorBodySchema>;
