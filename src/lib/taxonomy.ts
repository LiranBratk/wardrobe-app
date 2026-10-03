export type Slot = 'top' | 'bottom' | 'onepiece' | 'outerwear' | 'shoes' | 'accessory';

export interface CategoryDef {
  id: string;
  label: string;
  slot: Slot;
  prompt: string;
  warmth: 1 | 2 | 3;
  formality: number;
  keywords: string[];
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'tshirt', label: 'T-shirt', slot: 'top', prompt: 'a t-shirt', warmth: 1, formality: 1, keywords: ['t-shirt', 'tshirt', 'tee'] },
  { id: 'tank', label: 'Tank top', slot: 'top', prompt: 'a tank top', warmth: 1, formality: 1, keywords: ['tank', 'singlet'] },
  { id: 'shirt', label: 'Shirt / blouse', slot: 'top', prompt: 'a button-up shirt or blouse', warmth: 1, formality: 3, keywords: ['shirt', 'blouse', 'button-up', 'button up'] },
  { id: 'polo', label: 'Polo', slot: 'top', prompt: 'a polo shirt', warmth: 1, formality: 2, keywords: ['polo'] },
  { id: 'sweater', label: 'Sweater / knit', slot: 'top', prompt: 'a knit sweater', warmth: 3, formality: 2, keywords: ['sweater', 'jumper', 'knit', 'pullover', 'cardigan'] },
  { id: 'hoodie', label: 'Hoodie / sweatshirt', slot: 'top', prompt: 'a hoodie or sweatshirt', warmth: 2, formality: 1, keywords: ['hoodie', 'sweatshirt', 'crewneck'] },
  { id: 'jacket', label: 'Jacket', slot: 'outerwear', prompt: 'a jacket', warmth: 2, formality: 2, keywords: ['jacket', 'bomber', 'windbreaker', 'overshirt'] },
  { id: 'blazer', label: 'Blazer', slot: 'outerwear', prompt: 'a blazer', warmth: 2, formality: 4, keywords: ['blazer', 'sport coat', 'suit jacket'] },
  { id: 'coat', label: 'Coat', slot: 'outerwear', prompt: 'a long winter coat', warmth: 3, formality: 3, keywords: ['coat', 'parka', 'trench', 'puffer'] },
  { id: 'jeans', label: 'Jeans', slot: 'bottom', prompt: 'a pair of blue denim jeans', warmth: 2, formality: 2, keywords: ['jeans', 'denim'] },
  { id: 'trousers', label: 'Trousers / chinos', slot: 'bottom', prompt: 'a pair of trousers or chinos', warmth: 2, formality: 3, keywords: ['trousers', 'pants', 'chinos', 'slacks'] },
  { id: 'joggers', label: 'Joggers / sweatpants', slot: 'bottom', prompt: 'a pair of sweatpants or joggers', warmth: 2, formality: 1, keywords: ['joggers', 'sweatpants', 'track pants', 'leggings'] },
  { id: 'shorts', label: 'Shorts', slot: 'bottom', prompt: 'a pair of shorts', warmth: 1, formality: 1, keywords: ['shorts'] },
  { id: 'skirt', label: 'Skirt', slot: 'bottom', prompt: 'a skirt', warmth: 1, formality: 3, keywords: ['skirt'] },
  { id: 'dress', label: 'Dress', slot: 'onepiece', prompt: 'a dress', warmth: 1, formality: 3, keywords: ['dress', 'gown'] },
  { id: 'jumpsuit', label: 'Jumpsuit / overalls', slot: 'onepiece', prompt: 'a jumpsuit or overalls', warmth: 2, formality: 2, keywords: ['jumpsuit', 'overalls', 'romper'] },
  { id: 'sneakers', label: 'Sneakers', slot: 'shoes', prompt: 'a pair of sneakers', warmth: 2, formality: 1, keywords: ['sneakers', 'trainers', 'runners'] },
  { id: 'boots', label: 'Boots', slot: 'shoes', prompt: 'a pair of boots', warmth: 3, formality: 3, keywords: ['boots', 'boot'] },
  { id: 'dressshoes', label: 'Dress shoes / loafers', slot: 'shoes', prompt: 'a pair of leather dress shoes or loafers', warmth: 2, formality: 4, keywords: ['loafers', 'oxfords', 'heels', 'dressshoes', 'derbies'] },
  { id: 'sandals', label: 'Sandals / slides', slot: 'shoes', prompt: 'a pair of sandals or flip-flops', warmth: 1, formality: 1, keywords: ['sandals', 'slides', 'flip-flops', 'flip flops'] },
  { id: 'bag', label: 'Bag', slot: 'accessory', prompt: 'a bag or backpack', warmth: 2, formality: 2, keywords: ['bag', 'backpack', 'tote', 'purse'] },
  { id: 'hat', label: 'Hat / cap', slot: 'accessory', prompt: 'a hat or cap', warmth: 2, formality: 1, keywords: ['hat', 'cap', 'beanie'] },
  { id: 'scarf', label: 'Scarf', slot: 'accessory', prompt: 'a scarf', warmth: 3, formality: 2, keywords: ['scarf'] },
  { id: 'accessory', label: 'Other accessory', slot: 'accessory', prompt: 'a belt, watch, or jewelry', warmth: 2, formality: 2, keywords: ['belt', 'watch', 'jewelry', 'necklace', 'sunglasses'] }
];

