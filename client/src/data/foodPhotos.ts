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
export function foodPhoto(item: string): string {
 const text = item.toLowerCase();
 if (/pizza/.test(text)) return photos.pizza;
 if (/burger/.test(text)) return photos.burger;
 if (/salmon|sushi/.test(text)) return photos.sushi;
 if (/noodle|pad thai|dumpling/.test(text)) return photos.noodles;
 if (/taco/.test(text)) return photos.tacos;
 if (/curry|paneer|biryani/.test(text)) return photos.curry;
 return photos.bowl;
}
