# One-time demonstration restaurant menu

| Category | Item | Demo price |
|---|---|---:|
| Appetizers | Lumpiang Shanghai | ₱180.00 |
| Appetizers | Chicken Wings | ₱220.00 |
| Main Dishes | Chicken Adobo | ₱240.00 |
| Main Dishes | Pork Sinigang | ₱290.00 |
| Noodles | Pancit Canton | ₱200.00 |
| Noodles | Pancit Bihon | ₱180.00 |
| Seafood | Grilled Bangus | ₱320.00 |
| Seafood | Garlic Butter Shrimp | ₱390.00 |
| Desserts | Leche Flan | ₱120.00 |
| Desserts | Mango Float | ₱140.00 |
| Beverages | Mango Shake | ₱130.00 |
| Beverages | Calamansi Juice | ₱95.00 |
| Breakfast | Tapsilog | ₱220.00 |
| Breakfast | Longsilog | ₱190.00 |

These are illustrative sample prices, not actual resort prices. The existing category IDs are used, no new category directory is created. The data is inserted only on first menu use when the menu-item directory has no saved items and no initialization marker. A populated legacy directory remains untouched. The marker also prevents repopulation if all items are intentionally removed.

The initialization transaction and validation are tested in `tests/demo-menu-seeding.test.mjs`.
