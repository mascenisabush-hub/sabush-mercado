import React from 'react';
import { X, ShieldCheck, Heart, Info, DollarSign, MessageCircle, AlertTriangle, Scale } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsModal({ isOpen, onClose }: TermsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 30 }}
            className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-3xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-100"
          >
            {/* Header */}
            <div className="p-8 border-b border-gray-100 flex justify-between items-start shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100/90 text-blue-600 rounded-3xl flex items-center justify-center shadow-sm shrink-0 border border-blue-200">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight italic uppercase leading-none">
                    Termos & Condições
                  </h2>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">
                    Mercado Sabush — Do Rovuma ao Maputo 🇲🇿
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-gray-100 rounded-2xl transition-colors text-gray-400 hover:text-gray-900 cursor-pointer"
                aria-label="Fecar termos"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-8 overflow-y-auto space-y-6 text-sm text-gray-600 leading-relaxed font-medium">
              {/* Introduction/Preamble */}
              <div className="bg-yellow-50/70 border border-yellow-105 p-5 rounded-3xl flex items-start gap-3">
                <Heart className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <p className="font-extrabold text-xs text-yellow-800 uppercase tracking-wider mb-1">
                    Nota do Fundador & Copywriter
                  </p>
                  <p className="text-xs text-yellow-700 leading-relaxed font-semibold">
                    Kanimambo (Obrigado) por se juntar a nós! No Mercado Sabush, acreditamos no potencial imenso das nossas PMEs, lojistas locais, e alfaiates em Moçambique. Desenhámos esta plataforma para ser o motor digital que liga quem vende com quem compra em tempo real. Para que tudo funcione em harmonia e segurança, criámos estes termos simples, mas muito sérios. Leia com atenção!
                  </p>
                </div>
              </div>

              {/* Terms list */}
              <div className="space-y-6">
                
                {/* Rule 1 */}
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center font-mono text-xs font-black text-gray-700 shrink-0 mt-1">
                    01
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide flex items-center gap-2 mb-1.5">
                      <Scale className="w-4 h-4 text-emerald-500" /> Registo Honesto & Espirito de Confiança
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Ao criar a sua loja, está a assumir o compromisso solene de usar informações 100% verdadeiras. É obrigatório fornecer o seu Nome Completo, NUIT moçambicano válido, contacto telefónico funcional e número de WhatsApp para contacto real. Contas falsas, perfis duplicados para enganar clientes, ou tentativas de burlas resultarão em <strong>banimento vitalício imediato</strong> sem aviso prévio.
                    </p>
                  </div>
                </div>

                {/* Rule 2 */}
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center font-mono text-xs font-black text-gray-700 shrink-0 mt-1">
                    02
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide flex items-center gap-2 mb-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-500" /> Moeda de Transacção e Carteiras Móveis
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Todos os preços devem ser indicados claramente em <strong>Meticais (MT / MZN)</strong>. Como o Mercado Sabush não cobra taxas abusivas sobre as suas vendas, os pagamentos são geridos directamente entre as partes através das nossas carteiras móveis nacionais de eleição (<strong>M-Pesa, e-Mola, mKesh</strong>), transferência bancária (IBAN / Ponto 24), ou dinheiro em mão no acto de entrega. Compre com segurança, pague com responsabilidade!
                    </p>
                  </div>
                </div>

                {/* Rule 3 */}
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center font-mono text-xs font-black text-gray-700 shrink-0 mt-1">
                    03
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide flex items-center gap-2 mb-1.5">
                      <MessageCircle className="w-4 h-4 text-emerald-500" /> Comunicação Elegante & Resposta no WhatsApp
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Lembre-se: o Mercado Sabush gera leads direccionadas directamente para o seu WhatsApp. Comprometa-se a tratar os compradores de forma afável e célere. Responda com um caloroso <em>"Olá, mano/mana! Em que posso ajudar?"</em>. O spam abusivo, publicidade não solicitada a clientes que entraram em contacto ou uso de linguagem grosseira constituem violações graves destes Termos.
                    </p>
                  </div>
                </div>

                {/* Rule 4 */}
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center font-mono text-xs font-black text-gray-700 shrink-0 mt-1">
                    04
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide flex items-center gap-2 mb-1.5">
                      <Info className="w-4 h-4 text-emerald-500" /> Qualidade dos Produtos e Proibições
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Só são aceites produtos legais que cumpram integralmente a legislação vigente na República de Moçambique. É expressamente proibida a listagem de medicamentos sem autorização especial, produtos fora da validade (categorias alimentares), contrabando, imagens pornográficas, ou réplicas fraudulentas de marcas registadas. Seja um orgulho para a nossa economia nacional!
                    </p>
                  </div>
                </div>

                {/* Rule 5 */}
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center font-mono text-xs font-black text-gray-700 shrink-0 mt-1">
                    05
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="w-4 h-4 text-emerald-500" /> Entrega, Logística & Segurança Física
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Tanto o levantamento na loja como o envio por motoboy, Txopela ou portador local (como o "chapa" ou transportes de encomendas) devem ser coordenados garantindo a segurança de ambas as partes. Sugerimos vivamente que os encontros em locais públicos aconteçam em áreas bem iluminadas e seguras (como shoppings, postos de combustíveis famosos, ou perto de autoridades de segurança).
                    </p>
                  </div>
                </div>

                {/* Rule 6 */}
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center font-mono text-xs font-black text-gray-700 shrink-0 mt-1">
                    06
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-sm uppercase tracking-wide flex items-center gap-2 mb-1.5">
                      <Scale className="w-4 h-4 text-emerald-500" /> Isenção de Responsabilidade & Direitos do Sabush
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      O Mercado Sabush actua puramente como uma montra e facilitador de geolocalização e conexão inicial. Toda a transacção financeira, acordo de entrega e garantia da qualidade dos produtos são de responsabilidade única e exclusiva do comprador e vendedor. Reservamo-nos o direito de alterar as funcionalidades do site e os presentes termos de uso a qualquer momento para melhor servir o povo moçambicano.
                    </p>
                  </div>
                </div>

              </div>

              {/* Closing Legal Note */}
              <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 mt-6 text-center">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  © 2026 Mercado Sabush. Todos os direitos reservados para Moçambique.
                </p>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="p-8 border-t border-gray-100 bg-gray-50 flex items-center justify-end shrink-0">
              <button 
                onClick={onClose}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all text-white font-black text-xs uppercase tracking-widest rounded-2xl cursor-pointer shadow-md"
              >
                Eu Entendi & Aceito 🇲🇿
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
