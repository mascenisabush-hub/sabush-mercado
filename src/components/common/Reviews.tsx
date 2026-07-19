import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, setDoc, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { Star, User, Send, StarHalf, MessageCircle, Clock, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { Skeleton } from './Skeleton';
import { cn } from '../../lib/utils';
import { handleFirestoreError, OperationType } from '../../lib/firebaseErrors';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';

interface Review {
  id: string;
  productId?: string;
  storeId?: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  rating: number;
  comment: string;
  createdAt: any;
}

interface ProductReviewsProps {
  productId: string;
}

export function ProductReviews({ productId }: ProductReviewsProps) {
  const { t } = useTranslation();
  const { language: currentLang } = useLanguage();
  const { user, profile } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'reviews'),
      where('productId', '==', productId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReviews(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Review[]);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'reviews'));

    return () => unsubscribe();
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newReview.comment.trim()) return;

    setSubmitting(true);
    try {
      const reviewId = `${productId}_${user.uid}`;
      await setDoc(doc(db, 'reviews', reviewId), {
        productId,
        userId: user.uid,
        userName: profile?.displayName || user.displayName || 'Anonymous',
        userPhoto: user.photoURL || '',
        rating: newReview.rating,
        comment: newReview.comment,
        createdAt: new Date().toISOString()
      });

      // Recalculate average rating & counts for product and update in Firestore
      const reviewsSnapshot = await getDocs(
        query(collection(db, 'reviews'), where('productId', '==', productId))
      );
      const allReviews = reviewsSnapshot.docs.map(d => d.data());
      const reviewCount = allReviews.length;
      const totalRating = allReviews.reduce((sum, r) => sum + (r.rating || 0), 0);
      const averageRating = reviewCount > 0 ? Number((totalRating / reviewCount).toFixed(1)) : 0;

      await updateDoc(doc(db, 'products', productId), {
        rating: averageRating,
        reviewCount: reviewCount
      });

      setNewReview({ rating: 5, comment: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `reviews/${productId}_${user.uid}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 animate-pulse rounded-lg" />
        {[1, 2].map(i => (
          <div key={i} className="flex gap-4">
            <Skeleton className="w-12 h-12 rounded-full animate-pulse" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32 animate-pulse rounded-lg" />
              <Skeleton className="h-4 w-full animate-pulse rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const averageRating = reviews.length > 0 
    ? reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length 
    : 0;

  const dateLocale = currentLang === 'pt' ? ptBR : enUS;

  return (
    <div className="space-y-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
           <h3 className="text-2xl font-black text-gray-900 italic tracking-tight mb-2">
             {currentLang === 'pt' ? 'Avaliações de Clientes' : t('reviews.title', 'Customer Reviews')}
           </h3>
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-orange-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={cn("w-5 h-5", averageRating >= s ? "fill-orange-400 text-orange-400" : "text-gray-200")} />
                  ))}
              </div>
              <p className="font-bold text-gray-900">
                {averageRating.toFixed(1)}{' '}
                <span className="text-gray-400 font-medium">
                  ({reviews.length} {currentLang === 'pt' ? 'avaliações' : 'reviews'})
                </span>
              </p>
           </div>
        </div>

        {user && !reviews.find(r => r.userId === user.uid) && (
           <div className="flex items-center gap-2 text-xs font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-full uppercase tracking-widest">
              <CheckCircle className="w-4 h-4" /> {currentLang === 'pt' ? 'Pode adicionar avaliação' : t('reviews.you_can_review', 'You can add a review')}
           </div>
        )}
      </div>

      {user && !reviews.find(r => r.userId === user.uid) && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-6 sm:p-8 rounded-[40px] border border-gray-100 shadow-inner">
           <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 ml-4">
             {currentLang === 'pt' ? 'Partilhe a sua experiência' : t('reviews.share_exp', 'Share your experience')}
           </p>
           <div className="flex gap-2 mb-6 ml-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <button 
                  key={s}
                  type="button"
                  onClick={() => setNewReview({ ...newReview, rating: s })}
                  className="hover:scale-115 active:scale-95 transition-transform cursor-pointer"
                >
                  <Star className={cn("w-8 h-8 transition-colors", newReview.rating >= s ? "text-orange-400 fill-orange-400" : "text-gray-300")} />
                </button>
              ))}
           </div>
           
           <div className="relative">
              <textarea 
                className="w-full px-8 py-6 bg-white border-none rounded-[32px] focus:ring-4 focus:ring-blue-100 outline-none text-sm font-medium resize-none min-h-[120px] shadow-sm transition-all text-gray-800"
                placeholder={currentLang === 'pt' ? 'O que achou deste produto? Escreva o seu comentário...' : t('reviews.placeholder', 'What did you think of this product?')}
                value={newReview.comment}
                onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
              />
              <button 
                type="submit"
                disabled={submitting || !newReview.comment.trim()}
                className="absolute bottom-4 right-4 p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg hover:shadow-blue-200 disabled:opacity-50 cursor-pointer flex items-center justify-center min-w-[52px]"
              >
                {submitting ? <Clock className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
           </div>
        </form>
      )}

      <div className="space-y-8">
        {reviews.map((review) => (
          <div key={review.id} className="flex gap-6 group hover:bg-gray-50/50 p-2 -m-2 rounded-2xl transition-all">
            <div className="shrink-0 animate-fade-in">
               <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 border border-gray-50 group-hover:shadow-md transition-all">
                  {review.userPhoto ? (
                    <img src={review.userPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-600 font-extrabold text-lg">
                       {review.userName?.[0]?.toUpperCase() || <User className="w-5 h-5" />}
                    </div>
                  )}
               </div>
            </div>
            <div className="flex-1 space-y-2">
               <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900 leading-none">{review.userName}</h4>
                    <div className="flex items-center gap-1 mt-1 text-orange-400">
                       {[1, 2, 3, 4, 5].map((s) => (
                         <Star key={s} className={cn("w-3 h-3", review.rating >= s ? "fill-orange-400 text-orange-400" : "text-gray-200")} />
                       ))}
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {review.createdAt ? formatDistanceToNow(new Date(review.createdAt), { locale: dateLocale, addSuffix: true }) : (currentLang === 'pt' ? 'Agora mesmo' : t('reviews.just_now', 'Just now'))}
                  </p>
               </div>
               <p className="text-gray-600 text-sm leading-relaxed font-semibold">{review.comment}</p>
            </div>
          </div>
        ))}

        {reviews.length === 0 && (
          <div className="text-center py-20 bg-gray-50 rounded-[40px] border border-dashed border-gray-200 animate-fade-in">
             <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
             <p className="font-bold text-gray-400 italic">
               {currentLang === 'pt' ? 'Seja o primeiro a avaliar este produto!' : t('reviews.be_first', 'Be the first to review this product!')}
             </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface StoreReviewsProps {
  storeId: string;
}

export function StoreReviews({ storeId }: StoreReviewsProps) {
  const { t } = useTranslation();
  const { language: currentLang } = useLanguage();
  const { user, profile } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'reviews'),
      where('storeId', '==', storeId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReviews(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Review[]);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'reviews'));

    return () => unsubscribe();
  }, [storeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newReview.comment.trim()) return;

    setSubmitting(true);
    try {
      const reviewId = `${storeId}_${user.uid}`;
      await setDoc(doc(db, 'reviews', reviewId), {
        storeId,
        userId: user.uid,
        userName: profile?.displayName || user.displayName || 'Anonymous',
        userPhoto: user.photoURL || '',
        rating: newReview.rating,
        comment: newReview.comment,
        createdAt: new Date().toISOString()
      });

      // Recalculate average rating & counts for store and update in Firestore
      const reviewsSnapshot = await getDocs(
        query(collection(db, 'reviews'), where('storeId', '==', storeId))
      );
      const allReviews = reviewsSnapshot.docs.map(d => d.data());
      const reviewCount = allReviews.length;
      const totalRating = allReviews.reduce((sum, r) => sum + (r.rating || 0), 0);
      const averageRating = reviewCount > 0 ? Number((totalRating / reviewCount).toFixed(1)) : 0;

      await updateDoc(doc(db, 'stores', storeId), {
        rating: averageRating,
        reviewCount: reviewCount
      });

      setNewReview({ rating: 5, comment: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `reviews/${storeId}_${user.uid}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 animate-pulse rounded-lg" />
        {[1, 2].map(i => (
          <div key={i} className="flex gap-4">
            <Skeleton className="w-12 h-12 rounded-full animate-pulse" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32 animate-pulse rounded-lg" />
              <Skeleton className="h-4 w-full animate-pulse rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const averageRating = reviews.length > 0 
    ? reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length 
    : 0;

  const dateLocale = currentLang === 'pt' ? ptBR : enUS;

  return (
    <div className="space-y-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
           <h3 className="text-2xl font-black text-gray-900 italic tracking-tight mb-2">
             {currentLang === 'pt' ? 'Opiniões e Feedback da Loja' : 'Store Reviews & Feedback'}
           </h3>
           <p className="text-xs text-gray-500 font-medium tracking-tight -mt-1 mb-3">
             {currentLang === 'pt' ? 'O que os clientes dizem sobre este fornecedor.' : 'What verified customers say about this supplier.'}
           </p>
           <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-orange-400">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={cn("w-5 h-5", averageRating >= s ? "fill-orange-400 text-orange-400" : "text-gray-200")} />
                  ))}
              </div>
              <p className="font-bold text-gray-900">
                {averageRating.toFixed(1)}{' '}
                <span className="text-gray-400 font-medium">
                  ({reviews.length} {currentLang === 'pt' ? 'avaliações' : 'reviews'})
                </span>
              </p>
           </div>
        </div>

        {user && !reviews.find(r => r.userId === user.uid) && (
           <div className="flex items-center gap-2 text-xs font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-full uppercase tracking-widest">
              <CheckCircle className="w-4 h-4" /> {currentLang === 'pt' ? 'Pode avaliar esta loja' : 'You can review this store'}
           </div>
        )}
      </div>

      {user && !reviews.find(r => r.userId === user.uid) && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-6 sm:p-8 rounded-[40px] border border-gray-100 shadow-inner">
           <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 ml-4">
             {currentLang === 'pt' ? 'Como foi a sua experiência com esta loja?' : 'How was your experience with this store?'}
           </p>
           <div className="flex gap-2 mb-6 ml-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <button 
                  key={s}
                  type="button"
                  onClick={() => setNewReview({ ...newReview, rating: s })}
                  className="hover:scale-115 active:scale-95 transition-transform cursor-pointer"
                >
                  <Star className={cn("w-8 h-8 transition-colors", newReview.rating >= s ? "text-orange-400 fill-orange-400" : "text-gray-300")} />
                </button>
              ))}
           </div>
           
           <div className="relative">
              <textarea 
                className="w-full px-8 py-6 bg-white border-none rounded-[32px] focus:ring-4 focus:ring-blue-100 outline-none text-sm font-medium resize-none min-h-[120px] shadow-sm transition-all text-gray-800"
                placeholder={currentLang === 'pt' ? 'Ecreva a sua opinião sobre o atendimento, entrega, qualidade e compromisso...' : 'What did you think of this shop? State feedback, responsiveness, shipping reliability...'}
                value={newReview.comment}
                onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
              />
              <button 
                type="submit"
                disabled={submitting || !newReview.comment.trim()}
                className="absolute bottom-4 right-4 p-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg hover:shadow-blue-200 disabled:opacity-50 cursor-pointer flex items-center justify-center min-w-[52px]"
              >
                {submitting ? <Clock className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
           </div>
        </form>
      )}

      <div className="space-y-8">
        {reviews.map((review) => (
          <div key={review.id} className="flex gap-6 group hover:bg-gray-50/50 p-2 -m-2 rounded-2xl transition-all">
            <div className="shrink-0 animate-fade-in">
               <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 border border-gray-50 group-hover:shadow-md transition-all">
                  {review.userPhoto ? (
                    <img src={review.userPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-600 font-extrabold text-lg">
                       {review.userName?.[0]?.toUpperCase() || <User className="w-5 h-5" />}
                    </div>
                  )}
               </div>
            </div>
            <div className="flex-1 space-y-2">
               <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900 leading-none">{review.userName}</h4>
                    <div className="flex items-center gap-1 mt-1 text-orange-400">
                       {[1, 2, 3, 4, 5].map((s) => (
                         <Star key={s} className={cn("w-3 h-3", review.rating >= s ? "fill-orange-400 text-orange-400" : "text-gray-200")} />
                       ))}
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {review.createdAt ? formatDistanceToNow(new Date(review.createdAt), { locale: dateLocale, addSuffix: true }) : (currentLang === 'pt' ? 'Agora mesmo' : 'Just now')}
                  </p>
               </div>
               <p className="text-gray-600 text-sm leading-relaxed font-semibold">{review.comment}</p>
            </div>
          </div>
        ))}

        {reviews.length === 0 && (
          <div className="text-center py-20 bg-gray-50 rounded-[40px] border border-dashed border-gray-200 animate-fade-in">
             <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
             <p className="font-bold text-gray-400 italic">
               {currentLang === 'pt' ? 'Seja o primeiro a avaliar este fornecedor!' : 'Be the first to review this seller!'}
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
