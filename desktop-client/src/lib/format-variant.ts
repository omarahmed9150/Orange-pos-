export interface Variant {
  size?: string | null;
  color?: string | null;
  product?: {
    name: string;
  };
  name?: string;
}

export function formatVariantLabel(variant: Variant): string {
  const name = variant.product?.name || variant.name || 'Unknown';
  
  if (!variant.size && !variant.color) {
    return name;
  }
  
  const parts: string[] = [];
  if (variant.size) parts.push(variant.size);
  if (variant.color) parts.push(variant.color);
  
  return `${name} (${parts.join('/')})`;
}
