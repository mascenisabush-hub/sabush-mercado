import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";

dotenv.config();

// Load Firebase Config
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

const PROJECT_ID = firebaseConfig.projectId || "mercado-sabush";
const DATABASE_ID = firebaseConfig.firestoreDatabaseId || "ai-studio-6f9413aa-1e33-408b-b51e-cb8d6f1ad136";
const API_KEY = firebaseConfig.apiKey || "";

function parseFirestoreValue(val: any): any {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('arrayValue' in val) {
    if (!val.arrayValue.values) return [];
    return val.arrayValue.values.map((v: any) => parseFirestoreValue(v));
  }
  if ('mapValue' in val) {
    if (!val.mapValue.fields) return {};
    const obj: any = {};
    for (const [k, v] of Object.entries(val.mapValue.fields)) {
      obj[k] = parseFirestoreValue(v);
    }
    return obj;
  }
  return null;
}

function parseFirestoreDocument(doc: any) {
  if (!doc || !doc.fields) return null;
  const data: any = {};
  for (const [key, value] of Object.entries(doc.fields)) {
    data[key] = parseFirestoreValue(value);
  }
  data.id = doc.name ? doc.name.split('/').pop() : "";
  return data;
}

async function fetchFirestoreDoc(collection: string, docId: string) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${collection}/${docId}?key=${API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Firestore REST error: ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  return parseFirestoreDocument(json);
}

