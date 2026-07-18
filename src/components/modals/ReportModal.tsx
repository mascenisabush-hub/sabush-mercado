import React, { useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { ReportTargetType } from '../../types';
import { X, Flag, AlertTriangle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError, OperationType } from '../../lib/firebaseErrors';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: ReportTargetType;
}

export function ReportModal({ isOpen, onClose, targetId, targetType }: ReportModalProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const reasons = [
    'Inappropriate Content',
    'Scam / Fraudulent',
    'Offensive Language',
    'Counterfeit Item',
    'Wrong Category',
    'Other'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reason) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: user.uid,
        targetId,
        targetType,
        reason,
        details,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setReason('');
        setDetails('');
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reports');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                    <Flag className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl font-black text-gray-900 italic">Report {targetType}</h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              {success ? (
                <div className="py-12 text-center">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-4">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                  <p className="text-xl font-black text-gray-900 mb-2 italic">Report Received</p>
                  <p className="text-gray-500 font-medium">Thank you for helping us keep Mercado Sabush safe.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Reason for reporting</label>
                    <div className="grid grid-cols-2 gap-2">
                      {reasons.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setReason(r)}
                          className={`px-4 py-3 rounded-2xl text-xs font-bold transition-all border-2 ${
                            reason === r 
                              ? 'border-blue-600 bg-blue-50 text-blue-600' 
                              : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Additional Details</label>
                    <textarea 
                      placeholder="Please provide more information..."
                      className="w-full h-32 px-5 py-4 bg-gray-50 border-none rounded-3xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium resize-none"
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-orange-50 text-orange-700 rounded-3xl mb-6">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-[10px] font-bold leading-relaxed uppercase tracking-wider">
                      Reporting will notify our safety team. Abuse of reports can lead to account suspension.
                    </p>
                  </div>

                  <button 
                    type="submit"
                    disabled={submitting || !reason}
                    className="w-full py-5 bg-gray-900 text-white rounded-3xl font-black hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-3 italic"
                  >
                    {submitting ? 'Sending...' : 'Submit Report'}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
