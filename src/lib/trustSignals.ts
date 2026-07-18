import { db } from './firebase';
import { 
  query, 
  collection, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  updateDoc 
} from 'firebase/firestore';

interface ResponseStats {
  responseRate: number;
  averageResponseTimeText: string;
}

export async function calculateStoreChatStats(ownerId: string): Promise<ResponseStats> {
  try {
    const chatsQuery = query(collection(db, 'chats'), where('participants', 'array-contains', ownerId));
    const chatsSnap = await getDocs(chatsQuery);
    
    let totalOpportunities = 0;
    let respondedOpportunities = 0;
    const responseTimes: number[] = [];

    for (const chatDoc of chatsSnap.docs) {
      const messagesQuery = query(
        collection(db, 'chats', chatDoc.id, 'messages'),
        orderBy('createdAt', 'asc')
      );
      const messagesSnap = await getDocs(messagesQuery);
      const msgs = messagesSnap.docs.map(d => d.data());

      // Group consecutive customer messages into opportunities
      let insideCustomerBlock = false;
      let customerBlockStartTime: number | null = null;

      for (let i = 0; i < msgs.length; i++) {
        const msg = msgs[i];
        const isCustomer = msg.senderId !== ownerId;
        const msgTime = new Date(msg.createdAt).getTime();

        if (isCustomer) {
          if (!insideCustomerBlock) {
            insideCustomerBlock = true;
            customerBlockStartTime = msgTime;
            totalOpportunities++;
            
            // Look ahead to find the first seller reply
            let replied = false;
            let replyTime = 0;
            for (let j = i + 1; j < msgs.length; j++) {
              const futureMsg = msgs[j];
              if (futureMsg.senderId === ownerId) {
                replied = true;
                replyTime = new Date(futureMsg.createdAt).getTime();
                break;
              }
            }
            
            if (replied) {
              respondedOpportunities++;
              if (customerBlockStartTime) {
                responseTimes.push(replyTime - customerBlockStartTime);
              }
            }
          }
        } else {
          // Seller message resets the block
          insideCustomerBlock = false;
          customerBlockStartTime = null;
        }
      }
    }

    const responseRate = totalOpportunities > 0 
      ? Math.round((respondedOpportunities / totalOpportunities) * 100)
      : 100; // default to 100% if no messages yet

    let averageResponseTimeText = 'Usually replies within a few hours';
    if (responseTimes.length > 0) {
      const avgMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const avgMinutes = avgMs / (1000 * 60);
      if (avgMinutes < 5) {
        averageResponseTimeText = 'Replies instantly';
      } else if (avgMinutes < 60) {
        averageResponseTimeText = `Replies within ${Math.round(avgMinutes)} minutes`;
      } else {
        const avgHours = avgMinutes / 60;
        if (avgHours < 24) {
          averageResponseTimeText = `Replies within ${Math.round(avgHours)} hour${Math.round(avgHours) > 1 ? 's' : ''}`;
        } else {
          averageResponseTimeText = `Replies within ${Math.round(avgHours / 24)} day${Math.round(avgHours / 24) > 1 ? 's' : ''}`;
        }
      }
    }

    return { responseRate, averageResponseTimeText };
  } catch (error) {
    console.error('Error calculating store chat stats:', error);
    return { responseRate: 100, averageResponseTimeText: 'Usually replies within a few hours' };
  }
}

export async function calculateStoreOrderStats(storeId: string) {
  try {
    const ordersQuery = query(collection(db, 'orders'), where('storeId', '==', storeId));
    const ordersSnap = await getDocs(ordersQuery);
    const orders = ordersSnap.docs.map(d => d.data());

    const ordersCount = orders.length;
    const cancelledCount = orders.filter(o => o.status === 'cancelled').length;
    const fulfillmentRate = ordersCount > 0 ? Math.round(((ordersCount - cancelledCount) / ordersCount) * 100) : 100;
    const totalSales = orders.filter(o => o.status !== 'cancelled').length;

    return { fulfillmentRate, totalSales };
  } catch (error) {
    console.error('Error calculating store order stats:', error);
    return { fulfillmentRate: 100, totalSales: 0 };
  }
}

export async function updateStoreTrustSignals(storeId: string, ownerId: string) {
  try {
    const chatStats = await calculateStoreChatStats(ownerId);
    const orderStats = await calculateStoreOrderStats(storeId);

    const storeRef = doc(db, 'stores', storeId);
    await updateDoc(storeRef, {
      responseRate: chatStats.responseRate,
      averageResponseTime: chatStats.averageResponseTimeText,
      fulfillmentRate: orderStats.fulfillmentRate,
      totalSales: orderStats.totalSales
    });
    
    return {
      responseRate: chatStats.responseRate,
      averageResponseTime: chatStats.averageResponseTimeText,
      fulfillmentRate: orderStats.fulfillmentRate,
      totalSales: orderStats.totalSales
    };
  } catch (err) {
    console.error("Error updating store trust signals in Firestore:", err);
    return null;
  }
}
