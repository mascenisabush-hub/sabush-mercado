export type UserRole = 'customer' | 'seller' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  isBanned?: boolean;
  phoneNumber?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  preferredLanguage?: string;
  country?: string;
  currency?: string;
  createdAt: string;
}

export type StoreStatus = 'pending' | 'active' | 'suspended';
export type DeliveryOptions = 'pickup' | 'delivery' | 'both';

export interface Store {
  id: string;
  ownerId: string;
  businessName: string;
  category: string;
  offeringType?: 'products' | 'services' | 'both';
  description?: string;
  logo?: string;
  banner?: string;
  location: string;
  country: string;
  currency: string;
  latitude?: number;
  longitude?: number;
  whatsappNumber: string;
  deliveryOptions: DeliveryOptions;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  status: StoreStatus;
  createdAt: string;
  hashedPassword?: string;
  responseRate?: number;
  fulfillmentRate?: number;
  averageResponseTime?: string;
  isVerifiedBusiness?: boolean;
  totalSales?: number;
  translations?: {
    [lang: string]: {
      description: string;
    };
  };
}

export interface WholesaleTier {
  minQuantity: number;
  price: number;
}

export interface Product {
  id: string;
  storeId: string;
  sellerId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  country: string;
  currency: string;
  images: string[];
  stock: number;
  purchasingPrice?: number;
  unitCxStock?: number;
  unitEmbStock?: number;
  unitUnStock?: number;
  minOrderQuantity: number;
  wholesalePrices?: WholesaleTier[];
  deliveryAvailable: boolean;
  rating: number;
  reviewCount: number;
  status: 'active' | 'hidden' | 'out_of_stock';
  createdAt: string;
  colors?: string[];
  sizes?: string[];
  specs?: { name: string; value: string }[];
  translations?: {
    [lang: string]: {
      name: string;
      description: string;
    };
  };
  priceHistory?: { price: number; currency: string; timestamp: string }[];
  views?: number;
}

export interface RFQ {
  id: string;
  customerId: string;
  storeId: string;
  productId?: string;
  productName: string;
  quantity: number;
  description: string;
  status: 'pending' | 'responded' | 'closed';
  createdAt: string;
  response?: {
    price: number;
    notes: string;
    respondedAt: string;
  };
}

export interface Favorite {
  id: string;
  userId: string;
  productId: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  image?: string;
  productCount: number;
  sellerCount: number;
  translationKey?: string;
  type?: 'product' | 'service';
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  selectedColor?: string;
  selectedSize?: string;
}

export interface Order {
  id: string;
  customerId: string;
  storeId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: 'mpesa' | 'emola' | 'card' | 'cod' | 'bank';
  paymentStatus: 'pending' | 'paid' | 'failed';
  deliveryMethod: 'pickup' | 'delivery';
  deliveryAddress?: string;
  whatsappContacted: boolean;
  country: string;
  currency: string;
  createdAt: string;
  isGuest?: boolean;
  guestName?: string | null;
  guestEmail?: string | null;
  guestPhone?: string;
  guestWhatsapp?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  trackingStatus?: string;
  trackingHistory?: { stage: string; timestamp: string }[];
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: string;
  orderId?: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'order' | 'chat' | 'mpesa' | 'emola' | 'bank' | 'price_drop' | 'withdrawal_approved' | 'withdrawal_rejected' | 'earning_received';
  read: boolean;
  createdAt: string;
  productId?: string;
  oldPrice?: number;
  newPrice?: number;
  percentSaved?: number;
}

export type ReportTargetType = 'user' | 'store' | 'product';
export type ReportStatus = 'pending' | 'resolved' | 'ignored';

export interface UserReport {
  id: string;
  reporterId: string;
  targetId: string;
  targetType: ReportTargetType;
  reason: string;
  details?: string;
  status: ReportStatus;
  createdAt: string;
}

export interface ProductQA {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  question: string;
  createdAt: string;
  answer?: string;
  answeredAt?: string;
  storeId?: string;
}

export interface SavedAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  province: string;
  city: string;
  street: string;
  isDefault: boolean;
}

export interface AnalyticsData {
  totalRevenue: number;
  revenueByCurrency: { MZN: number; USD: number; ZAR: number };
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalProductViews: number;
  topViewedProducts: { productId: string; name: string; views: number }[];
  topSellingProducts: { productId: string; name: string; unitsSold: number }[];
  revenueByProvince: { province: string; revenue: number }[];
  revenueByDay: { date: string; revenue: number }[];
  conversionRate: number;
}

export interface Promotion {
  id: string;
  sellerId: string;
  type: 'discount' | 'flash_sale' | 'bundle' | 'coupon';
  label: string;
  discountPercentage: number;
  applicableProductIds: string[];
  startDate: string;
  endDate: string;
  isActive: boolean;
  usageLimit: number | null;
  usageCount: number;
}

export interface Coupon {
  code: string;
  promotionId: string;
  discountPercentage: number;
  expiryDate: string;
  isActive: boolean;
  usageLimit: number | null;
  usageCount: number;
}

export interface PayoutSummary {
  sellerId: string;
  totalEarned: number;
  totalPending: number;
  totalWithdrawn: number;
  availableBalance: number;
  currency: 'MZN' | 'USD' | 'ZAR';
  lastUpdated: string;
}

export interface PayoutTransaction {
  id: string;
  sellerId: string;
  type: 'earning' | 'withdrawal' | 'refund' | 'commission_deduction';
  amount: number;
  currency: 'MZN' | 'USD' | 'ZAR';
  status: 'pending' | 'completed' | 'failed';
  orderId: string | null;
  description: string;
  timestamp: string;
}

export interface WithdrawalRequest {
  id: string;
  sellerId: string;
  amount: number;
  currency: 'MZN' | 'USD' | 'ZAR';
  paymentMethod: 'mpesa' | 'bank_transfer' | 'emola';
  accountDetails: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  resolvedAt: string | null;
  adminNote: string | null;
}



