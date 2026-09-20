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

// The account record getUserDetailByEmail returns for an email that exists. Written from the
// live discovery session of 2026-09-20, not from the published API list: the two disagree.
//
// The response is NOT the mirror image of the create/update form. The form sends `birth_date`,
// `firstname`, `lastname` and `mobile_number`; the lookup answers with `birth_day`,
// `first_name`, `last_name` and no mobile number at all. Only `id` is a number. No password is
// ever echoed back, which is why cleanup evidence can hold an email and still hold no secret.
export const userAccountSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  email: z.string().min(1),
  title: z.string(),
  birth_day: z.string(),
  birth_month: z.string(),
  birth_year: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  company: z.string(),
  address1: z.string(),
  address2: z.string(),
  country: z.string(),
  state: z.string(),
  city: z.string(),
  zipcode: z.string()
});

export const userDetailSchema = z.object({
  responseCode: z.number().int(),
  user: userAccountSchema
});

export type Product = z.infer<typeof productSchema>;
export type ProductList = z.infer<typeof productListSchema>;
export type BrandList = z.infer<typeof brandListSchema>;
export type MessageResponse = z.infer<typeof messageSchema>;
export type UserAccount = z.infer<typeof userAccountSchema>;
export type UserDetail = z.infer<typeof userDetailSchema>;
