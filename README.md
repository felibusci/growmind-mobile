# 🌱 GrowMind Mobile

Phone-first cannabis plant health monitoring with Gemini AI.

## Qué es

App PWA (Next.js) que te deja:

- Sacar fotos de tus plantas con la cámara del celu y obtener un diagnóstico experto en español
- Registrar feedings completos con NPK, pH/EC de entrada y de runoff
- Generar insights agregados que correlacionan feedings con la respuesta visual de la planta
- Predecir problemas en los próximos 3-7 días y recibir recomendaciones del próximo riego

Todo corre en tu celu. El análisis visual usa **Google Gemini Flash** (free tier 1500 req/día) y, opcionalmente, un modelo TFLite propio entrenable desde el notebook en `training/`.

## Stack

- Next.js 16 + TypeScript + Tailwind
- Gemini Flash via API route server-side (`/api/analyze`, `/api/correlate`)
- localStorage para persistencia (sin backend, sin cuenta)
- Cámara nativa del browser + giroscopio para detección de nivel
- TensorFlow / MobileNetV3 para entrenar modelo propio (notebook Colab)

## Setup

### 1. Conseguir Gemini API key (gratis)

Ver `SETUP-GEMINI.md`.

### 2. Local

```bash
cp .env.local.example .env.local
# Editar .env.local con tu GEMINI_API_KEY
npm install
npm run dev
```

### 3. Deploy a Vercel desde GitHub

1. Pushear este repo a GitHub (usá `growmind-deploy-github.command` en tu Desktop)
2. Andá a https://vercel.com/new
3. Importá el repo
4. En Environment Variables agregá `GEMINI_API_KEY`
5. Deploy

A partir de ahí, cada `git push` re-deploya automáticamente.

## Estructura

```
app/
  page.tsx              ← toda la UI (Dashboard, Camera, Feeding, Insights)
  api/
    analyze/route.ts    ← POST → Gemini con foto + contexto de planta
    correlate/route.ts  ← POST → Gemini con historial → forecast + recomendaciones
  layout.tsx
  globals.css
public/
  manifest.json         ← PWA install
training/
  train_plant_health.ipynb  ← Colab notebook para entrenar TFLite propio
SETUP-GEMINI.md         ← cómo conseguir y configurar la API key
```

## Próximas iteraciones

- [ ] Modo cámara fija (kiosko en celu viejo) con captura automática cada X horas
- [ ] Cargar modelo TFLite local como primera capa (rápido + offline) y Gemini como fallback de reasoning
- [ ] Sync opcional a Supabase para multi-device
- [ ] Export de timeline a PDF para REPROCANN
- [ ] Comunidad: comparar tu cultivo con cepas similares
