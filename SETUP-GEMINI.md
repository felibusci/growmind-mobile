# Setup de Gemini (gratis)

Esta app usa **Google Gemini Flash** para diagnosticar fotos de plantas. Hay un free tier muy generoso (1500 requests/día), suficiente para uso personal y testing.

## 1. Conseguir la API key (3 minutos)

1. Andá a https://aistudio.google.com/app/apikey
2. Iniciá sesión con tu cuenta de Google
3. Click en **"Create API key"** → **"Create API key in new project"**
4. Copiá el string que empieza con `AIza...`

⚠️ No la pegues acá ni la subas al repo. Es una credencial.

## 2. Configurarla en Vercel

1. Andá a https://vercel.com/dashboard
2. Entrá al proyecto **growmind-mobile**
3. Settings → Environment Variables
4. Agregar:
   - **Key:** `GEMINI_API_KEY`
   - **Value:** tu key (`AIza...`)
   - **Environment:** Production, Preview, Development (todas)
5. Click **Save**
6. Andá a Deployments → tu último deploy → menú **⋯** → **Redeploy** (para que tome la variable nueva)

## 3. Configurarla local (para desarrollo)

En la carpeta `growmind-mobile/`, creá un archivo `.env.local`:

```
GEMINI_API_KEY=AIza...
```

`.env.local` está en `.gitignore`, no se sube al repo.

Después corré:

```
npm run dev
```

## 4. Verificar que funciona

1. Abrí la app en tu celu
2. Sacá una foto de una planta
3. En el resultado tiene que aparecer una etiqueta morada **"🧠 IA Gemini"** y un diagnóstico mucho más detallado que antes (con deficiencias específicas, estado de N/P/K/Ca/Mg, etc.)

Si no aparece esa etiqueta, está usando el análisis local por color como fallback. Causas comunes:
- La API key no está seteada
- No redeployaste después de setearla
- La key está expirada o tiene rate limit (1500/día gratis)

## Costos

| Acción | Costo |
|---|---|
| Free tier Gemini Flash | 1500 requests/día gratis |
| Después del free tier | ~USD 0.0001 por imagen |
| Hosting Vercel hobby | Gratis |
| **Total para uso personal** | **USD 0** |

Para uso comercial pesado (>1500 fotos/día), considerá pasarte al modelo propio TFLite (ver `training/train_plant_health.ipynb`).
