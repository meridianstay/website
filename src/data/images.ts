const unsplash = (id: string, width: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=${width}`

export const images = {
  hero: unsplash('1512917774080-9991f1c4c750', 1920),
  farmstay: unsplash('1500382017468-9049fed747ef', 800),
  resort: unsplash('1582719508461-905c673771fd', 800),
  cottage: unsplash('1448375240586-882707db888b', 800),
  villa: unsplash('1613490493576-7fde63acd811', 800),
  citrusFarm: unsplash('1564013799919-ab600027ffc6', 800),
  treehouse: unsplash('1611892440504-42a792e24d32', 800),
  hostBanner: unsplash('1571896349842-33c89424de2d', 900),
  avatar: unsplash('1507003211169-0a1dd7228f2d', 96),
}

export const fallbackImage = 'https://placehold.co/600x400/10b981/ffffff?text=Meridian+Stay'
