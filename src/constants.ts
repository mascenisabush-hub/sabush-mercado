import { Category } from './types';
import { ShoppingBag, Laptop, Sofa, Wine, Car, Settings, Shirt, Sparkles, Hammer, Construction, Smartphone, ShoppingCart, Tractor, Briefcase, Utensils, Activity, BookOpen, Baby, Dumbbell, Wrench, Home, Fish, Cpu, Sun, Heart, Palette, Gift } from 'lucide-react';

export const CATEGORIES: Category[] = [
  // PRODUCT CATEGORIES
  { id: 'electronics', name: 'Electronics', icon: 'Laptop', image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&q=80&w=600', productCount: 120, sellerCount: 15, translationKey: 'categories.electronics', type: 'product' },
  { id: 'furniture', name: 'Furniture', icon: 'Sofa', image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&q=80&w=600', productCount: 45, sellerCount: 8, translationKey: 'categories.furniture', type: 'product' },
  { id: 'home', name: 'Home Necessities', icon: 'ShoppingBag', image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&q=80&w=600', productCount: 200, sellerCount: 30, translationKey: 'categories.home', type: 'product' },
  { id: 'bottle-store', name: 'Bottle Store', icon: 'Wine', image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&q=80&w=600', productCount: 80, sellerCount: 5, translationKey: 'categories.bottle_store', type: 'product' },
  { id: 'car-parts', name: 'Car Spare Parts', icon: 'Car', image: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&q=80&w=600', productCount: 150, sellerCount: 12, translationKey: 'categories.car_parts', type: 'product' },
  { id: 'motor-parts', name: 'Motor Spare Parts', icon: 'Settings', image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&q=80&w=600', productCount: 90, sellerCount: 7, translationKey: 'categories.motor_parts', type: 'product' },
  { id: 'fashion', name: 'Fashion', icon: 'Shirt', image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=600', productCount: 300, sellerCount: 45, translationKey: 'categories.fashion', type: 'product' },
  { id: 'beauty', name: 'Beauty Care', icon: 'Sparkles', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=600', productCount: 180, sellerCount: 20, translationKey: 'categories.beauty', type: 'product' },
  { id: 'hardware', name: 'Hardware & Tools', icon: 'Hammer', image: 'https://images.unsplash.com/photo-1581456495146-65a71b2c8e52?auto=format&fit=crop&q=80&w=600', productCount: 250, sellerCount: 18, translationKey: 'categories.hardware', type: 'product' },
  { id: 'construction', name: 'Construction Materials', icon: 'Construction', image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=600', productCount: 110, sellerCount: 10, translationKey: 'categories.construction', type: 'product' },
  { id: 'phones', name: 'Phones & Accessories', icon: 'Smartphone', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=600', productCount: 400, sellerCount: 50, translationKey: 'categories.phones', type: 'product' },
  { id: 'supermarket', name: 'Supermarket', icon: 'ShoppingCart', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600', productCount: 1000, sellerCount: 10, translationKey: 'categories.supermarket', type: 'product' },
  { id: 'agriculture', name: 'Agriculture & Farming', icon: 'Tractor', image: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&q=80&w=600', productCount: 60, sellerCount: 6, translationKey: 'categories.agriculture', type: 'product' },
  { id: 'office', name: 'Office Supplies', icon: 'Briefcase', image: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?auto=format&fit=crop&q=80&w=600', productCount: 140, sellerCount: 14, translationKey: 'categories.office', type: 'product' },
  { id: 'food-restaurant', name: 'Food & Restaurants', icon: 'Utensils', image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=600', productCount: 160, sellerCount: 22, translationKey: 'categories.food_restaurant', type: 'product' },
  { id: 'pharmacy-health', name: 'Pharmacy & Health', icon: 'Activity', image: 'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?auto=format&fit=crop&q=80&w=600', productCount: 95, sellerCount: 10, translationKey: 'categories.pharmacy_health', type: 'product' },
  { id: 'books-stationery', name: 'Books & Stationery', icon: 'BookOpen', image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=600', productCount: 75, sellerCount: 6, translationKey: 'categories.books_stationery', type: 'product' },
  { id: 'kids-toys', name: 'Kids & Toys', icon: 'Baby', image: 'https://images.unsplash.com/photo-1515488042361-404e9250afef?auto=format&fit=crop&q=80&w=600', productCount: 120, sellerCount: 14, translationKey: 'categories.kids_toys', type: 'product' },
  { id: 'sports-leisure', name: 'Sports & Leisure', icon: 'Dumbbell', image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=600', productCount: 110, sellerCount: 9, translationKey: 'categories.sports_leisure', type: 'product' },
  { id: 'fishing-seafood', name: 'Fishing & Seafood', icon: 'Fish', image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&q=80&w=600', productCount: 40, sellerCount: 12, translationKey: 'categories.fishing_seafood', type: 'product' },
  { id: 'computers-it', name: 'Computers & IT Hardware', icon: 'Cpu', image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=600', productCount: 210, sellerCount: 19, translationKey: 'categories.computers_it', type: 'product' },
  { id: 'solar-energy', name: 'Solar Energy & Backup', icon: 'Sun', image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&q=80&w=600', productCount: 85, sellerCount: 11, translationKey: 'categories.solar_energy', type: 'product' },
  { id: 'pet-shop', name: 'Pet Shop & Animals', icon: 'Heart', image: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=600', productCount: 45, sellerCount: 4, translationKey: 'categories.pet_shop', type: 'product' },
  { id: 'handicrafts-art', name: 'Handicrafts & Art', icon: 'Palette', image: 'https://images.unsplash.com/photo-1456086272160-b28b0645b729?auto=format&fit=crop&q=80&w=600', productCount: 90, sellerCount: 15, translationKey: 'categories.handicrafts_art', type: 'product' },
  { id: 'events-party', name: 'Events & Decoration', icon: 'Gift', image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=600', productCount: 115, sellerCount: 13, translationKey: 'categories.events_party', type: 'product' },
  
  // SERVICE CATEGORIES
  { id: 'services-freelance', name: 'Freelance & General Services', icon: 'Wrench', image: 'https://images.unsplash.com/photo-1521791136368-1a46827d008b?auto=format&fit=crop&q=80&w=600', productCount: 130, sellerCount: 25, translationKey: 'categories.services_freelance', type: 'service' },
  { id: 'real-estate', name: 'Real Estate & Rentals', icon: 'Home', image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=600', productCount: 50, sellerCount: 8, translationKey: 'categories.real_estate', type: 'service' },
  { id: 'business-consulting', name: 'Business Consulting & Finance', icon: 'Briefcase', image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=600', productCount: 80, sellerCount: 12, translationKey: 'categories.business_consulting', type: 'service' },
  { id: 'digital-marketing', name: 'Digital Marketing & Web Design', icon: 'Palette', image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=600', productCount: 95, sellerCount: 14, translationKey: 'categories.digital_marketing', type: 'service' },
  { id: 'tech-it-services', name: 'IT Support & Software Dev', icon: 'Cpu', image: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?auto=format&fit=crop&q=80&w=600', productCount: 110, sellerCount: 16, translationKey: 'categories.tech_it_services', type: 'service' },
  { id: 'construction-repairs', name: 'Construction, Electrical & Plumbing', icon: 'Hammer', image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=600', productCount: 140, sellerCount: 22, translationKey: 'categories.construction_repairs', type: 'service' },
  { id: 'education-training', name: 'Education & Tutoring', icon: 'BookOpen', image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=600', productCount: 65, sellerCount: 8, translationKey: 'categories.education_training', type: 'service' },
  { id: 'cleaning-laundry', name: 'Cleaning & Laundry Services', icon: 'Sparkles', image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=600', productCount: 70, sellerCount: 10, translationKey: 'categories.cleaning_laundry', type: 'service' },
  { id: 'transport-logistics', name: 'Transport, Taxi & Logistics Courier', icon: 'Car', image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=600', productCount: 120, sellerCount: 18, translationKey: 'categories.transport_logistics', type: 'service' },
  { id: 'beauty-wellness-serv', name: 'Beauty Spa & Wellness Services', icon: 'Heart', image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=600', productCount: 85, sellerCount: 11, translationKey: 'categories.beauty_wellness_serv', type: 'service' }
];

export const CATEGORY_ICONS: Record<string, any> = {
  Laptop, Sofa, ShoppingBag, Wine, Car, Settings, Shirt, Sparkles, Hammer, Construction, Smartphone, ShoppingCart, Tractor, Briefcase, Utensils, Activity, BookOpen, Baby, Dumbbell, Wrench, Home, Fish, Cpu, Sun, Heart, Palette, Gift
};

export const PROVINCES = [
  'Maputo Cidade', 'Maputo Província', 'Gaza', 'Inhambane', 'Sofala', 
  'Manica', 'Tete', 'Zambézia', 'Nampula', 'Cabo Delgado', 'Niassa'
];

export const COUNTRIES = [
  { code: 'MZ', name: 'Mozambique', currency: 'MZN', symbol: 'MT', flag: '🇲🇿' }
];

export const VAT_RATE = 0.17; // Mozambican IVA
export const PHONE_PREFIX = '+258';
