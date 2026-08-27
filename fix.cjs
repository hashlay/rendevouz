const fs = require('fs');
const file = 'server/routes.ts';
let content = fs.readFileSync(file, 'utf8');
const search = "  res.json({ message: 'Category created successfully', category: newCategory });\n});";
const insert = `\n\napiRouter.post('/categories/reorder', authenticate, requireRole([UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM]), async (req, res) => {
  const { categoryIds } = req.body;
  if (!Array.isArray(categoryIds)) return res.status(400).json({ error: 'categoryIds array is required' });
  const db = dbClient.get();
  const newOrder = [];
  for (const id of categoryIds) {
    const cat = db.categories.find(c => c.id === id);
    if (cat) newOrder.push(cat);
  }
  for (const cat of db.categories) {
    if (!categoryIds.includes(cat.id)) newOrder.push(cat);
  }
  db.categories = newOrder;
  await dbClient.save();
  res.json({ message: 'Categories reordered successfully' });
});`;
if(content.includes('categories/reorder')) { console.log('Already added'); process.exit(0); }
content = content.replace(search, search + insert);
fs.writeFileSync(file, content);
console.log('Inserted reorder route');
