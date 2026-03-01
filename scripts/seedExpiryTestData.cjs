const fs = require('fs');
const path = require('path');

// Generates a small set of inventory items covering expiry scenarios for manual testing.
const today = new Date();
function iso(daysOffset = 0) {
  const d = new Date(today.getTime());
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

const seed = [
  // Immortal shelf-stable
  {
    id: 'seed-immortal-1',
    item: 'Salt',
    category: 'baking supplies',
    quantity_estimate: '1',
    storageLocation: 'pantry',
    is_immortal: true
  },
  // Expiring soon (milk)
  {
    id: 'seed-milk-1',
    item: 'Whole Milk',
    category: 'Dairy',
    quantity_estimate: '1',
    storageLocation: 'fridge',
    expirationDate: iso(2)
  },
  // Expires today
  {
    id: 'seed-bread-1',
    item: 'Sandwich Bread',
    category: 'bakery',
    quantity_estimate: '1',
    storageLocation: 'pantry',
    expirationDate: iso(0)
  },
  // Already expired
  {
    id: 'seed-cheese-1',
    item: 'Soft Cheese',
    category: 'Dairy',
    quantity_estimate: '1',
    storageLocation: 'fridge',
    expirationDate: iso(-3)
  },
  // Leftover with computedBestBefore (cooked rice should cap at 4 days)
  {
    id: 'seed-leftover-rice-1',
    item: 'Leftover Fried Rice',
    category: 'leftover',
    quantity_estimate: '2',
    storageLocation: 'fridge',
    is_leftover: true,
    leftoverMeta: {
      createdAt: new Date().toISOString(),
      computedBestBefore: iso(4),
      notes: 'Cooked rice leftover'
    }
  }
];

const outDir = path.join(__dirname, 'test-data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'expirySeed.json');
fs.writeFileSync(outPath, JSON.stringify(seed, null, 2), 'utf8');
console.log('Wrote seed file to', outPath);
