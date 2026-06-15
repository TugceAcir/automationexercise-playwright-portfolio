export type TestUser = {
  name: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  country: string;
  state: string;
  city: string;
  zipCode: string;
  mobileNumber: string;
};

export function createTestUser(label = 'portfolio'): TestUser {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    name: `QA ${label}`,
    email: `qa.${label}.${unique}@example.com`,
    password: 'SeniorQA!2026',
    firstName: 'Quality',
    lastName: 'Engineer',
    company: 'AI Assisted QA Studio',
    address1: '100 Automation Avenue',
    address2: 'Suite 42',
    country: 'United States',
    state: 'New York',
    city: 'New York',
    zipCode: '10001',
    mobileNumber: '5551234567'
  };
}
