// Illustrative photography: these are not photos of the named restaurants or exact dishes.
const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=85`;
const photos = {
  bowl: photo('photo-1546069901-ba9599a7e63c'),
  pizza: photo('photo-1513104890138-7c749659a591'),
  burger: photo('photo-1568901346375-23c9450c58cd'),
  sushi: photo('photo-1579871494447-9811cf80d66c'),
  noodles: photo('photo-1569718212165-3a8278d5f624'),
  tacos: photo('photo-1551504734-5ee1c4a1479b'),
  curry: photo('photo-1603894584373-5ac82b2ae398'),
};
const restaurantPhotos: Record<string, string> = {
 'Masa Verde': photo('photo-1565299585323-38d6b0865b47'),
 'Piazza Kitchen': photo('photo-1565299624946-b28f40a0ae38'),
 'Little Hunan': photo('photo-1585032226651-759b368d7246'),
 'Panda Express': photos.bowl,
 'Veggie Garden': photo('photo-1512621776951-a57141f2eefd'),
 'Urban Curry And Biryani': photos.curry,
 'Everest Cuisine': photo('photo-1512058564366-18510be2db19'),
 'Castro Taco Kitchen': photos.tacos,
 'Shoreline Noodle House': photos.noodles,
 'El Camino Pizza': photos.pizza,
 'Mountain Sushi Bowl': photos.sushi,
 'Sunny Dumpling House': photo('photo-1563245372-f21724e3856d'),
 'Bay Thai Kitchen': photo('photo-1559314809-0d155014e29e'),
 'Campus Burger Co': photos.burger,
 'Olive Mediterranean': photo('photo-1498837167922-ddd27525d352'),
 'Garden Fresh Bowls': photo('photo-1547592180-85f173990554'),
 'Seoul Rice Kitchen': photo('photo-1590301157890-4810ed352733'),
 'Himalayan Lunch Box': photo('photo-1585937421612-70a008356fbe'),
};
export function foodPhoto(item: string, restaurant = ''): string {
 const name = restaurant.replace(/\s*\(Demo\)\s*$/i, '').trim();
 if (restaurantPhotos[name]) return restaurantPhotos[name];
 const text = item.toLowerCase();
 if (/pizza/.test(text)) return photos.pizza;
 if (/burger/.test(text)) return photos.burger;
 if (/salmon|sushi/.test(text)) return photos.sushi;
 if (/noodle|pad thai|dumpling/.test(text)) return photos.noodles;
 if (/taco/.test(text)) return photos.tacos;
 if (/curry|paneer|biryani/.test(text)) return photos.curry;
 return photos.bowl;
}
