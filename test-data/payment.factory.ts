export type PaymentDetails = {
  nameOnCard: string;
  cardNumber: string;
  cvc: string;
  expirationMonth: string;
  expirationYear: string;
};

export const testPayment: PaymentDetails = {
  nameOnCard: 'Quality Engineer',
  cardNumber: '4111111111111111',
  cvc: '123',
  expirationMonth: '12',
  expirationYear: '2030'
};
