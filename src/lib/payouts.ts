import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { PayoutSummary, PayoutTransaction, Order, Store } from '../types';
import { handleFirestoreError, OperationType } from './firebaseErrors';

/**
 * Calculates commission rate for a store based on its profile or subscription plan
 */
export const getCommissionRate = (store: Store | any): number => {
  if (store.commissionRate !== undefined && store.commissionRate !== null) {
    return Number(store.commissionRate);
  }
  
  if (store.subscriptionPlan) {
    const plan = String(store.subscriptionPlan).toLowerCase();
    if (plan === 'premium') return 5; // 5% commission
    if (plan === 'gold') return 7.5;  // 7.5% commission
    if (plan === 'enterprise') return 3; // 3% commission
  }
  
  return 10; // Default 10% commission
};

/**
 * Formats values to currency for presentation
 */
export const formatCurrency = (amount: number, currency: string = 'MZN'): string => {
  return new Intl.NumberFormat('pt-MZ', {
     style: 'currency',
     currency: currency,
     minimumFractionDigits: 2
  }).format(amount);
};

/**
 * Handles executing payout updates when an order is confirmed.
 * Can be run safely on any client triggering confirmation.
 */
export async function handleOrderPayout(orderId: string) {
  try {
    // 1. Fetch Order details
    const orderDocRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderDocRef);
    if (!orderSnap.exists()) {
      console.warn(`Payout: Order ${orderId} does not exist.`);
      return;
    }
    
    const order = { id: orderSnap.id, ...orderSnap.data() } as Order;
    
    // 2. Fetch Store details to get seller and commission structure
    const storeDocRef = doc(db, 'stores', order.storeId);
    const storeSnap = await getDoc(storeDocRef);
    if (!storeSnap.exists()) {
      console.warn(`Payout: Store ${order.storeId} does not exist for order ${orderId}.`);
      return;
    }
    
    const store = { id: storeSnap.id, ...storeSnap.data() } as Store;
    const sellerId = store.ownerId;
    const currency = (order.currency || store.currency || 'MZN') as 'MZN' | 'USD' | 'ZAR';
    
    // 3. Double-check to avoid duplicate execution for this order
    const earningTxId = `earn_${order.id}`;
    const earningTxRef = doc(db, 'payouts', sellerId, 'transactions', earningTxId);
    const earningTxSnap = await getDoc(earningTxRef);
    
    if (earningTxSnap.exists()) {
      console.log(`Payout: Already processed for order ${orderId}`);
      return;
    }
    
    // 4. Calculate commission and earnings
    const commissionRate = getCommissionRate(store);
    const grossAmount = order.totalAmount;
    const commissionDeduction = grossAmount * (commissionRate / 100);
    const netEarnings = grossAmount - commissionDeduction;
    
    const batch = writeBatch(db);
    const timestamp = new Date().toISOString();
    
    // 5. Create Earning Transaction
    const earningTx: PayoutTransaction = {
      id: earningTxId,
      sellerId,
      type: 'earning',
      amount: grossAmount,
      currency,
      status: 'completed',
      orderId: order.id,
      description: `Ganhos do Pedido #${order.id.substring(0, 8)}`,
      timestamp
    };
    batch.set(earningTxRef, earningTx);
    
    // 6. Create Commission Deduction Transaction (if there is commission to deduct)
    if (commissionDeduction > 0) {
      const deductionTxId = `comm_${order.id}`;
      const deductionTxRef = doc(db, 'payouts', sellerId, 'transactions', deductionTxId);
      const deductionTx: PayoutTransaction = {
        id: deductionTxId,
        sellerId,
        type: 'commission_deduction',
        amount: commissionDeduction,
        currency,
        status: 'completed',
        orderId: order.id,
        description: `Comissão da Plataforma (${commissionRate}%) do Pedido #${order.id.substring(0, 8)}`,
        timestamp
      };
      batch.set(deductionTxRef, deductionTx);
    }
    
    // 7. Update/Create PayoutSummary
    const summaryRef = doc(db, 'payouts', sellerId);
    const summarySnap = await getDoc(summaryRef);
    
    if (summarySnap.exists()) {
      const summary = summarySnap.data() as PayoutSummary;
      batch.update(summaryRef, {
        totalEarned: (summary.totalEarned || 0) + netEarnings,
        availableBalance: (summary.availableBalance || 0) + netEarnings,
        lastUpdated: timestamp
      });
    } else {
      const summary: PayoutSummary = {
        sellerId,
        totalEarned: netEarnings,
        totalPending: 0,
        totalWithdrawn: 0,
        availableBalance: netEarnings,
        currency,
        lastUpdated: timestamp
      };
      batch.set(summaryRef, summary);
    }
    
    // 8. Create Notification for the Seller
    const notificationRef = doc(collection(db, 'notifications'));
    batch.set(notificationRef, {
      userId: sellerId,
      title: 'Novos Ganhos Disponíveis!',
      message: `Você recebeu ${formatCurrency(netEarnings, currency)} de ganhos líquidos (após deduções) pelo Pedido de compra #${order.id.substring(0, 8)}.`,
      type: 'earning_received',
      read: false,
      createdAt: timestamp
    });
    
    // Commit the batch atomic updates
    await batch.commit();
    console.log(`Payout: Successfully processed payout for order ${orderId} (Net: ${netEarnings} ${currency})`);
    
  } catch (err) {
    console.error('Payout Execution Failed:', err);
    handleFirestoreError(err, OperationType.WRITE, `payouts/order_${orderId}`);
  }
}
