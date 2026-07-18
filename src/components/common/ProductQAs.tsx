import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, HelpCircle, Send, Clock, CheckCircle, Store, Reply } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from './Skeleton';
import { cn } from '../../lib/utils';
import { handleFirestoreError, OperationType } from '../../lib/firebaseErrors';
import { useTranslation } from 'react-i18next';

interface ProductQA {
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

interface ProductQAsProps {
  productId: string;
  storeId: string;
  storeName: string;
}

export function ProductQAs({ productId, storeId, storeName }: ProductQAsProps) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [qas, setQas] = useState<ProductQA[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionText, setQuestionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'qas'),
      where('productId', '==', productId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setQas(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as ProductQA[]);
      setLoading(false);
    }, (error) => {
      console.warn("Q&As initialization index may be building:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !questionText.trim()) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'qas'), {
        productId,
        storeId,
        userId: user.uid,
        userName: profile?.displayName || user.displayName || 'Anonymous Client',
        question: questionText.trim(),
        createdAt: new Date().toISOString()
      });
      setQuestionText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'qas');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 mt-12">
        <Skeleton className="h-8 w-48" />
        {[1, 2].map(i => (
          <div key={i} className="flex gap-4">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-12 mt-16 pt-12 border-t border-gray-150">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-gray-900 italic tracking-tight mb-2">
            Perguntas & Respostas / Product Q&A
          </h3>
          <p className="text-xs text-gray-400 font-bold tracking-tight">
            Tem dúvidas sobre o artigo? Pergunte diretamente ao vendedor antes de encomendar.
          </p>
        </div>
        <div className="text-xs bg-blue-50 text-blue-600 font-black px-4 py-2 rounded-full uppercase tracking-wider flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4" /> {qas.length} {qas.length === 1 ? 'pergunta' : 'perguntas'}
        </div>
      </div>

      {/* Ask Question Form */}
      {user ? (
        <form onSubmit={handleSubmit} className="bg-slate-50 p-6 sm:p-8 rounded-[40px] border border-gray-150/60 shadow-inner space-y-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nova Pergunta / New Question</p>
          <div className="relative">
            <input 
              type="text"
              className="w-full px-8 py-5 pr-16 bg-white border-none rounded-[32px] focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold shadow-sm placeholder:text-gray-400"
              placeholder="Ex: Oferece garantia? Fazem entregas para outras províncias?"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              disabled={submitting}
            />
            <button 
              type="submit"
              disabled={submitting || !questionText.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-3.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {submitting ? <Clock className="w-5 h-5 animate-spin" /> : <Send className="w-4.5 h-4.5" />}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-blue-50/40 p-6 rounded-[32px] border border-blue-100 flex items-center justify-between gap-4">
          <p className="text-xs font-semibold text-blue-900/80">Faça login para colocar uma pergunta sobre este produto.</p>
          <a href="/login" className="px-5 py-2.5 bg-blue-600 text-white font-black text-[10px] uppercase tracking-wider rounded-full hover:bg-blue-700 transition-all whitespace-nowrap">
            Fazer Login
          </a>
        </div>
      )}

      {/* Questions Stack */}
      <div className="space-y-6">
        {qas.map((qa) => (
          <div key={qa.id} className="bg-white p-6 sm:p-8 rounded-[32px] border border-gray-100 space-y-4 shadow-sm hover:shadow-md transition-all">
            {/* Question Region */}
            <div className="flex gap-4 items-start">
              <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-black text-gray-900 text-sm leading-none">{qa.userName}</h4>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                    {qa.createdAt ? formatDistanceToNow(new Date(qa.createdAt)) + ' atrás' : 'Agora mesmo'}
                  </p>
                </div>
                <p className="text-gray-700 text-sm font-semibold">{qa.question}</p>
              </div>
            </div>

            {/* Answer Region */}
            {qa.answer ? (
              <div className="bg-slate-50 p-5 rounded-2xl border border-gray-100/80 flex gap-4 ml-6 sm:ml-12">
                <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-700 uppercase tracking-wider italic flex items-center gap-1">
                      Resposta da Loja ({storeName})
                    </span>
                    <span className="text-[8px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest">
                      Verificado
                    </span>
                  </div>
                  <p className="text-gray-600 text-xs font-medium leading-relaxed">{qa.answer}</p>
                  {qa.answeredAt && (
                    <p className="text-[8px] text-gray-400 font-bold uppercase tracking-wider pt-1">
                      Respondido há {formatDistanceToNow(new Date(qa.answeredAt))}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-50/80 flex items-center gap-3 ml-6 sm:ml-12 text-xs font-medium text-orange-700">
                <Clock className="w-4 h-4 text-orange-400 animate-pulse shrink-0" />
                <span>A aguardar resposta do vendedor...</span>
              </div>
            )}
          </div>
        ))}

        {qas.length === 0 && (
          <div className="text-center py-16 bg-gray-50/50 rounded-[40px] border border-dashed border-gray-150">
            <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-bold text-gray-400 italic text-sm">Ainda sem perguntas! Seja o primeiro a esclarecer as suas dúvidas.</p>
          </div>
        )}
      </div>
    </div>
  );
}