function escapeHtml(unsafe: string) {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function injectMetaTags(html: string, meta: { title: string; description: string; image: string; url: string; type: string }) {
  let modified = html;

  // Replace Title
  modified = modified.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);

  // Replace Meta description
  modified = modified.replace(/<meta name="description" content=".*?"\s*\/?>/i, `<meta name="description" content="${escapeHtml(meta.description)}" />`);

  // Replace OG tags
  modified = modified.replace(/<meta property="og:title" content=".*?"\s*\/?>/i, `<meta property="og:title" content="${escapeHtml(meta.title)}" />`);
  modified = modified.replace(/<meta property="og:description" content=".*?"\s*\/?>/i, `<meta property="og:description" content="${escapeHtml(meta.description)}" />`);
  modified = modified.replace(/<meta property="og:image" content=".*?"\s*\/?>/i, `<meta property="og:image" content="${escapeHtml(meta.image)}" />`);
  modified = modified.replace(/<meta property="og:url" content=".*?"\s*\/?>/i, `<meta property="og:url" content="${escapeHtml(meta.url)}" />`);
  modified = modified.replace(/<meta property="og:type" content=".*?"\s*\/?>/i, `<meta property="og:type" content="${escapeHtml(meta.type)}" />`);

  return modified;
}

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // JSON and URL encoded bodies
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Multilingual content translation
  app.post("/api/translate", async (req, res) => {
    const { text, targetLanguages } = req.body;
    
    if (!text || !targetLanguages || !Array.isArray(targetLanguages)) {
      return res.status(400).json({ error: "Invalid request. Missing text or targetLanguages." });
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `Translate the following text into these languages: ${targetLanguages.join(", ")}. Return a JSON object where keys are language codes and values are the translations.
        
        Text to translate:
        "${text}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: targetLanguages.reduce((acc: any, lang: string) => {
              acc[lang] = { type: Type.STRING };
              return acc;
            }, {})
          }
        }
      });

      const translations = JSON.parse(response.text || "{}");
      res.json(translations);
    } catch (error) {
      console.error("Translation error:", error);
      res.status(500).json({ error: "Failed to translate content." });
    }
  });

  // AI Content Assistant
  app.post("/api/ai/suggest-description", async (req, res) => {
    const { productName, category, keyFeatures } = req.body;
    
    if (!productName) {
      return res.status(400).json({ error: "Product name is required" });
    }

    try {
      const prompt = `Write a premium, catchy, and professional product description for a marketplace.
      Product Name: ${productName}
      Category: ${category || 'General'}
      Key Features: ${keyFeatures || 'None provided'}
      
      The description should be around 2-3 short paragraphs, highlighting the value proposition for customers in Mozambique. Use an elegant and trustworthy tone.`;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt
      });

      res.json({ description: response.text });
    } catch (error) {
      console.error("AI Generation error:", error);
      res.status(500).json({ error: "Failed to generate description" });
    }
  });

  // AI Smart Image Search (Predictive Search)
  app.post("/api/ai/search-images", async (req, res) => {
    const { productName, category } = req.body;
    
    if (!productName) {
      return res.status(400).json({ error: "Product name is required" });
    }

    try {
      // We use Gemini to generate relevant keywords for high-quality product images
      const prompt = `Generate a list of 5 high-quality, professional, and royalty-free image search keywords or tags for the following product: ${productName} (Category: ${category || 'General'}). 
      The keywords should specifically target clean product photography with white or natural backgrounds.
      Return a JSON array of strings.`;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const keywords = JSON.parse(response.text || "[]");
      
      const suggestions = keywords.map((kw: string) => {
        const encoded = encodeURIComponent(kw.trim().replace(/\s+/g, ','));
        return {
          id: Math.random().toString(36).substring(7),
          url: `https://source.unsplash.com/800x600/?${encoded}`,
          source: 'Unsplash (Commercial Use)',
          preview: `https://source.unsplash.com/400x300/?${encoded}`,
        };
      });

      res.json({ images: suggestions });
    } catch (error) {
      console.error("Image search error:", error);
      res.status(500).json({ error: "Failed to search images" });
    }
  });

  // Image Moderation
  app.post("/api/ai/moderate", async (req, res) => {
    const { imageUrl, productName } = req.body;
    
    if (!imageUrl) return res.status(400).json({ error: "Image URL is required" });

    try {
      const prompt = `Act as a marketplace moderator. Analyze this image (URL: ${imageUrl}) for a product named "${productName}". 
      Is this image appropriate for a general audience marketplace? 
      Check for: Nudity, violence, drugs, offensive content, or obvious spam.
      Return a JSON object: { "safe": boolean, "reason": string }`;

      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              safe: { type: Type.BOOLEAN },
              reason: { type: Type.STRING }
            }
          }
        }
      });

      res.json(JSON.parse(response.text || '{"safe": true, "reason": "No issues found"}'));
    } catch (error) {
      console.error("Moderation error:", error);
      res.json({ safe: true, reason: "Unable to verify, but defaulting to safe." });
    }
  });

  // Enhanced Payment Processing (M-Pesa, e-Mola, Bank)
  app.post("/api/payments/process", (req, res) => {
    const { method, phoneNumber, amount, orderIds, customerName } = req.body;
    
    // Basic validation
    if (!method || !amount || (!phoneNumber && method !== 'Bank Transfer')) {
      return res.status(400).json({ 
        status: "error", 
        message: "Missing required payment details (method, amount, or recipient details)." 
      });
    }

    console.log(`[PAYMENT] Initiating ${method} - Amount: ${amount} MT - Orders: ${orderIds?.join(', ')}`);

    // Simulate network latency
    setTimeout(() => {
      // Logic for different methods
      let success = true;
      let message = "";
      let gatewayRef = "GSB-" + Math.random().toString(36).substring(2, 10).toUpperCase();

      if (method === 'M-Pesa') {
        // Validate Vodacom prefix (84, 85)
        const isVodacom = /^(?:\+258|258)?8[45]\d{7}$/.test(phoneNumber.replace(/\s+/g, ''));
        if (!isVodacom) {
          return res.status(400).json({ 
            status: "failed", 
            message: "Invalid M-Pesa number. Must be a Vodacom number (84 or 85)." 
          });
        }
        message = "USSD Push sent to customer. Transaction pending confirmation.";
      } 
      else if (method === 'e-Mola') {
        // Validate Movitel prefix (86, 87)
        const isMovitel = /^(?:\+258|258)?8[67]\d{7}$/.test(phoneNumber.replace(/\s+/g, ''));
        if (!isMovitel) {
          return res.status(400).json({ 
            status: "failed", 
            message: "Invalid e-Mola number. Must be a Movitel number (86 or 87)." 
          });
        }
        message = "e-Mola payment request accepted. Processing mobile money transfer.";
      }
      else if (method === 'Bank Transfer') {
        message = "Bank transfer instructions generated. Please upload proof of payment.";
        gatewayRef = "BANK-" + Date.now().toString().slice(-8);
      }

      // Random failure simulation (e.g., insufficient funds)
      const isFailed = Math.random() < 0.05; // 5% failure rate
      if (isFailed) {
        return res.status(402).json({
          status: "failed",
          message: `${method} processing failed: Insufficient funds or session expired.`
        });
      }

      // Final Success Response
      res.status(200).json({
        status: "success",
        transactionId: method.substring(0, 2).toUpperCase() + Math.random().toString(36).substring(7).toUpperCase(),
        gatewayReference: gatewayRef,
        message: message || `${method} payment processed successfully`,
        paidAt: new Date().toISOString(),
        amount,
        orderIds
      });
    }, 1500);
  });

  // Vite middleware for development
  let viteInstance: any;
  if (process.env.NODE_ENV !== "production") {
    viteInstance = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
  }

  // Pre-rendering SEO Middleware / Route Handlers for Social Previews
  app.get("/product/:id", async (req, res, next) => {
    const { id } = req.params;
    try {
      const product = await fetchFirestoreDoc('products', id);
      if (!product) {
        return next();
      }

      const name = product.name_pt || product.name_en || product.name || "Produto";
      const price = product.price !== undefined ? `${product.price.toLocaleString()} MT` : "";
      const description = product.description_pt || product.description_en || product.description || "Compre no Mercado Sabush!";
      const image = (product.images && product.images[0]) || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800";
      
      const host = req.get('host') || 'mercado-sabush.com';
      const protocol = req.protocol || 'https';
      const fullUrl = `${protocol}://${host}${req.originalUrl}`;

      let templatePath = "";
      if (process.env.NODE_ENV !== "production") {
        templatePath = path.join(process.cwd(), 'index.html');
      } else {
        templatePath = path.join(process.cwd(), 'dist', 'index.html');
      }

      let html = fs.readFileSync(templatePath, 'utf8');

      if (process.env.NODE_ENV !== "production" && viteInstance) {
        html = await viteInstance.transformIndexHtml(req.originalUrl, html);
      }

      const title = `${name} - ${price} | Mercado Sabush`;
      const finalHtml = injectMetaTags(html, {
        title,
        description,
        image,
        url: fullUrl,
        type: "product"
      });

      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(finalHtml);
    } catch (err) {
      console.error("[PRE-RENDER ERROR] Failed to serve product metadata:", err);
      return next(); // Fallback to SPA client routing
    }
  });

  app.get("/store/:id", async (req, res, next) => {
    const { id } = req.params;
    try {
      const store = await fetchFirestoreDoc('stores', id);
      if (!store) {
        return next();
      }

      const name = store.businessName || "Loja";
      const description = store.description || `Visite a loja ${name} no Mercado Sabush de Moçambique!`;
      const image = store.logo || store.banner || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1200";

      const host = req.get('host') || 'mercado-sabush.com';
      const protocol = req.protocol || 'https';
      const fullUrl = `${protocol}://${host}${req.originalUrl}`;

      let templatePath = "";
      if (process.env.NODE_ENV !== "production") {
        templatePath = path.join(process.cwd(), 'index.html');
      } else {
        templatePath = path.join(process.cwd(), 'dist', 'index.html');
      }

      let html = fs.readFileSync(templatePath, 'utf8');

      if (process.env.NODE_ENV !== "production" && viteInstance) {
        html = await viteInstance.transformIndexHtml(req.originalUrl, html);
      }

      const title = `${name} | Mercado Sabush`;
      const finalHtml = injectMetaTags(html, {
        title,
        description,
        image,
        url: fullUrl,
        type: "website"
      });

      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(finalHtml);
    } catch (err) {
      console.error("[PRE-RENDER ERROR] Failed to serve store metadata:", err);
      return next();
    }
  });

  // Serve static assets and SPA fallbacks
  if (process.env.NODE_ENV !== "production") {
    if (viteInstance) {
      app.use(viteInstance.middlewares);
    }
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Success: Mercado Sabush server is listening on port ${PORT}`);
    console.log(`[SERVER] Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[SERVER] Internal URL: http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
