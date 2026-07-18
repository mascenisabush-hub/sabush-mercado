# Mercado Sabush - Digital Marketplace

A modern, full-stack digital marketplace built for Mozambique, featuring real-time updates, AI-powered content assistance, and multi-language support (Portuguese & English).

## Features

- **Full-Stack Architecture**: React frontend with an Express backend.
- **AI Integration**: Powered by Google Gemini for product descriptions, translation, and image moderation.
- **Real-Time Database**: Powered by Firebase Firestore.
- **Multilingual**: Comprehensive i18n support for PT and EN.
- **Payments**: Simulated integration for M-Pesa, e-Mola, and Bank transfers.
- **Responsive Design**: Modern UI built with Tailwind CSS and Framer Motion.

## Prerequisites

- Node.js (v18+)
- npm or yarn
- A Firebase Project (for Firestore and Auth)
- A Google AI Studio API Key (for Gemini features)

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd mercado-sabush
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory and add the following variables (see `.env.example` for details):

```env
GEMINI_API_KEY="your_gemini_api_key"
PORT=3000
NODE_ENV=development
```

### 4. Firebase Configuration

The application expects a `firebase-applet-config.json` file in the root directory. This contains your Firebase project configuration.

```json
{
  "apiKey": "...",
  "authDomain": "...",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "...",
  "measurementId": "..."
}
```

### 5. Running the Application

**Development Mode:**
```bash
npm run dev
```
The server will start on `http://localhost:3000`.

**Production Build:**
```bash
npm run build
npm start
```

## Project Structure

- `src/`: React frontend source code.
- `server.ts`: Express backend server & API routes.
- `firestore.rules`: Security rules for Firebase Firestore.
- `firebase-blueprint.json`: Firestore schema definition used in AI Studio.

## Technologies Used

- **Frontend**: React, Vite, Tailwind CSS, motion/react, Lucide Icons.
- **Backend**: Node.js, Express, esbuild, tsx.
- **AI**: @google/genai (Gemini 1.5 Flash).
- **Database**: Firebase (Authentication & Firestore).
- **Internationalization**: i18next.

## License

MIT

## Admin Migration Note

The previous codebase hardcoded `sabushmike@gmail.com` as a permanent admin bypass in both Firestore security rules and the frontend. This has been removed. Admin access now relies solely on the `role` field in the user's Firestore document.

**Before deploying this change**, ensure the Firestore user document for `sabushmike@gmail.com` has `role: 'admin'` set. If not, manually update it via the Firebase Console:

1. Go to Firebase Console > Firestore Database
2. Navigate to the `users` collection
3. Find the document with `email: "sabushmike@gmail.com"`
4. Set the `role` field to `"admin"`
5. Deploy the updated `firestore.rules`
