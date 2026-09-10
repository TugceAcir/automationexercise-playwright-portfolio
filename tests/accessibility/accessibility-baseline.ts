// `as const satisfies` rather than a type annotation: annotating widens the keys to
// `string`, so `keyof typeof accessibilityBaseline` at the scan() call sites collapsed to
// `string` and a mistyped state name compiled clean. It does not crash - the lookup is
// undefined, the baseline set comes out empty, and every known violation is then reported
// as a new regression, which reads exactly like a real failure. This keeps the shape
// constrained while narrowing the keys to the five literal state names.
export const accessibilityBaseline = {
  home: ['button-name', 'color-contrast', 'link-name'],
  'product-listing': ['button-name', 'color-contrast'],
  'product-detail': ['button-name', 'color-contrast', 'label'],
  cart: ['button-name', 'color-contrast'],
  checkout: ['button-name', 'color-contrast', 'label']
} as const satisfies Readonly<Record<string, readonly string[]>>;
