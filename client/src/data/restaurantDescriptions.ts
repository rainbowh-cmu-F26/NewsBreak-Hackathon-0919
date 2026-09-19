// Descriptions summarize the menu references or fictional demo menu concepts.
const descriptions: Record<string, string> = {
 'Masa Verde': 'Mexican-inspired taco bundles featuring black beans, corn and fresh vegetables.',
 'Piazza Kitchen': 'Italian-inspired pizza bundles featuring Margherita pizza with tomato, milk cheese and basil.',
 'Little Hunan': 'Chinese-inspired noodle dishes featuring vegetable chow fun with mushrooms and egg.',
  'Panda Express': 'American Chinese bowls and plates with a choice of entrées and sides.',
  'Veggie Garden': 'Vegetarian Chinese dishes, including vegetable fried rice, tofu and meat-free entrées.',
  'Urban Curry And Biryani': 'Biryani, curry and rolls, with paneer and chicken options to explore.',
  'Everest Cuisine': 'A menu featuring fried rice and curry dishes, including vegetable fried rice and chicken tikka masala.',
  'Castro Taco Kitchen': 'A taco-focused menu featuring a chicken taco plate.',
  'Shoreline Noodle House': 'Noodle dishes with a vegetable noodle option for a simple meal.',
  'El Camino Pizza': 'Pizza favorites centered on a classic Margherita pizza.',
  'Mountain Sushi Bowl': 'Rice bowls featuring a salmon rice bowl.',
  'Sunny Dumpling House': 'Dumpling-focused dishes, with pork dumplings on the menu.',
  'Bay Thai Kitchen': 'Thai-style noodles featuring tofu pad thai.',
  'Campus Burger Co': 'Burger meals featuring a cheeseburger meal.',
  'Olive Mediterranean': 'Mediterranean-inspired bowls featuring falafel and rice.',
  'Garden Fresh Bowls': 'Plant-based bowl combinations featuring tofu and grains.',
  'Seoul Rice Kitchen': 'Korean-inspired rice bowls featuring chicken bibimbap.',
  'Himalayan Lunch Box': 'Curry and rice combinations featuring chicken curry rice.',
};
export function restaurantDescription(name: string): string {
  return descriptions[name.replace(/\s*\(Demo\)\s*$/i, '').trim()] || 'Explore the featured meal and compare delivery options below.';
}