export const PATTERNS = [
  { id: 'solid', label: 'Solid', prompt: 'a plain solid-colored garment' },
  { id: 'striped', label: 'Striped', prompt: 'a striped garment' },
  { id: 'checked', label: 'Plaid / checked', prompt: 'a plaid checked garment' },
  { id: 'floral', label: 'Floral', prompt: 'a floral print garment' },
  { id: 'graphic', label: 'Graphic / logo', prompt: 'a garment with a graphic print or logo' },
  { id: 'dotted', label: 'Polka dot', prompt: 'a polka dot garment' },
  { id: 'textured', label: 'Textured / knit', prompt: 'a chunky textured knit garment' },
  { id: 'camo', label: 'Camo / animal', prompt: 'a camouflage or animal print garment' }
] as const;

export const STYLES = [
  { id: 'casual', label: 'Casual', prompt: 'casual everyday clothing', formality: 2 },
  { id: 'smart', label: 'Smart casual', prompt: 'smart casual clothing', formality: 3 },
  { id: 'formal', label: 'Formal', prompt: 'formal elegant clothing', formality: 5 },
  { id: 'sporty', label: 'Sporty', prompt: 'sporty athletic clothing', formality: 1 },
  { id: 'cozy', label: 'Cozy', prompt: 'cozy comfortable loungewear', formality: 1 },
  { id: 'street', label: 'Streetwear', prompt: 'streetwear clothing', formality: 2 },
  { id: 'outdoor', label: 'Outdoor', prompt: 'outdoor hiking clothing', formality: 1 },
  { id: 'party', label: 'Party', prompt: 'bold party clothing', formality: 3 }
] as const;

export type PatternId = (typeof PATTERNS)[number]['id'];
export type StyleId = (typeof STYLES)[number]['id'];

export const SLOT_LABELS: Record<Slot, string> = {
  top: 'Top',
  bottom: 'Bottom',
  onepiece: 'One-piece',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
  accessory: 'Accessory'
};

export const WARMTH_LABELS: Record<1 | 2 | 3, string> = { 1: 'Light', 2: 'Medium', 3: 'Warm' };

const categoryIndex = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string): CategoryDef {
  return categoryIndex.get(id) ?? categoryIndex.get('accessory')!;
}

export function isCategoryId(id: unknown): id is string {
  return typeof id === 'string' && categoryIndex.has(id);
}

export function isPatternId(id: unknown): id is PatternId {
  return PATTERNS.some((p) => p.id === id);
}

export function isStyleId(id: unknown): id is StyleId {
  return STYLES.some((s) => s.id === id);
}
