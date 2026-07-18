import React, { useState, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { X, UploadCloud, FileSpreadsheet, Download, AlertTriangle, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CATEGORIES } from '../../constants';
import { handleFirestoreError, OperationType } from '../../lib/firebaseErrors';
import { useTranslation } from 'react-i18next';
import { Store, Product } from '../../types';
import confetti from 'canvas-confetti';
import { cn } from '../../lib/utils';

interface ImportCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store;
  onImportComplete?: () => void;
}

interface ParsedProduct {
  rowNumber: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  minOrderQuantity: number;
  colors: string[];
  sizes: string[];
  images: string[];
  deliveryAvailable: boolean;
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function ImportCSVModal({ isOpen, onClose, store, onImportComplete }: ImportCSVModalProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [parsedItems, setParsedItems] = useState<ParsedProduct[]>([]);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [importStep, setImportStep] = useState<'upload' | 'validate' | 'importing' | 'success'>('upload');

  // Generate Sample CSV with dynamic download to make it very convenient
  const downloadTemplate = () => {
    const headers = 'name,description,price,category,stock,minOrderQuantity,colors,sizes,images,deliveryAvailable\n';
    
    // Pick two existing categories that are valid for the user's business type
    const productCats = CATEGORIES.filter(cat => cat.type === 'product' || !cat.type);
    const serviceCats = CATEGORIES.filter(cat => cat.type === 'service');
    
    const exampleProdCat = productCats[0]?.id || 'electronics';
    const exampleServCat = serviceCats[0]?.id || 'services-freelance';

    const row1 = `\"Sample Premium Headphones\",\"Noise-cancelling wireless Bluetooth headphones\",149.99,${exampleProdCat},50,1,\"Black, Silver\",\"OneSize\",\"https://images.unsplash.com/photo-1505740420928-5e560c06d30e\",true\n`;
    const row2 = `\"Professional Consulting Session\",\"One hour strategic assessment for local businesses\",2499.00,${exampleServCat},999,1,\"None\",\"None\",\"https://images.unsplash.com/photo-1454165804606-c3d57bc86b40\",false\n`;
    
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + row1 + row2);
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', 'sabush_marketplace_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totals = useMemo(() => {
    const total = parsedItems.length;
    const valid = parsedItems.filter(item => item.isValid).length;
    const invalid = total - valid;
    return { total, valid, invalid };
  }, [parsedItems]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  // Highly robust manual CSV parser to avoid installing large dynamic external libraries
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        result.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    result.push(currentField.trim());
    return result;
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Por favor, carregue um ficheiro CSV válido. (Please upload a valid CSV file.)');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        alert('O CSV está vazio ou não contém cabeçalho.');
        return;
      }

      // Map headers to lowercase to tolerate casing variations
      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, ''));
      const items: ParsedProduct[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length <= 1 && values[0] === '') continue; // Skip blank line

        // Build data map
        const rowData: Record<string, string> = {};
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        const rowNumber = i + 1;
        const name = rowData['name'] || '';
        const description = rowData['description'] || '';
        const priceStr = rowData['price'] || '';
        const category = rowData['category'] || '';
        const stockStr = rowData['stock'] || '1';
        const minOrderQuantityStr = rowData['minorderquantity'] || rowData['min_order_quantity'] || '1';
        const colorsStr = rowData['colors'] || '';
        const sizesStr = rowData['sizes'] || '';
        const imagesStr = rowData['images'] || '';
        const deliveryAvailableStr = rowData['deliveryavailable'] || rowData['delivery_available'] || 'false';

        // Validations
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!name) {
          errors.push('Nome do produto é obrigatório (Product Name is required).');
        }

        const price = parseFloat(priceStr);
        if (isNaN(price)) {
          errors.push('Preço inválido ou ausente (Price must be a valid number).');
        } else if (price <= 0) {
          errors.push('Preço deve ser maior que zero (Price must be greater than zero).');
        }

        const stock = parseInt(stockStr);
        if (isNaN(stock)) {
          errors.push('Stock deve ser um número inteiro (Stock must be an integer).');
        } else if (stock < 0) {
          errors.push('Stock não pode ser negativo (Stock cannot be negative).');
        }

        const minOrderQuantity = parseInt(minOrderQuantityStr);

        // Category validation
        const catObj = CATEGORIES.find(c => c.id === category);
        if (!category) {
          errors.push('Categoria é obrigatória (Category is required).');
        } else if (!catObj) {
          errors.push(`Categoria "${category}" é inválida. Consulte o ID correto das categorias. (Category ID is invalid.)`);
        } else {
          // Additional warning/check based on store business offeringType
          const storeOffering = store.offeringType || 'products';
          if (storeOffering === 'products' && catObj.type === 'service') {
            warnings.push(`Sua empresa é para Produtos, mas a categoria "${catObj.name}" é para Serviços.`);
          }
          if (storeOffering === 'services' && catObj.type === 'product') {
            warnings.push(`Sua empresa é para Serviços, mas a categoria "${catObj.name}" é para Produtos.`);
          }
        }

        // Parse colors/sizes/images
        const colors = colorsStr.split(',').map(c => c.trim()).filter(c => c !== '' && c.toLowerCase() !== 'none');
        const sizes = sizesStr.split(',').map(s => s.trim()).filter(s => s !== '' && s.toLowerCase() !== 'none');
        const rawImages = imagesStr.split(',').map(img => img.trim()).filter(img => img !== '');
        
        // Setup placeholders if image is missing
        const images = rawImages.length > 0 ? rawImages : [];

        const deliveryAvailable = deliveryAvailableStr.toLowerCase() === 'true';

        items.push({
          rowNumber,
          name,
          description,
          price: isNaN(price) ? 0 : price,
          stock: isNaN(stock) ? 0 : stock,
          category,
          minOrderQuantity: isNaN(minOrderQuantity) ? 1 : minOrderQuantity,
          colors,
          sizes,
          images,
          deliveryAvailable,
          isValid: errors.length === 0,
          errors,
          warnings
        });
      }

      setParsedItems(items);
      setImportStep('validate');
    };

    reader.readAsText(file);
  };

  const handleStartImport = async () => {
    if (!user) return;
    
    const importableItems = parsedItems.filter(item => item.isValid);
    if (importableItems.length === 0) {
      alert('Nenhum produto válido para importar.');
      return;
    }

    setImportStep('importing');
    setLoading(true);
    setProgress({ current: 0, total: importableItems.length });

    let succeededCount = 0;

    for (let i = 0; i < importableItems.length; i++) {
      const item = importableItems[i];
      
      const translations = {
        en: { name: item.name, description: item.description },
        pt: { name: item.name, description: item.description },
        fr: { name: item.name, description: item.description }
      };

      try {
        await addDoc(collection(db, 'products'), {
          storeId: store.id,
          sellerId: user.uid,
          name: item.name,
          description: item.description,
          price: item.price,
          country: store.country || 'MZ',
          currency: store.currency || 'MZN',
          category: item.category,
          stock: item.stock,
          minOrderQuantity: item.minOrderQuantity,
          wholesalePrices: null,
          colors: item.colors,
          sizes: item.sizes,
          images: item.images,
          deliveryAvailable: item.deliveryAvailable,
          status: 'active',
          rating: 0,
          reviewCount: 0,
          createdAt: new Date().toISOString(),
          translations
        });
        succeededCount++;
      } catch (err) {
        console.error(`Falha ao importar linha ${item.rowNumber}:`, err);
        handleFirestoreError(err, OperationType.CREATE, 'products');
      }

      setProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setLoading(false);
    setImportStep('success');
    
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#2563eb', '#10b981', '#6366f1']
    });

    if (onImportComplete) {
      onImportComplete();
    }
  };

  const handleReset = () => {
    setParsedItems([]);
    setFileName('');
    setImportStep('upload');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
        />

        {/* Modal Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative bg-white rounded-[40px] max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100/50"
        >
          {/* Header */}
          <div className="p-8 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-gray-900 italic tracking-tight">
                  Importar Produtos (CSV) / Import Products
                </h2>
                <p className="text-xs text-gray-400 font-medium tracking-wide">
                  Carregamento rápido de produtos em lote para o seu catálogo
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-900 rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Interactive Steps container */}
          <div className="flex-1 overflow-y-auto p-8">
            {importStep === 'upload' && (
              <div className="space-y-6">
                {/* Upload Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-[32px] p-12 text-center transition-all flex flex-col items-center justify-center min-h-[300px] cursor-pointer",
                    dragActive 
                      ? "border-blue-500 bg-blue-50/40" 
                      : "border-gray-200 bg-gray-50/30 hover:bg-gray-50/50 hover:border-blue-300"
                  )}
                >
                  <input
                    type="file"
                    accept=".csv"
                    id="csv-file-input"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                  <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center">
                    <UploadCloud className="w-16 h-16 text-blue-500 mb-4 animate-pulse" />
                    <h3 className="text-lg font-black text-gray-800 uppercase tracking-wider mb-2">
                      Carregue o Ficheiro CSV / Upload CSV File
                    </h3>
                    <p className="text-sm text-gray-400 font-medium mb-6 max-w-md">
                      Arraste e solte o ficheiro aqui ou clique para procurar no seu computador.
                    </p>
                    <span className="px-6 py-3 bg-white border border-gray-100 text-xs font-black uppercase tracking-widest text-gray-700 rounded-full shadow-sm hover:shadow transition-all hover:border-gray-200">
                      Selecionar Ficheiro / Choose File
                    </span>
                  </label>
                </div>

                {/* Templates & Guidelines */}
                <div className="bg-blue-50/40 border border-blue-100 rounded-[24px] p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-blue-950 mb-1">
                      Precisa do Modelo de Importação? / Need Template?
                    </h4>
                    <p className="text-[11px] text-blue-700/80 font-medium leading-relaxed max-w-lg">
                      Baixe o nosso modelo pré-configurado contendo as colunas corretas para garantir que todos os produtos sejam validados rapidamente e sem erros.
                    </p>
                  </div>
                  <button
                    onClick={downloadTemplate}
                    className="px-5 py-3.5 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-100 cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Descarregar Modelo
                  </button>
                </div>

                {/* Supported Columns Guide */}
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3 ml-2">
                    Colunas do Ficheiro CSV / CSV Column Schema
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100/30">
                      <span className="font-mono text-xs font-bold text-blue-700">name*</span>
                      <p className="text-[10px] text-gray-400 mt-1">Nome do produto comercializado.</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100/30">
                      <span className="font-mono text-xs font-bold text-indigo-700">category*</span>
                      <p className="text-[10px] text-gray-400 mt-1">ID da categoria ex: `electronics`, `furniture`.</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100/30">
                      <span className="font-mono text-xs font-bold text-green-700">price*</span>
                      <p className="text-[10px] text-gray-400 mt-1">Preço unitário em MZN (Número maior que 0).</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100/30">
                      <span className="font-mono text-xs font-bold text-gray-700">stock*</span>
                      <p className="text-[10px] text-gray-400 mt-1">Quantidade em stock disponível.</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100/30">
                      <span className="font-mono text-xs font-semibold text-gray-500">description</span>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium italic">Opcional. Descrição/detalhes.</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100/30">
                      <span className="font-mono text-xs font-semibold text-gray-500">images</span>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium italic">Opcional. Link das imagens separadas por vírgula.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {importStep === 'validate' && (
              <div className="space-y-6">
                {/* File Statistics Panel */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-5 bg-gray-50 rounded-[24px] text-center border border-gray-100">
                    <span className="text-[10px] uppercase font-black tracking-widest text-gray-400 block mb-1">Total Detetados</span>
                    <span className="text-3xl font-black text-gray-800 tracking-tight">{totals.total}</span>
                    <span className="text-[9px] text-gray-400 block mt-1">produtos no ficheiro</span>
                  </div>
                  <div className="p-5 bg-green-50/70 rounded-[24px] text-center border border-green-100/50">
                    <span className="text-[10px] uppercase font-black tracking-widest text-green-600 block mb-1">Prontos a Importar</span>
                    <span className="text-3xl font-black text-green-600 tracking-tight">{totals.valid}</span>
                    <span className="text-[9px] text-green-500 block mt-1">totalmente válidos</span>
                  </div>
                  <div className="p-5 bg-amber-50/70 rounded-[24px] text-center border border-amber-100/50">
                    <span className="text-[10px] uppercase font-black tracking-widest text-amber-600 block mb-1">Com Alertas/Erros</span>
                    <span className="text-3xl font-black text-amber-600 tracking-tight">{totals.invalid}</span>
                    <span className="text-[9px] text-amber-500 block mt-1">requerem atenção</span>
                  </div>
                </div>

                {/* Products Table with Validation Output Messages */}
                <div>
                  <div className="flex items-center justify-between mb-3 ml-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
                      Ficheiro carregado / Loaded Data Preview: <span className="text-gray-600 font-bold lowercase font-mono">{fileName}</span>
                    </h3>
                    <button
                      onClick={handleReset}
                      className="text-xs text-blue-600 font-black uppercase tracking-wider hover:underline hover:text-blue-700 cursor-pointer"
                    >
                      Mudar Ficheiro / Change File
                    </button>
                  </div>

                  <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm max-h-[320px] overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur">
                        <tr>
                          <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest w-16">Linha</th>
                          <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Produto / Categoria</th>
                          <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest w-28">Preço & Stock</th>
                          <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Status / Erros</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {parsedItems.map((item, idx) => (
                          <tr key={idx} className={item.isValid ? "hover:bg-gray-50/30" : "bg-red-50/20 hover:bg-red-50/30"}>
                            <td className="px-6 py-4 text-xs font-bold text-gray-400 font-mono">
                              #{item.rowNumber}
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-black text-gray-800 line-clamp-1">{item.name || '(Sem nome / No name)'}</span>
                              <span className="text-[10px] text-gray-400 block font-semibold uppercase mt-0.5">
                                Categoria: {item.category || '(Ausente)'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-mono">
                              <div className="font-extrabold text-gray-800">{item.price.toFixed(2)} MZN</div>
                              <div className="text-[10px] text-gray-400 mt-0.5 font-sans font-semibold">Qtd: {item.stock}</div>
                            </td>
                            <td className="px-6 py-4">
                              {item.isValid ? (
                                <div className="flex items-center gap-1.5 text-green-600 text-xs font-black">
                                  <CheckCircle2 className="w-4 h-4" /> VÁLIDO
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {item.errors.map((err, errIdx) => (
                                    <div key={errIdx} className="flex items-center gap-1 text-red-600 text-[10px] font-extrabold">
                                      <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {err}
                                    </div>
                                  ))}
                                  {item.warnings.map((warn, warnIdx) => (
                                    <div key={warnIdx} className="flex items-center gap-1 text-amber-600 text-[10px] font-bold">
                                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {warn}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Validation Info footer */}
                {totals.invalid > 0 && (
                  <div className="bg-amber-50/40 border border-amber-100 rounded-2xl p-4 flex gap-3 text-amber-700">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
                    <div className="text-[11px] leading-relaxed font-semibold">
                      <span>Existem <strong>{totals.invalid}</strong> produtos com erros no formato do ficheiro. Estes produtos inválidos serão <strong>descartados / ignorados</strong> durante o processo de importação. Poderá prosseguir com a importação apenas dos produtos válidos ({totals.valid} produtos) ou reajustar o seu ficheiro CSV e carregar novamente.</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {importStep === 'importing' && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-gray-800 uppercase tracking-wider">
                    A Importar Catálogo... / Importing Catalog...
                  </h3>
                  <p className="text-sm text-gray-400 font-medium max-w-sm">
                    Carregando os produtos verificados para as coleções do Mercado Sabush. Não feche este painel.
                  </p>
                </div>

                {/* Loader status progress bar */}
                <div className="w-full max-w-md bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
                <div className="text-xs font-mono font-black text-gray-500">
                  {progress.current} de {progress.total} importados ({Math.round((progress.current / progress.total) * 100)}%)
                </div>
              </div>
            )}

            {importStep === 'success' && (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-6">
                <div className="w-20 h-20 bg-green-50 rounded-[28px] flex items-center justify-center text-green-500 shadow-lg shadow-green-100 border border-green-200/20">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest italic">
                    Importação Concluída com Sucesso!
                  </h3>
                  <p className="text-sm text-gray-500 font-medium">
                    Imported Successfully!
                  </p>
                  <p className="text-sm text-gray-400 font-medium max-w-md mt-4">
                    Os seus produtos válidos de {fileName} foram adicionados diretamente ao catálogo e já estão disponíveis no Mercado Sabush.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer controls */}
          <div className="p-8 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 sticky bottom-0 z-20">
            {importStep === 'validate' && (
              <>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-6 py-3.5 bg-white border border-gray-200 text-gray-600 hover:text-gray-900 text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer"
                >
                  Cancelar / Cancel
                </button>
                <button
                  type="button"
                  disabled={totals.valid === 0}
                  onClick={handleStartImport}
                  className={cn(
                    "px-8 py-3.5 text-white text-xs font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-xl",
                    totals.valid > 0 
                      ? "bg-blue-600 hover:bg-blue-700 shadow-blue-100" 
                      : "bg-gray-300 cursor-not-allowed shadow-none"
                  )}
                >
                  Importar {totals.valid} Produtos <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}

            {importStep === 'success' && (
              <button
                type="button"
                onClick={onClose}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer shadow-xl shadow-blue-100 animate-pulse"
              >
                Concluir / Finish
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
