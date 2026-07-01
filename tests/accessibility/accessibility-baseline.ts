export const accessibilityBaseline: Readonly<Record<string, readonly string[]>> = {
  home: ['button-name', 'color-contrast', 'link-name'],
  'product-listing': ['button-name', 'color-contrast'],
  'product-detail': ['button-name', 'color-contrast', 'label'],
  cart: ['button-name', 'color-contrast'],
  checkout: ['button-name', 'color-contrast', 'label']
};
