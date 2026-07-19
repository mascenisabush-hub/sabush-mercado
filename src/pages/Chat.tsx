import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, User, Loader2, ArrowLeft, Store, MessageCircle, AlertCircle } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { cn, formatCurrency } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '../components/common/RouteLink';
import { TranslatedText } from '../components/common/TranslatedText';

export function Chat() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { activeChatId, messages, sendMessage, activeChats, setActiveChatId, participantsInfo } = useChat();
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-adjust height of the textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
    }
  }, [inputText]);

  const currentChatObj = activeChats.find(c => c.id === activeChatId);
  const currentPartnerId = currentChatObj?.participants.find(id => id !== user?.uid);
  const currentPartner = currentPartnerId ? participantsInfo[currentPartnerId] : null;
  const currentPartnerName = currentPartner?.name || t('chat.mercado_chat', 'Mercado Chat');
  const currentPartnerAvatar = currentPartner?.avatar;
  const isStorePartner = currentPartner?.isStore;

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeChatId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim() && !sending) {
        handleSend(e as unknown as React.FormEvent);
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;

    try {
      setSending(true);
      const text = inputText;
      setInputText('');
      await sendMessage(text);
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[32px] flex items-center justify-center mb-6">
          <MessageCircle className="w-10 h-10 animate-bounce" />
        </div>
        <h3 className="text-2xl font-black text-gray-900 mb-2 italic tracking-tight">{t('chat.login_required', 'Login Required')}</h3>
        <p className="text-sm font-medium text-gray-500 mb-6">{t('chat.login_desc', 'Please sign in to view your chats and communicate with sellers.')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 h-[calc(100vh-140px)] min-h-[500px]">
      <button 
        onClick={() => navigate('/marketplace')} 
        className="mb-4 flex items-center gap-2 text-gray-500 font-bold hover:text-blue-600 transition-colors"
      >
         <ArrowLeft className="w-5 h-5" /> Back to Marketplace
      </button>

      <div className="bg-white rounded-[32px] border border-gray-100 shadow-2xl h-full overflow-hidden flex">
        {/* Left pane: Chats List */}
        <div className={cn(
          "w-full md:w-96 border-r border-gray-100 flex flex-col h-full bg-slate-50/30",
          activeChatId ? "hidden md:flex" : "flex"
        )}>
          {/* List Header */}
          <div className="p-6 border-b border-gray-100 bg-white">
            <h2 className="text-xl font-black text-gray-900 tracking-tight italic flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-blue-600" />
              {t('chat.messages', 'Mensagens')}
            </h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mt-1">
              {t('chat.conversations', 'Conversas Activas')}
            </p>
          </div>

          {/* List Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {activeChats.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mx-auto mb-4">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <p className="text-sm text-gray-900 font-bold">{t('chat.no_chats', 'No active chats')}</p>
                <p className="text-xs text-gray-400 font-medium mt-1">
                  {t('chat.no_chats_desc', 'Start a conversation from a product page or layout.')}
                </p>
              </div>
            ) : (
              activeChats.map(chat => {
                const partnerId = chat.participants.find(id => id !== user.uid);
                const partner = partnerId ? participantsInfo[partnerId] : null;
                const partnerName = partner?.name || t('chat.loading_profile', 'Loading Profile...');
                const partnerAvatar = partner?.avatar;
                const isSelected = chat.id === activeChatId;

                return (
                  <button
                    key={chat.id}
                    onClick={() => setActiveChatId(chat.id)}
                    className={cn(
                      "w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 group relative",
                      isSelected
                        ? "bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-100"
                        : "bg-white border-gray-100 hover:border-gray-200 text-gray-900 shadow-sm"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center overflow-hidden border shrink-0",
                      isSelected ? "bg-white/25 border-white/20 text-white" : "bg-blue-50 text-blue-600 border-gray-100"
                    )}>
                      {partnerAvatar ? (
                        <img src={partnerAvatar} alt={partnerName} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <User className="w-6 h-6" />
                      )}
                    </div>

                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-sm font-black truncate pr-1",
                          isSelected ? "text-white" : "text-gray-900"
                        )}>
                          {partnerName}
                        </span>
                        {partner?.isStore && (
                          <span className={cn(
                            "text-[8px] px-1.5 py-0.5 font-black rounded-lg uppercase tracking-widest shrink-0",
                            isSelected ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
                          )}>
                            {t('common.store', 'Loja')}
                          </span>
                        )}
                      </div>
                      <p className={cn(
                        "text-xs truncate mt-1 font-medium",
                        isSelected ? "text-blue-100" : "text-gray-500"
                      )}>
                        {chat.lastMessage || t('chat.started', 'Conversa iniciada')}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right pane: Chat Messages Area */}
        <div className={cn(
          "flex-1 flex flex-col h-full bg-slate-50/10",
          !activeChatId ? "hidden md:flex" : "flex"
        )}>
          {activeChatId ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Active Conversation Header */}
              <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center justify-between z-10 shadow-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                  <button
                    onClick={() => setActiveChatId(null)}
                    className="p-2 -ml-2 text-gray-400 hover:text-gray-900 md:hidden hover:bg-gray-100 rounded-xl transition-all"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden bg-blue-50 text-blue-600 border border-gray-150 shrink-0">
                    {currentPartnerAvatar ? (
                      <img src={currentPartnerAvatar} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>

                  <div className="overflow-hidden">
                    <h4 className="text-sm font-black text-gray-900 truncate leading-tight">
                      {currentPartnerName}
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider leading-none">
                        {isStorePartner ? t('common.store', 'Loja') : t('common.buyer', 'Comprador')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Messages Log */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
                {messages.length === 0 ? (
                  <div className="text-center py-24 text-gray-400">
                    <MessageSquare className="w-12 h-12 mx-auto opacity-20 mb-2 animate-bounce" />
                    <p className="text-xs font-bold uppercase tracking-wider">{t('chat.say_hello', 'Diga olá!')}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{t('chat.start_typing', 'Envie uma mensagem para iniciar a conversa.')}</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isMe = msg.senderId === user.uid;
                    const senderLanguage = isMe ? (i18n.language || 'pt') : (currentPartner?.preferredLanguage || 'pt');
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex flex-col max-w-[75%] transition-all",
                          isMe ? "ml-auto items-end" : "mr-auto items-start"
                        )}
                      >
                        <div className={cn(
                          "px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm",
                          isMe
                            ? "bg-blue-600 text-white rounded-tr-none shadow-blue-100"
                            : "bg-white text-gray-950 border border-gray-100 rounded-tl-none shadow-sm"
                        )}>
                          <TranslatedText text={msg.text} senderLanguage={senderLanguage} messageId={msg.id} />
                        </div>
                        <span className="text-[8px] text-gray-400 mt-1.5 px-1 font-bold uppercase tracking-widest opacity-80">
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Composer */}
              <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-150 flex gap-3 items-end">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  placeholder={t('chat.type_message', 'Escreva uma mensagem...')}
                  className="flex-1 px-5 py-3 bg-gray-55 bg-gray-100/70 border-none rounded-2xl focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none font-bold text-sm transition-all resize-none min-h-[48px] max-h-[140px] overflow-y-auto pt-3.5 pb-3.5"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || sending}
                  className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-blue-100 shrink-0 disabled:opacity-40 hover:scale-105 mb-0.5"
                >
                  <Send className="w-5 h-5 stroke-[2.5]" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[36px] flex items-center justify-center mb-6">
                <MessageCircle className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 italic tracking-tight mb-2">
                {t('chat.select_chat', 'Selecione uma Conversa')}
              </h3>
              <p className="text-sm font-medium text-gray-400 max-w-sm">
                {t('chat.select_desc', 'Escolha uma conversa na barra lateral para começar a enviar mensagens aos vendedores ou clientes.')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
