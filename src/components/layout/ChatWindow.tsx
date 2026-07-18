import React, { useState, useRef, useEffect } from 'react';
import { Send, X, MessageCircle, User, Loader2 } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from '../common/RouteLink';
import { useTranslation } from 'react-i18next';
import { TranslatedText } from '../common/TranslatedText';

export function ChatWindow() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const { activeChatId, messages, sendMessage, activeChats, setActiveChatId, participantsInfo } = useChat();
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isNetworkOnline, setIsNetworkOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const locationPath = useLocation();

  useEffect(() => {
    const handleOnline = () => setIsNetworkOnline(true);
    const handleOffline = () => setIsNetworkOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-adjust height of the textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
    }
  }, [inputText]);

  const currentChatObj = activeChats.find(c => c.id === activeChatId);
  const currentPartnerId = currentChatObj?.participants.find(id => id !== user?.uid);
  const currentPartner = currentPartnerId ? participantsInfo[currentPartnerId] : null;
  const currentPartnerName = currentPartner?.name || 'Mercado Chat';

  useEffect(() => {
    if (locationPath === '/messages') {
      setIsOpen(true);
    }
  }, [locationPath]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeChatId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim()) {
        handleSend(e as unknown as React.FormEvent);
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText;
    setInputText('');
    await sendMessage(text);
  };

  if (!user) return null;

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-4 pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-[calc(100vw-32px)] sm:w-80 h-[450px] bg-white rounded-3xl border border-gray-100 shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
          >
            {/* Header */}
            <div className="bg-blue-600 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                   <h4 className="text-sm font-black">Live Chat</h4>
                   <div className="flex items-center gap-1.5">
                      <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isNetworkOnline ? "bg-green-400" : "bg-amber-400")}></div>
                      <span className="text-[10px] font-bold opacity-80 uppercase tracking-tighter">
                        {isNetworkOnline ? 'Online' : 'Offline / Lento'}
                      </span>
                   </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
               {/* Chat List if no active chat */}
               {!activeChatId ? (
                 <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">My Conversations</h5>
                    {activeChats.length === 0 ? (
                      <div className="text-center py-10">
                        <p className="text-xs text-gray-500">No active chats yet. Start chatting from a product or order!</p>
                      </div>
                    ) : (
                      activeChats.map(chat => {
                        const partnerId = chat.participants.find(id => id !== user.uid);
                        const partner = partnerId ? participantsInfo[partnerId] : null;
                        const partnerName = partner?.name || 'Mercado Chat';
                        const partnerAvatar = partner?.avatar;
                        const isStorePartner = partner?.isStore;

                        return (
                          <button 
                            key={chat.id}
                            onClick={() => setActiveChatId(chat.id)}
                            className="w-full text-left p-3 rounded-2xl border border-gray-55 border-gray-100 hover:bg-gray-50 transition-all flex items-center gap-3 group"
                          >
                            <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-blue-50 text-blue-600 border border-gray-100 shrink-0">
                               {partnerAvatar ? (
                                 <img src={partnerAvatar} alt={partnerName} className="w-full h-full object-cover" />
                               ) : (
                                 <User className="w-5 h-5" />
                               )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                               <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-gray-900 truncate pr-1">
                                    {partnerName}
                                  </span>
                                  {isStorePartner && (
                                    <span className="text-[8px] px-1.5 py-0.5 bg-blue-50 text-blue-600 font-bold rounded-md uppercase tracking-tighter shrink-0 scale-90">
                                      Loja
                                    </span>
                                  )}
                               </div>
                               <p className="text-[11px] text-gray-500 truncate">{chat.lastMessage || 'Conversa iniciada'}</p>
                            </div>
                          </button>
                        );
                      })
                    )}
                 </div>
               ) : (
                 /* Individual Chat Window */
                 <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
                    <div className="absolute top-[60px] left-0 right-0 z-10 bg-white/80 backdrop-blur-md px-4 py-1.5 border-b border-gray-100 flex items-center justify-between">
                       <button 
                         onClick={() => setActiveChatId(null)} 
                         className="text-xs font-black text-blue-600 hover:text-blue-700 transition-colors"
                       >
                         ← Voltar
                       </button>
                       <span className="text-xs font-bold text-gray-900 truncate max-w-[150px]">{currentPartnerName}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 mt-8 space-y-4" ref={scrollRef}>
                       {messages.map((msg) => {
                         const isMe = msg.senderId === user.uid;
                         const senderLanguage = isMe ? (i18n.language || 'pt') : (currentPartner?.preferredLanguage || 'pt');
                         return (
                           <div 
                             key={msg.id} 
                             className={cn(
                               "flex flex-col max-w-[85%]",
                               isMe ? "ml-auto items-end" : "mr-auto items-start"
                             )}
                           >
                             <div className={cn(
                               "px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm",
                               isMe 
                                 ? "bg-blue-600 text-white rounded-tr-none" 
                                 : "bg-white text-gray-900 border border-gray-100 rounded-tl-none"
                             )}>
                               <TranslatedText text={msg.text} senderLanguage={senderLanguage} messageId={msg.id} />
                             </div>
                             <span className="text-[8px] text-gray-400 mt-1 font-bold uppercase tracking-tight">
                               {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                             </span>
                           </div>
                         );
                       })}
                    </div>

                    <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 flex gap-2 items-end">
                       <textarea 
                         ref={textareaRef}
                         rows={1}
                         value={inputText}
                         onChange={(e) => setInputText(e.target.value)}
                         onKeyDown={handleKeyDown}
                         placeholder="Type your message..."
                         className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:bg-white resize-none min-h-[38px] max-h-[100px] overflow-y-auto pt-2.5 pb-2.5"
                       />
                       <button 
                        type="submit"
                        className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-all shadow-md active:scale-95 disabled:opacity-50 shrink-0 mb-0.5"
                        disabled={!inputText.trim()}
                       >
                         <Send className="w-5 h-5" />
                       </button>
                    </form>
                 </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all pointer-events-auto group"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
               <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
               <div className="relative">
                 <MessageCircle className="w-7 h-7" />
                 <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </div>
  );
}
