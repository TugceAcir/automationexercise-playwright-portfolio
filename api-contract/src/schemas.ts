import { z } from 'zod';

// z.object accepts unknown extra keys, so a harmless new field on the live API does not break
// the contract. Only the fields and types the suite relies on are required.

export const productSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  price: z.string().regex(/^Rs\. \d+$/),
  brand: z.string().min(1),
  category: z.object({
    usertype: z.object({ usertype: z.string().min(1) }),
    category: z.string().min(1)
  })
});

export const brandSchema = z.object({
  id: z.number().int().positive(),
  brand: z.string().min(1)
});

export const productListSchema = z.object({
  responseCode: z.number().int(),
  products: z.array(productSchema)
});

export const brandListSchema = z.object({
  responseCode: z.number().int(),
  brands: z.array(brandSchema)
});

// Every refusal, and both verifyLogin outcomes Phase 1 exercises, share this shape.
export const messageSchema = z.object({
  responseCode: z.number().int(),
  message: z.string().min(1)
});

// The minimum every answer carries; used where only the outcome code matters.
export const responseCodeSchema = z.object({
  responseCode: z.number().int()
});

export type Product = z.infer<typeof productSchema>;
export type ProductList = z.infer<typeof productListSchema>;
export type BrandList = z.infer<typeof brandListSchema>;
export type MessageResponse = z.infer<typeof messageSchema>;
