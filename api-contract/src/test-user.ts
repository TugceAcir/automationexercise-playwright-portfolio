import { createHash, randomUUID } from 'node:crypto';

// Package-local generated accounts. Modelled on the UI's test-data/user.factory.ts, not imported:
// the API runtime never imports UI code.
//
// The password is derived from the account's identifier with a fixed, public recipe and is
// never written anywhere. That is a deliberate trade-off (see the approved Phase 2 plan): a
// leftover account can always be cleaned up from its email alone, at the cost that anyone who
// reads this file could do the same to these synthetic practice-site accounts.

export const GENERATED_EMAIL_PATTERN = /^api-contract\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@example\.com$/;

export type GeneratedAccount = {
  id: string;
  name: string;
  email: string;
  password: string;
  title: 'Mr' | 'Mrs' | 'Miss';
  birthDate: string;
  birthMonth: string;
  birthYear: string;
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  country: string;
  zipCode: string;
  state: string;
  city: string;
  mobileNumber: string;
};

export function derivePassword(id: string): string {
  return `ApiContract!${createHash('sha256').update(`api-contract-account:${id}`).digest('hex').slice(0, 16)}`;
}

/** The identifier inside a generated email, or undefined for any address this package did not create. */
export function generatedIdFromEmail(email: string): string | undefined {
  return GENERATED_EMAIL_PATTERN.exec(email)?.[1];
}

export function createGeneratedAccount(id: string = randomUUID()): GeneratedAccount {
  const email = `api-contract.${id}@example.com`;

  if (!GENERATED_EMAIL_PATTERN.test(email)) {
    throw new Error(`Not a generated-account identifier: ${id}`);
  }

  return {
    id,
    name: `API Contract ${id.slice(0, 8)}`,
    email,
    password: derivePassword(id),
    title: 'Mr',
    birthDate: '10',
    birthMonth: '5',
    birthYear: '1990',
    firstName: 'Api',
    lastName: 'Contract',
    company: 'API Contract Suite',
    address1: '100 Automation Avenue',
    address2: 'Suite 42',
    country: 'United States',
    zipCode: '10001',
    state: 'New York',
    city: 'New York',
    mobileNumber: '5551234567'
  };
}

/**
 * Which lookup field answers for which form field, verified in the 2026-09-20 discovery session.
 * The names are not symmetrical, and `mobile_number` has no lookup field at all - it is absent
 * from the map on purpose, so an update to it cannot be silently "proven".
 */
export const LOOKUP_FIELD_BY_FORM_FIELD: Record<string, string> = {
  name: 'name',
  email: 'email',
  title: 'title',
  birth_date: 'birth_day',
  birth_month: 'birth_month',
  birth_year: 'birth_year',
  firstname: 'first_name',
  lastname: 'last_name',
  company: 'company',
  address1: 'address1',
  address2: 'address2',
  country: 'country',
  zipcode: 'zipcode',
  state: 'state',
  city: 'city'
};

/** Form fields whose effect a lookup cannot confirm, so a write changing them cannot be proven. */
export function unprovableFields(changes: Record<string, string>): string[] {
  return Object.keys(changes).filter((field) => !(field in LOOKUP_FIELD_BY_FORM_FIELD) && field !== 'password');
}

/** The documented createAccount / updateAccount form fields, by their API names. */
export function accountForm(account: GeneratedAccount): Record<string, string> {
  return {
    name: account.name,
    email: account.email,
    password: account.password,
    title: account.title,
    birth_date: account.birthDate,
    birth_month: account.birthMonth,
    birth_year: account.birthYear,
    firstname: account.firstName,
    lastname: account.lastName,
    company: account.company,
    address1: account.address1,
    address2: account.address2,
    country: account.country,
    zipcode: account.zipCode,
    state: account.state,
    city: account.city,
    mobile_number: account.mobileNumber
  };
}
