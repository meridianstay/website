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
  room: unsplash('1590490360182-c33d57733427', 800),
  avatar: unsplash('1507003211169-0a1dd7228f2d', 96),
}

/** Extra photos used in property galleries. */
export const galleryImages = {
  spa: unsplash('1540555700478-4be289fbecef', 800),
  livingBright: unsplash('1560448204-e02f11c3d0e2', 800),
  livingCozy: unsplash('1502672260266-1c1ef2d93688', 800),
  bedroomClassic: unsplash('1505693416388-ac5ce068fe85', 800),
  bedroomDark: unsplash('1566665797739-1674de7a421a', 800),
  kitchen: unsplash('1484154218962-a197022b5858', 800),
  apartment: unsplash('1522708323590-d24dbb6b0267', 800),
  mountainDeck: unsplash('1596394516093-501ba68a0ba6', 800),
  forestCabin: unsplash('1587061949409-02df41d5e562', 800),
  poolDusk: unsplash('1551882547-ff40c63fe5fa', 800),
  villaPool: unsplash('1580587771525-78b9dba3b914', 800),
  cliffPool: unsplash('1540541338287-41700207dee6', 800),
  houseboat: unsplash('1593693397690-362cb9666fc2', 800),
  backwaters: unsplash('1602216056096-3b40cc0c9944', 800),
  jaipurPalace: unsplash('1477587458883-47145ed94245', 800),
  jaipurFort: unsplash('1599661046289-e31897846e41', 800),
  tentView: unsplash('1504280390367-361c6d9f38f4', 800),
  beachPool: unsplash('1571003123894-1f0594d2b5d9', 800),
  modernVilla: unsplash('1582268611958-ebfd161ef9cf', 800),
  hotelRoom: unsplash('1618773928121-c32242e63f39', 800),
  brightRoom: unsplash('1631049307264-da0ec9d70304', 800),
  himalaya: unsplash('1544735716-392fe2489ffa', 800),
  gardenCottage: unsplash('1586375300773-8384e3e4916f', 800),
  seasideResort: unsplash('1561501900-3701fa6a0864', 800),
}

export const fallbackImage = 'https://placehold.co/600x400/10b981/ffffff?text=Meridian+Stay'
