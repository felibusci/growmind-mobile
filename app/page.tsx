"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── TYPES ───
interface Plant {
  id: string;
  name: string;
  genetics: string;
  phase: "vegetativo" | "floracion" | "secado";
  objective: "flor" | "extraccion" | "aceite";
  dayOfCycle: number;
  createdAt: string;
  lastScore?: number;
  lastDiagnosis?: string;
}

interface Photo {
  id: string;
  plantId: string;
  dataUrl: string;
  thumbnail: string;
  timestamp: string;
  analysis: AnalysisResult;
  notes?: string;
}

interface CheckIn {
  id: string;
  plantId: string;
  timestamp: string;
  watered: boolean;
  waterAmount?: string;
  waterPh?: string;
  notes?: string;
}

// Feeding = registro completo de alimentación con runoff
interface Feeding {
  id: string;
  plantId: string;
  timestamp: string;
  // Lo que entra
  volumeMl: number;
  phIn?: number;
  ecIn?: number;            // mS/cm
  // Composición de nutrientes (texto libre + opcional NPK)
  nutrients: string;        // ej: "BioBizz Grow 2ml/L + CalMag 1ml/L"
  npkRatio?: string;        // ej: "5-2-3"
  // Lo que sale (runoff)
  phRunoff?: number;
  ecRunoff?: number;
  runoffPercent?: number;   // % del volumen que salió como runoff
  // Observaciones
  notes?: string;
}

type NutrientLevel = "bajo" | "ok" | "alto" | "desconocido";

interface NutrientStatus {
  nitrogen: NutrientLevel;
  phosphorus: NutrientLevel;
  potassium: NutrientLevel;
  calcium: NutrientLevel;
  magnesium: NutrientLevel;
}

interface DetectedIssues {
  deficiencies: string[];
  pests: string[];
  diseases: string[];
  stages: string[];
}

interface AnalysisResult {
  healthScore: number;
  greenRatio: number;
  yellowRatio: number;
  brownRatio: number;
  darkRatio: number;
  diagnosis: string;
  recommendations: string[];
  confidence: string;
  source?: "local" | "gemini";
  detected?: DetectedIssues;
  nutrientStatus?: NutrientStatus;
}

// Insights agregados generados por /api/correlate
interface PlantInsights {
  plantId: string;
  generatedAt: string;
  summary: string;
  trends: {
    healthDirection: "subiendo" | "estable" | "bajando" | string;
    phDrift: string;
    ecDrift: string;
    recurringIssues: string[];
  };
  feedingResponse: Array<{
    feedingDate: string;
    responseObserved: string;
    verdict: "positivo" | "neutro" | "negativo" | string;
  }>;
  forecast: {
    next3Days: string;
    next7Days: string;
    risks: string[];
  };
  nextFeedingRecommendation: {
    when: string;
    what: string;
    why: string;
  };
}

// ─── STORAGE HELPERS ───
const PLANTS_KEY = "gm_plants";
const PHOTOS_KEY = "gm_photos";
const CHECKINS_KEY = "gm_checkins";
const FEEDINGS_KEY = "gm_feedings";
const INSIGHTS_KEY = "gm_insights";

function loadPlants(): Plant[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(PLANTS_KEY) || "[]"); } catch { return []; }
}
function savePlants(plants: Plant[]) {
  localStorage.setItem(PLANTS_KEY, JSON.stringify(plants));
}
function loadPhotos(): Photo[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(PHOTOS_KEY) || "[]"); } catch { return []; }
}
function savePhotos(photos: Photo[]) {
  localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos));
}
function loadCheckins(): CheckIn[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(CHECKINS_KEY) || "[]"); } catch { return []; }
}
function saveCheckins(checkins: CheckIn[]) {
  localStorage.setItem(CHECKINS_KEY, JSON.stringify(checkins));
}
function loadFeedings(): Feeding[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(FEEDINGS_KEY) || "[]"); } catch { return []; }
}
function saveFeedings(feedings: Feeding[]) {
  localStorage.setItem(FEEDINGS_KEY, JSON.stringify(feedings));
}
function loadInsights(): Record<string, PlantInsights> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(INSIGHTS_KEY) || "{}"); } catch { return {}; }
}
function saveInsights(insights: Record<string, PlantInsights>) {
  localStorage.setItem(INSIGHTS_KEY, JSON.stringify(insights));
}

// ─── IMAGE ANALYSIS ───
function analyzeImage(imageDataUrl: string): Promise<AnalysisResult> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 200; // Sample at 200x200 for speed
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, size, size);
      const imageData = ctx.getImageData(0, 0, size, size);
      const pixels = imageData.data;

      let green = 0, yellow = 0, brown = 0, dark = 0, total = 0;

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];

        // Convert to HSV
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const diff = max - min;
        const v = max / 255;
        const s = max === 0 ? 0 : diff / max;
        let h = 0;
        if (diff !== 0) {
          if (max === r) h = 60 * (((g - b) / diff) % 6);
          else if (max === g) h = 60 * ((b - r) / diff + 2);
          else h = 60 * ((r - g) / diff + 4);
        }
        if (h < 0) h += 360;

        // Skip very dark or very bright (background/light)
        if (v < 0.1 || (v > 0.95 && s < 0.1)) { dark++; total++; continue; }

        total++;

        // Green: healthy plant tissue (hue 60-170, decent saturation)
        if (h >= 60 && h <= 170 && s > 0.15 && v > 0.15) {
          green++;
        }
        // Yellow: chlorosis indicator (hue 30-60)
        else if (h >= 30 && h < 60 && s > 0.2 && v > 0.3) {
          yellow++;
        }
        // Brown: necrosis indicator (hue 10-40, low saturation or value)
        else if (h >= 10 && h < 45 && s > 0.1 && v > 0.1 && v < 0.6) {
          brown++;
        }
      }

      const plantPixels = total - dark;
      const greenRatio = plantPixels > 0 ? green / plantPixels : 0;
      const yellowRatio = plantPixels > 0 ? yellow / plantPixels : 0;
      const brownRatio = plantPixels > 0 ? brown / plantPixels : 0;
      const darkRatio = total > 0 ? dark / total : 0;

      // Health score calculation
      let healthScore = Math.round(
        Math.min(100, Math.max(0,
          greenRatio * 120 - yellowRatio * 60 - brownRatio * 100 + 20
        ))
      );

      // Generate diagnosis
      const { diagnosis, recommendations, confidence } = generateDiagnosis(
        greenRatio, yellowRatio, brownRatio, healthScore
      );

      resolve({
        healthScore,
        greenRatio: Math.round(greenRatio * 100),
        yellowRatio: Math.round(yellowRatio * 100),
        brownRatio: Math.round(brownRatio * 100),
        darkRatio: Math.round(darkRatio * 100),
        diagnosis,
        recommendations,
        confidence,
      });
    };
    img.src = imageDataUrl;
  });
}

function generateDiagnosis(
  greenR: number, yellowR: number, brownR: number, score: number
): { diagnosis: string; recommendations: string[]; confidence: string } {
  const recommendations: string[] = [];
  let diagnosis = "";
  let confidence = "moderada";

  if (score >= 80) {
    diagnosis = "Planta saludable. El follaje muestra buena coloracion verde y no se detectan signos evidentes de estres.";
    recommendations.push("Mantener rutina actual de riego y nutricion");
    recommendations.push("Tomar foto de seguimiento en 2-3 dias");
    confidence = "alta";
  } else if (score >= 60) {
    diagnosis = "Salud aceptable con signos leves de estres. ";
    if (yellowR > 0.15) {
      diagnosis += "Se detecta amarillamiento en parte del follaje, consistente con posible deficiencia de Nitrogeno o Magnesio, o inicio de senescencia natural.";
      recommendations.push("Verificar pH del agua de riego (rango ideal: 6.0-6.8)");
      recommendations.push("Considerar suplementar con CalMag si el amarillamiento es intervenal");
      recommendations.push("Revisar programa de nutricion");
    } else {
      diagnosis += "Algunos indicadores de color sugieren estres leve.";
      recommendations.push("Revisar condiciones ambientales (temperatura y humedad)");
      recommendations.push("Verificar frecuencia de riego");
    }
    confidence = "moderada";
  } else if (score >= 40) {
    diagnosis = "Se detectan signos de estres significativo. ";
    if (yellowR > 0.25) {
      diagnosis += "Amarillamiento extenso visible. Posibles causas: deficiencia nutricional (N, Mg, Fe), pH incorrecto, o problemas de riego.";
      recommendations.push("URGENTE: Verificar pH del sustrato y agua de riego");
      recommendations.push("Revisar EC/PPM de la solucion nutritiva");
      recommendations.push("Sacar foto de detalle de hojas afectadas");
    }
    if (brownR > 0.1) {
      diagnosis += " Hay zonas necroticas (tejido muerto) que pueden indicar quemadura por nutrientes, deficiencia de Potasio o Calcio, o dano por plagas.";
      recommendations.push("Inspeccionar envez de hojas en busca de plagas");
      recommendations.push("Reducir EC si se sospecha sobrefertilizacion");
    }
    confidence = "moderada-alta";
  } else {
    diagnosis = "Planta en estres severo. Se recomienda atencion inmediata. El follaje muestra signos extensos de dano que requieren diagnostico presencial.";
    recommendations.push("URGENTE: Inspeccionar la planta fisicamente");
    recommendations.push("Verificar raices (buscar pudricion o root rot)");
    recommendations.push("Revisar todos los parametros: pH, EC, temperatura, humedad");
    recommendations.push("Considerar flush con agua a pH correcto");
    confidence = "alta";
  }

  recommendations.push("Registrar datos de riego en el check-in para mejorar diagnosticos futuros");
  return { diagnosis, recommendations, confidence };
}

// ─── GEMINI CLIENT ───
// Llama al endpoint /api/analyze que internamente habla con Gemini Flash.
// Si falla por cualquier razón, hace fallback al análisis local por color.
async function analyzeWithGemini(
  imageDataUrl: string,
  plantContext?: Record<string, unknown>
): Promise<AnalysisResult> {
  // 1. Calcular siempre las métricas locales de color (rápido, sirve de fallback)
  const localResult = await analyzeImage(imageDataUrl);

  try {
    // 2. Extraer base64 puro
    const match = imageDataUrl.match(/^data:(.+);base64,(.*)$/);
    if (!match) return { ...localResult, source: "local" };
    const mimeType = match[1];
    const imageBase64 = match[2];

    // 3. Llamar al endpoint server-side
    const r = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, mimeType, plantContext }),
    });

    if (!r.ok) {
      console.warn("Gemini API failed, usando análisis local", r.status);
      return { ...localResult, source: "local" };
    }

    const data = await r.json();
    if (!data.ok) {
      console.warn("Gemini API error:", data.error);
      return { ...localResult, source: "local" };
    }

    // 4. Combinar: usar Gemini para diagnóstico/score y mantener métricas locales de color
    return {
      // Métricas de color locales (siguen siendo útiles)
      greenRatio: localResult.greenRatio,
      yellowRatio: localResult.yellowRatio,
      brownRatio: localResult.brownRatio,
      darkRatio: localResult.darkRatio,
      // Diagnóstico, score, recomendaciones de Gemini
      healthScore: typeof data.healthScore === "number" ? data.healthScore : localResult.healthScore,
      diagnosis: data.diagnosis || localResult.diagnosis,
      recommendations: Array.isArray(data.recommendations) ? data.recommendations : localResult.recommendations,
      confidence: data.confidence || localResult.confidence,
      detected: data.detected,
      nutrientStatus: data.nutrientStatus,
      source: "gemini",
    };
  } catch (err) {
    console.warn("analyzeWithGemini error:", err);
    return { ...localResult, source: "local" };
  }
}

// Pide a /api/correlate un análisis agregado de toda la historia de la planta.
async function fetchPlantInsights(
  plant: Plant,
  feedings: Feeding[],
  photos: Photo[]
): Promise<PlantInsights | null> {
  try {
    const r = await fetch("/api/correlate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plantContext: {
          name: plant.name,
          genetics: plant.genetics,
          phase: plant.phase,
          dayOfCycle: plant.dayOfCycle,
        },
        feedings: feedings
          .filter((f) => f.plantId === plant.id)
          .slice(0, 30)
          .map((f) => ({
            timestamp: f.timestamp,
            volumeMl: f.volumeMl,
            phIn: f.phIn,
            ecIn: f.ecIn,
            phRunoff: f.phRunoff,
            ecRunoff: f.ecRunoff,
            runoffPercent: f.runoffPercent,
            nutrients: f.nutrients,
            npkRatio: f.npkRatio,
            notes: f.notes,
          })),
        photos: photos
          .filter((p) => p.plantId === plant.id)
          .slice(0, 30)
          .map((p) => ({
            timestamp: p.timestamp,
            healthScore: p.analysis.healthScore,
            diagnosis: p.analysis.diagnosis,
            detected: p.analysis.detected,
            nutrientStatus: p.analysis.nutrientStatus,
          })),
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (!data.ok) return null;
    return {
      plantId: plant.id,
      generatedAt: new Date().toISOString(),
      summary: data.summary || "",
      trends: data.trends || { healthDirection: "estable", phDrift: "", ecDrift: "", recurringIssues: [] },
      feedingResponse: data.feedingResponse || [],
      forecast: data.forecast || { next3Days: "", next7Days: "", risks: [] },
      nextFeedingRecommendation: data.nextFeedingRecommendation || { when: "", what: "", why: "" },
    };
  } catch {
    return null;
  }
}

// ─── HELPER: Create thumbnail ───
function createThumbnail(dataUrl: string, maxSize: number = 150): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.6));
    };
    img.src = dataUrl;
  });
}

// ─── COMPONENTS ───

function HealthRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 70 ? "#2E7D32" : score >= 45 ? "#F9A825" : "#D32F2F";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="score-ring"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

function Header({ title, onBack, rightAction }: { title: string; onBack?: () => void; rightAction?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center gap-3">
      {onBack && (
        <button onClick={onBack} className="p-1 -ml-1 text-gray-600">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
      )}
      <h1 className="text-lg font-semibold flex-1 truncate">{title}</h1>
      {rightAction}
    </div>
  );
}

// ─── MAIN APP ───
type View = "dashboard" | "addPlant" | "plantDetail" | "camera" | "checkin" | "photoDetail" | "feeding" | "insights";

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [plants, setPlants] = useState<Plant[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [feedings, setFeedings] = useState<Feeding[]>([]);
  const [insights, setInsightsState] = useState<Record<string, PlantInsights>>({});
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPlants(loadPlants());
    setPhotos(loadPhotos());
    setCheckins(loadCheckins());
    setFeedings(loadFeedings());
    setInsightsState(loadInsights());
    setLoaded(true);
  }, []);

  const updatePlants = useCallback((newPlants: Plant[]) => {
    setPlants(newPlants);
    savePlants(newPlants);
  }, []);

  const addPhoto = useCallback((photo: Photo) => {
    setPhotos((prev) => {
      const next = [photo, ...prev];
      savePhotos(next);
      return next;
    });
    // Update plant score
    setPlants((prev) => {
      const next = prev.map((p) =>
        p.id === photo.plantId
          ? { ...p, lastScore: photo.analysis.healthScore, lastDiagnosis: photo.analysis.diagnosis }
          : p
      );
      savePlants(next);
      return next;
    });
  }, []);

  const addCheckin = useCallback((ci: CheckIn) => {
    setCheckins((prev) => {
      const next = [ci, ...prev];
      saveCheckins(next);
      return next;
    });
  }, []);

  const addFeeding = useCallback((f: Feeding) => {
    setFeedings((prev) => {
      const next = [f, ...prev];
      saveFeedings(next);
      return next;
    });
  }, []);

  const updateInsights = useCallback((plantId: string, ins: PlantInsights) => {
    setInsightsState((prev) => {
      const next = { ...prev, [plantId]: ins };
      saveInsights(next);
      return next;
    });
  }, []);

  const openPlant = (id: string) => { setSelectedPlantId(id); setView("plantDetail"); };
  const openCamera = (id: string) => { setSelectedPlantId(id); setView("camera"); };
  const openCheckin = (id: string) => { setSelectedPlantId(id); setView("checkin"); };
  const openFeeding = (id: string) => { setSelectedPlantId(id); setView("feeding"); };
  const openInsights = (id: string) => { setSelectedPlantId(id); setView("insights"); };
  const openPhotoDetail = (photoId: string) => { setSelectedPhotoId(photoId); setView("photoDetail"); };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-2">🌱</div>
          <div className="text-gray-500">Cargando...</div>
        </div>
      </div>
    );
  }

  switch (view) {
    case "dashboard":
      return <Dashboard plants={plants} photos={photos} insights={insights} onOpenPlant={openPlant} onAddPlant={() => setView("addPlant")} onOpenCamera={openCamera} />;
    case "addPlant":
      return <AddPlant onSave={(p) => { updatePlants([...plants, p]); setView("dashboard"); }} onBack={() => setView("dashboard")} />;
    case "plantDetail":
      return (
        <PlantDetail
          plant={plants.find((p) => p.id === selectedPlantId)!}
          photos={photos.filter((p) => p.plantId === selectedPlantId)}
          checkins={checkins.filter((c) => c.plantId === selectedPlantId)}
          feedings={feedings.filter((f) => f.plantId === selectedPlantId)}
          insights={insights[selectedPlantId ?? ""]}
          onBack={() => setView("dashboard")}
          onCamera={() => openCamera(selectedPlantId!)}
          onCheckin={() => openCheckin(selectedPlantId!)}
          onFeeding={() => openFeeding(selectedPlantId!)}
          onInsights={() => openInsights(selectedPlantId!)}
          onPhotoClick={openPhotoDetail}
          onDeletePlant={(id) => {
            updatePlants(plants.filter((p) => p.id !== id));
            setPhotos((prev) => {
              const next = prev.filter((p) => p.plantId !== id);
              savePhotos(next);
              return next;
            });
            setFeedings((prev) => {
              const next = prev.filter((f) => f.plantId !== id);
              saveFeedings(next);
              return next;
            });
            setView("dashboard");
          }}
        />
      );
    case "camera":
      return (
        <CameraView
          plant={plants.find((p) => p.id === selectedPlantId)!}
          lastFeeding={feedings.find((f) => f.plantId === selectedPlantId) ?? null}
          onCapture={addPhoto}
          onBack={() => setView("plantDetail")}
        />
      );
    case "checkin":
      return (
        <CheckInView
          plant={plants.find((p) => p.id === selectedPlantId)!}
          onSave={(ci) => { addCheckin(ci); setView("plantDetail"); }}
          onBack={() => setView("plantDetail")}
        />
      );
    case "feeding":
      return (
        <FeedingView
          plant={plants.find((p) => p.id === selectedPlantId)!}
          onSave={(f) => { addFeeding(f); setView("plantDetail"); }}
          onBack={() => setView("plantDetail")}
        />
      );
    case "insights":
      return (
        <InsightsView
          plant={plants.find((p) => p.id === selectedPlantId)!}
          feedings={feedings.filter((f) => f.plantId === selectedPlantId)}
          photos={photos.filter((p) => p.plantId === selectedPlantId)}
          existing={insights[selectedPlantId ?? ""]}
          onUpdate={(ins) => updateInsights(selectedPlantId!, ins)}
          onBack={() => setView("plantDetail")}
        />
      );
    case "photoDetail":
      return (
        <PhotoDetailView
          photo={photos.find((p) => p.id === selectedPhotoId)!}
          plant={plants.find((p) => p.id === photos.find((ph) => ph.id === selectedPhotoId)?.plantId)!}
          onBack={() => setView("plantDetail")}
        />
      );
  }
}

// ─── DASHBOARD VIEW ───
function Dashboard({ plants, photos, insights, onOpenPlant, onAddPlant, onOpenCamera }: {
  plants: Plant[];
  photos: Photo[];
  insights: Record<string, PlantInsights>;
  onOpenPlant: (id: string) => void;
  onAddPlant: () => void;
  onOpenCamera: (id: string) => void;
}) {
  const avgScore = plants.length > 0
    ? Math.round(plants.reduce((acc, p) => acc + (p.lastScore ?? 0), 0) / plants.filter(p => p.lastScore !== undefined).length) || 0
    : 0;
  const alertCount = plants.filter((p) => (p.lastScore ?? 100) < 50).length;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-[#2E7D32] text-white px-4 pt-4 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">🌱 GrowMind</h1>
            <p className="text-green-100 text-sm">Monitor inteligente</p>
          </div>
          {plants.length > 0 && (
            <div className="text-right">
              <div className="text-3xl font-bold">{avgScore}</div>
              <div className="text-green-100 text-xs">Score promedio</div>
            </div>
          )}
        </div>
        {plants.length > 0 && (
          <div className="flex gap-3">
            <div className="bg-white/15 rounded-xl px-3 py-2 flex-1 text-center">
              <div className="text-lg font-bold">{plants.length}</div>
              <div className="text-xs text-green-100">Plantas</div>
            </div>
            <div className="bg-white/15 rounded-xl px-3 py-2 flex-1 text-center">
              <div className="text-lg font-bold">{photos.length}</div>
              <div className="text-xs text-green-100">Fotos</div>
            </div>
            <div className={`rounded-xl px-3 py-2 flex-1 text-center ${alertCount > 0 ? "bg-red-500/30" : "bg-white/15"}`}>
              <div className="text-lg font-bold">{alertCount}</div>
              <div className="text-xs text-green-100">Alertas</div>
            </div>
          </div>
        )}
      </div>

      {/* Recomendaciones IA - tarjetas de insights por planta */}
      {plants.length > 0 && Object.keys(insights).length > 0 && (
        <div className="px-4 pt-4">
          <h2 className="text-base font-semibold text-gray-700 mb-2">🧠 Recomendaciones IA</h2>
          <div className="space-y-2">
            {plants
              .filter((p) => insights[p.id]?.nextFeedingRecommendation?.what)
              .slice(0, 3)
              .map((p) => {
                const ins = insights[p.id];
                return (
                  <div
                    key={p.id}
                    onClick={() => onOpenPlant(p.id)}
                    className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100 rounded-2xl p-3 active:scale-[0.98] transition-transform"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold text-sm text-emerald-900">{p.name}</div>
                      <div className="text-[10px] uppercase tracking-wide text-emerald-700 bg-white/70 px-2 py-0.5 rounded-full">
                        Próximo: {ins.nextFeedingRecommendation.when}
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">{ins.nextFeedingRecommendation.what}</p>
                    <p className="text-[11px] text-gray-500 mt-1 italic">{ins.nextFeedingRecommendation.why}</p>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Plant Grid */}
      <div className="flex-1 px-4 py-4">
        {plants.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🌿</div>
            <h2 className="text-xl font-semibold mb-2">Tu indoor esta vacio</h2>
            <p className="text-gray-500 mb-6 px-8">Agrega tu primera planta para empezar a monitorear con IA</p>
            <button
              onClick={onAddPlant}
              className="bg-[#2E7D32] text-white px-8 py-3 rounded-full text-lg font-medium shadow-lg"
            >
              + Agregar planta
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-700">Tus plantas</h2>
              <button onClick={onAddPlant} className="text-[#2E7D32] text-sm font-medium">+ Agregar</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {plants.map((plant) => {
                const lastPhoto = photos.find((p) => p.plantId === plant.id);
                const scoreColor = (plant.lastScore ?? 0) >= 70 ? "text-green-600" : (plant.lastScore ?? 0) >= 45 ? "text-yellow-600" : "text-red-600";
                return (
                  <div
                    key={plant.id}
                    onClick={() => onOpenPlant(plant.id)}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform"
                  >
                    {lastPhoto ? (
                      <div className="aspect-square bg-gray-100 relative">
                        <img src={lastPhoto.thumbnail || lastPhoto.dataUrl} alt="" className="w-full h-full object-cover" />
                        {plant.lastScore !== undefined && (
                          <div className={`absolute top-2 right-2 bg-white/90 backdrop-blur rounded-full w-10 h-10 flex items-center justify-center font-bold text-sm ${scoreColor}`}>
                            {plant.lastScore}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="aspect-square bg-green-50 flex items-center justify-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenCamera(plant.id); }}
                          className="bg-[#2E7D32] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-md pulse-green"
                        >
                          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </button>
                      </div>
                    )}
                    <div className="p-3">
                      <div className="font-semibold text-sm truncate">{plant.name}</div>
                      <div className="text-xs text-gray-500">{plant.genetics} · Dia {plant.dayOfCycle}</div>
                      <div className="text-xs text-gray-400 mt-0.5 capitalize">{plant.phase} · {plant.objective}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ADD PLANT VIEW ───
function AddPlant({ onSave, onBack }: { onSave: (p: Plant) => void; onBack: () => void }) {
  const [name, setName] = useState("");
  const [genetics, setGenetics] = useState("");
  const [phase, setPhase] = useState<Plant["phase"]>("vegetativo");
  const [objective, setObjective] = useState<Plant["objective"]>("flor");
  const [dayOfCycle, setDayOfCycle] = useState(1);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.trim(),
      genetics: genetics.trim() || "Sin especificar",
      phase,
      objective,
      dayOfCycle,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header title="Nueva planta" onBack={onBack} />
      <div className="flex-1 px-4 py-4 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Nombre de la planta *</label>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Planta 01, La Grande..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Genetica / Cepa</label>
          <input
            type="text" value={genetics} onChange={(e) => setGenetics(e.target.value)}
            placeholder="Ej: OG Kush, Critical, Auto NL..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Fase actual</label>
          <div className="grid grid-cols-3 gap-2">
            {(["vegetativo", "floracion", "secado"] as const).map((p) => (
              <button key={p} onClick={() => setPhase(p)}
                className={`py-3 rounded-xl text-sm font-medium capitalize transition-all ${
                  phase === p ? "bg-[#2E7D32] text-white shadow-md" : "bg-gray-100 text-gray-600"
                }`}
              >{p}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Objetivo de cosecha</label>
          <div className="grid grid-cols-3 gap-2">
            {([["flor", "🌸 Flor"], ["extraccion", "💎 Extraccion"], ["aceite", "💊 Aceite"]] as const).map(([val, label]) => (
              <button key={val} onClick={() => setObjective(val as Plant["objective"])}
                className={`py-3 rounded-xl text-sm font-medium transition-all ${
                  objective === val ? "bg-[#2E7D32] text-white shadow-md" : "bg-gray-100 text-gray-600"
                }`}
              >{label}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Dia del ciclo</label>
          <input
            type="number" value={dayOfCycle} onChange={(e) => setDayOfCycle(Math.max(1, parseInt(e.target.value) || 1))}
            min={1} max={200}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>
      <div className="px-4 pb-8 pt-2">
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="w-full bg-[#2E7D32] text-white py-4 rounded-2xl text-lg font-semibold shadow-lg disabled:opacity-40 disabled:shadow-none active:scale-[0.98] transition-all"
        >
          Agregar planta
        </button>
      </div>
    </div>
  );
}

// ─── PLANT DETAIL VIEW ───
function PlantDetail({ plant, photos, checkins, feedings, insights, onBack, onCamera, onCheckin, onFeeding, onInsights, onPhotoClick, onDeletePlant }: {
  plant: Plant;
  photos: Photo[];
  checkins: CheckIn[];
  feedings: Feeding[];
  insights?: PlantInsights;
  onBack: () => void;
  onCamera: () => void;
  onCheckin: () => void;
  onFeeding: () => void;
  onInsights: () => void;
  onPhotoClick: (id: string) => void;
  onDeletePlant: (id: string) => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  if (!plant) return null;

  const lastPhoto = photos[0];
  const phaseEmoji = plant.phase === "vegetativo" ? "🌱" : plant.phase === "floracion" ? "🌸" : "🍂";
  const objEmoji = plant.objective === "flor" ? "🌸" : plant.objective === "extraccion" ? "💎" : "💊";

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header
        title={plant.name}
        onBack={onBack}
        rightAction={
          <button onClick={() => setShowDelete(true)} className="p-2 text-gray-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {/* Plant info card */}
        <div className="px-4 pt-4">
          <div className="bg-green-50 rounded-2xl p-4 flex items-center gap-4">
            {plant.lastScore !== undefined ? (
              <HealthRing score={plant.lastScore} size={70} />
            ) : (
              <div className="w-[70px] h-[70px] bg-gray-200 rounded-full flex items-center justify-center text-2xl">📷</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-500">{plant.genetics}</div>
              <div className="text-sm mt-1 flex flex-wrap gap-2">
                <span className="bg-white px-2 py-0.5 rounded-full text-xs">{phaseEmoji} {plant.phase}</span>
                <span className="bg-white px-2 py-0.5 rounded-full text-xs">{objEmoji} {plant.objective}</span>
                <span className="bg-white px-2 py-0.5 rounded-full text-xs">📅 Dia {plant.dayOfCycle}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-4 pt-4 grid grid-cols-2 gap-3">
          <button onClick={onCamera} className="bg-[#2E7D32] text-white py-3 rounded-2xl font-medium flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform">
            📷 Sacar foto
          </button>
          <button onClick={onFeeding} className="bg-blue-500 text-white py-3 rounded-2xl font-medium flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform">
            💧 Feeding
          </button>
          <button onClick={onInsights} className="bg-purple-500 text-white py-3 rounded-2xl font-medium flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform col-span-2">
            🧠 Insights IA {insights ? `· actualizado ${new Date(insights.generatedAt).toLocaleDateString("es-AR")}` : "· generar"}
          </button>
        </div>

        {/* Próxima recomendación de feeding (si existe) */}
        {insights?.nextFeedingRecommendation?.what && (
          <div className="px-4 pt-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Próximo riego sugerido</h3>
                <span className="text-[10px] bg-white text-emerald-700 px-2 py-0.5 rounded-full">{insights.nextFeedingRecommendation.when}</span>
              </div>
              <p className="text-sm text-gray-800">{insights.nextFeedingRecommendation.what}</p>
              <p className="text-xs text-gray-500 mt-1 italic">{insights.nextFeedingRecommendation.why}</p>
            </div>
          </div>
        )}

        {/* Last diagnosis */}
        {lastPhoto && (
          <div className="px-4 pt-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">ULTIMO DIAGNOSTICO</h3>
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-sm text-gray-700 leading-relaxed">{lastPhoto.analysis.diagnosis}</p>
              {lastPhoto.analysis.recommendations.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {lastPhoto.analysis.recommendations.slice(0, 3).map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">→</span>
                      <span className="text-sm text-gray-600">{r}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 text-xs text-gray-400">
                Confianza: {lastPhoto.analysis.confidence} · {new Date(lastPhoto.timestamp).toLocaleDateString("es-AR")}
              </div>
            </div>
          </div>
        )}

        {/* Photo timeline */}
        <div className="px-4 pt-5 pb-4">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">TIMELINE DE FOTOS ({photos.length})</h3>
          {photos.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-3xl mb-2">📷</div>
              <p className="text-sm">Saca la primera foto para empezar el timeline</p>
            </div>
          ) : (
            <div className="space-y-3">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  onClick={() => onPhotoClick(photo.id)}
                  className="flex gap-3 bg-gray-50 rounded-2xl p-3 active:bg-gray-100 transition-colors"
                >
                  <img src={photo.thumbnail || photo.dataUrl} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">{new Date(photo.timestamp).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      <span className={`text-sm font-bold ${photo.analysis.healthScore >= 70 ? "text-green-600" : photo.analysis.healthScore >= 45 ? "text-yellow-600" : "text-red-600"}`}>
                        {photo.analysis.healthScore}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{photo.analysis.diagnosis}</p>
                    <div className="flex gap-2 mt-1.5">
                      <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">🟢 {photo.analysis.greenRatio}%</span>
                      <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">🟡 {photo.analysis.yellowRatio}%</span>
                      <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">🟤 {photo.analysis.brownRatio}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feedings history */}
        {feedings.length > 0 && (
          <div className="px-4 pb-4">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">FEEDINGS ({feedings.length})</h3>
            <div className="space-y-2">
              {feedings.slice(0, 6).map((f) => {
                const phDelta = f.phRunoff !== undefined && f.phIn !== undefined ? f.phRunoff - f.phIn : null;
                const ecDelta = f.ecRunoff !== undefined && f.ecIn !== undefined ? f.ecRunoff - f.ecIn : null;
                return (
                  <div key={f.id} className="bg-blue-50 rounded-2xl p-3 text-sm border border-blue-100">
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-semibold text-blue-900">💧 {f.volumeMl}ml · {f.nutrients || "agua"}</div>
                      <span className="text-xs text-gray-400">{new Date(f.timestamp).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {f.phIn !== undefined && (
                        <span className="text-[11px] bg-white border border-blue-200 text-blue-800 px-2 py-0.5 rounded-full">pH in {f.phIn}</span>
                      )}
                      {f.ecIn !== undefined && (
                        <span className="text-[11px] bg-white border border-blue-200 text-blue-800 px-2 py-0.5 rounded-full">EC in {f.ecIn}</span>
                      )}
                      {f.phRunoff !== undefined && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${phDelta !== null && Math.abs(phDelta) > 0.5 ? "bg-yellow-50 border-yellow-300 text-yellow-800" : "bg-white border-blue-200 text-blue-800"}`}>
                          pH out {f.phRunoff}{phDelta !== null ? ` (${phDelta > 0 ? "+" : ""}${phDelta.toFixed(1)})` : ""}
                        </span>
                      )}
                      {f.ecRunoff !== undefined && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${ecDelta !== null && ecDelta > 0.5 ? "bg-orange-50 border-orange-300 text-orange-800" : "bg-white border-blue-200 text-blue-800"}`}>
                          EC out {f.ecRunoff}{ecDelta !== null ? ` (${ecDelta > 0 ? "+" : ""}${ecDelta.toFixed(2)})` : ""}
                        </span>
                      )}
                    </div>
                    {f.notes && <div className="text-xs text-gray-600 mt-2">{f.notes}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Check-in history */}
        {checkins.length > 0 && (
          <div className="px-4 pb-8">
            <h3 className="text-sm font-semibold text-gray-500 mb-3">HISTORIAL DE CHECK-INS</h3>
            <div className="space-y-2">
              {checkins.slice(0, 5).map((ci) => (
                <div key={ci.id} className="bg-blue-50 rounded-xl p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{ci.watered ? "💧 Regada" : "🚫 Sin riego"}</span>
                    <span className="text-xs text-gray-400">{new Date(ci.timestamp).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  {ci.waterAmount && <div className="text-xs text-gray-500 mt-1">Cantidad: {ci.waterAmount} · pH: {ci.waterPh || "N/A"}</div>}
                  {ci.notes && <div className="text-xs text-gray-600 mt-1">{ci.notes}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50 p-4" onClick={() => setShowDelete(false)}>
          <div className="bg-white rounded-2xl w-full p-5 slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">Eliminar planta</h3>
            <p className="text-gray-500 mb-4">Se van a borrar {plant.name} y todas sus fotos y check-ins. Esta accion no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDelete(false)} className="flex-1 py-3 rounded-xl bg-gray-100 font-medium">Cancelar</button>
              <button onClick={() => onDeletePlant(plant.id)} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CAMERA VIEW ───
function CameraView({ plant, lastFeeding, onCapture, onBack }: {
  plant: Plant;
  lastFeeding: Feeding | null;
  onCapture: (photo: Photo) => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{ photo: Photo; dataUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isLevel, setIsLevel] = useState(false);

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    try {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
      setError(null);
    } catch {
      setError("No se pudo acceder a la camara. Asegurate de dar permisos.");
    }
  }, [stream]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gyroscope for level detection
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      const beta = Math.abs(e.beta ?? 0);
      const gamma = Math.abs(e.gamma ?? 0);
      // Phone is relatively flat (pointing down) when beta < 30 and gamma < 30
      setIsLevel(beta < 30 && gamma < 30);
    };
    window.addEventListener("deviceorientation", handleOrientation);
    return () => window.removeEventListener("deviceorientation", handleOrientation);
  }, []);

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    setAnalyzing(true);

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const thumbnail = await createThumbnail(dataUrl);

    // Construir contexto para Gemini
    const plantContext: Record<string, unknown> = {
      genetics: plant.genetics,
      phase: plant.phase,
      dayOfCycle: plant.dayOfCycle,
      objective: plant.objective,
      previousScore: plant.lastScore,
    };
    if (lastFeeding) {
      const hoursAgo = Math.round(
        (Date.now() - new Date(lastFeeding.timestamp).getTime()) / (1000 * 60 * 60)
      );
      plantContext.lastFeeding = {
        nutrients: lastFeeding.nutrients,
        npk: lastFeeding.npkRatio,
        phIn: lastFeeding.phIn,
        ecIn: lastFeeding.ecIn,
        phRunoff: lastFeeding.phRunoff,
        ecRunoff: lastFeeding.ecRunoff,
        hoursAgo,
      };
    }

    const analysis = await analyzeWithGemini(dataUrl, plantContext);

    const photo: Photo = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      plantId: plant.id,
      dataUrl,
      thumbnail,
      timestamp: new Date().toISOString(),
      analysis,
    };

    setResult({ photo, dataUrl });
    setAnalyzing(false);
  };

  const flipCamera = () => {
    const newFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newFacing);
    startCamera(newFacing);
  };

  const confirmPhoto = () => {
    if (result) {
      onCapture(result.photo);
      stream?.getTracks().forEach((t) => t.stop());
      onBack();
    }
  };

  const retakePhoto = () => {
    setResult(null);
  };

  // Show result screen
  if (result) {
    const { photo, dataUrl } = result;
    const a = photo.analysis;
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <Header title="Resultado del analisis" onBack={retakePhoto} />
        <div className="flex-1 overflow-y-auto">
          <div className="relative">
            <img src={dataUrl} alt="" className="w-full" />
            <div className="absolute bottom-3 right-3">
              <HealthRing score={a.healthScore} size={70} />
            </div>
          </div>

          <div className="px-4 py-4 space-y-4 slide-up">
            {/* Score bars */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Verde</div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: `${a.greenRatio}%` }} />
                </div>
                <div className="text-xs font-medium text-green-600 mt-0.5">{a.greenRatio}%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Amarillo</div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${a.yellowRatio}%` }} />
                </div>
                <div className="text-xs font-medium text-yellow-600 mt-0.5">{a.yellowRatio}%</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Marron</div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-700 rounded-full" style={{ width: `${a.brownRatio}%` }} />
                </div>
                <div className="text-xs font-medium text-amber-700 mt-0.5">{a.brownRatio}%</div>
              </div>
            </div>

            {/* Diagnosis */}
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Diagnostico</h3>
                {a.source === "gemini" && (
                  <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">🧠 IA Gemini</span>
                )}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{a.diagnosis}</p>
              <div className="text-xs text-gray-400 mt-2">Confianza: {a.confidence}</div>
            </div>

            {/* Nutrient status (solo si viene de Gemini) */}
            {a.nutrientStatus && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Estado de nutrientes</h3>
                <div className="grid grid-cols-5 gap-2">
                  {(["nitrogen", "phosphorus", "potassium", "calcium", "magnesium"] as const).map((k) => {
                    const v = a.nutrientStatus![k];
                    const labels: Record<string, string> = { nitrogen: "N", phosphorus: "P", potassium: "K", calcium: "Ca", magnesium: "Mg" };
                    const colors: Record<NutrientLevel, string> = {
                      ok: "bg-green-100 text-green-700 border-green-200",
                      bajo: "bg-yellow-100 text-yellow-700 border-yellow-200",
                      alto: "bg-red-100 text-red-700 border-red-200",
                      desconocido: "bg-gray-100 text-gray-500 border-gray-200",
                    };
                    return (
                      <div key={k} className={`rounded-xl p-2 text-center border ${colors[v]}`}>
                        <div className="text-base font-bold">{labels[k]}</div>
                        <div className="text-[10px] uppercase">{v}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Detected (deficiencies, pests, diseases) */}
            {a.detected && (a.detected.deficiencies?.length || a.detected.pests?.length || a.detected.diseases?.length) ? (
              <div className="space-y-2">
                {a.detected.deficiencies?.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                    <div className="text-xs font-semibold text-yellow-800 mb-1">⚠️ Deficiencias detectadas</div>
                    <div className="text-sm text-yellow-900">{a.detected.deficiencies.join(", ")}</div>
                  </div>
                )}
                {a.detected.pests?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <div className="text-xs font-semibold text-red-800 mb-1">🐛 Plagas</div>
                    <div className="text-sm text-red-900">{a.detected.pests.join(", ")}</div>
                  </div>
                )}
                {a.detected.diseases?.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                    <div className="text-xs font-semibold text-orange-800 mb-1">🦠 Enfermedades</div>
                    <div className="text-sm text-orange-900">{a.detected.diseases.join(", ")}</div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Recommendations */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Recomendaciones</h3>
              <div className="space-y-2">
                {a.recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 bg-green-50 rounded-xl p-3">
                    <span className="text-green-600 font-bold">→</span>
                    <span className="text-sm text-gray-700">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-8 pt-2 flex gap-3">
          <button onClick={retakePhoto} className="flex-1 py-4 rounded-2xl bg-gray-100 font-medium text-gray-700">
            Repetir
          </button>
          <button onClick={confirmPhoto} className="flex-1 py-4 rounded-2xl bg-[#2E7D32] text-white font-semibold shadow-lg">
            Guardar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* Camera header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <button onClick={() => { stream?.getTracks().forEach((t) => t.stop()); onBack(); }} className="text-white p-2">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div className="text-white text-sm font-medium">{plant.name}</div>
        <button onClick={flipCamera} className="text-white p-2">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>

      {/* Video feed */}
      <div className="flex-1 relative flex items-center justify-center">
        {error ? (
          <div className="text-white text-center px-8">
            <div className="text-4xl mb-4">📷</div>
            <p className="mb-4">{error}</p>
            <button onClick={() => startCamera(facingMode)} className="bg-white/20 px-6 py-3 rounded-xl">Reintentar</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            {/* Level indicator */}
            <div className={`absolute top-20 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isLevel ? "bg-green-500 text-white" : "bg-white/20 text-white/70"}`}>
              {isLevel ? "✓ Nivel OK" : "Inclina el cel hacia abajo"}
            </div>
            {/* Guide frame */}
            <div className="absolute inset-12 border-2 border-dashed border-white/30 rounded-2xl pointer-events-none" />
          </>
        )}
      </div>

      {/* Capture button */}
      <div className="absolute bottom-0 left-0 right-0 pb-10 pt-6 flex justify-center bg-gradient-to-t from-black/60 to-transparent">
        <button
          onClick={capturePhoto}
          disabled={analyzing || !!error}
          className="w-20 h-20 rounded-full border-4 border-white bg-white/20 active:bg-white/40 transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          {analyzing ? (
            <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-white" />
          )}
        </button>
      </div>
    </div>
  );
}

// ─── CHECK-IN VIEW ───
function CheckInView({ plant, onSave, onBack }: {
  plant: Plant;
  onSave: (ci: CheckIn) => void;
  onBack: () => void;
}) {
  const [watered, setWatered] = useState(false);
  const [waterAmount, setWaterAmount] = useState("");
  const [waterPh, setWaterPh] = useState("");
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    onSave({
      id: Date.now().toString(36),
      plantId: plant.id,
      timestamp: new Date().toISOString(),
      watered,
      waterAmount: waterAmount || undefined,
      waterPh: waterPh || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header title={`Check-in · ${plant.name}`} onBack={onBack} />
      <div className="flex-1 px-4 py-4 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">Regaste hoy?</label>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setWatered(true)}
              className={`py-4 rounded-xl text-base font-medium transition-all ${watered ? "bg-blue-500 text-white shadow-md" : "bg-gray-100 text-gray-600"}`}>
              💧 Si, regue
            </button>
            <button onClick={() => setWatered(false)}
              className={`py-4 rounded-xl text-base font-medium transition-all ${!watered ? "bg-gray-300 text-gray-700 shadow-md" : "bg-gray-100 text-gray-600"}`}>
              🚫 No
            </button>
          </div>
        </div>

        {watered && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Cantidad de agua</label>
              <input type="text" value={waterAmount} onChange={(e) => setWaterAmount(e.target.value)}
                placeholder="Ej: 500ml, 1L..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">pH del agua</label>
              <input type="text" value={waterPh} onChange={(e) => setWaterPh(e.target.value)}
                placeholder="Ej: 6.5"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Notas / Observaciones</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
            rows={3} placeholder="Algo que notes? Hojas raras, olor, bichos..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
        </div>
      </div>

      <div className="px-4 pb-8 pt-2">
        <button onClick={handleSave}
          className="w-full bg-[#2E7D32] text-white py-4 rounded-2xl text-lg font-semibold shadow-lg active:scale-[0.98] transition-all">
          Guardar check-in
        </button>
      </div>
    </div>
  );
}

// ─── FEEDING VIEW ───
function FeedingView({ plant, onSave, onBack }: {
  plant: Plant;
  onSave: (f: Feeding) => void;
  onBack: () => void;
}) {
  const [volumeMl, setVolumeMl] = useState<string>("");
  const [phIn, setPhIn] = useState<string>("");
  const [ecIn, setEcIn] = useState<string>("");
  const [nutrients, setNutrients] = useState<string>("");
  const [npkRatio, setNpkRatio] = useState<string>("");
  const [phRunoff, setPhRunoff] = useState<string>("");
  const [ecRunoff, setEcRunoff] = useState<string>("");
  const [runoffPercent, setRunoffPercent] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [showRunoff, setShowRunoff] = useState(false);

  const parseNum = (s: string): number | undefined => {
    const n = parseFloat(s.replace(",", "."));
    return isNaN(n) ? undefined : n;
  };

  const handleSave = () => {
    const vol = parseNum(volumeMl);
    if (!vol) return;
    onSave({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      plantId: plant.id,
      timestamp: new Date().toISOString(),
      volumeMl: vol,
      phIn: parseNum(phIn),
      ecIn: parseNum(ecIn),
      nutrients: nutrients.trim() || "agua sola",
      npkRatio: npkRatio.trim() || undefined,
      phRunoff: parseNum(phRunoff),
      ecRunoff: parseNum(ecRunoff),
      runoffPercent: parseNum(runoffPercent),
      notes: notes.trim() || undefined,
    });
  };

  const phDelta = parseNum(phRunoff) !== undefined && parseNum(phIn) !== undefined
    ? (parseNum(phRunoff)! - parseNum(phIn)!).toFixed(2)
    : null;
  const ecDelta = parseNum(ecRunoff) !== undefined && parseNum(ecIn) !== undefined
    ? (parseNum(ecRunoff)! - parseNum(ecIn)!).toFixed(2)
    : null;

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header title={`Feeding · ${plant.name}`} onBack={onBack} />
      <div className="flex-1 px-4 py-4 space-y-5 overflow-y-auto">
        <div className="bg-blue-50 rounded-2xl p-3 text-xs text-blue-900">
          💡 Registrá lo que entra y, si podés, lo que sale (runoff). Cuanto más completo, mejor van a ser las predicciones de la IA.
        </div>

        {/* INPUT */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Lo que entra</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Volumen (ml) *</label>
              <input
                type="number" inputMode="decimal" value={volumeMl} onChange={(e) => setVolumeMl(e.target.value)}
                placeholder="500"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">pH del agua</label>
                <input type="number" inputMode="decimal" step="0.1" value={phIn} onChange={(e) => setPhIn(e.target.value)} placeholder="6.3"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">EC (mS/cm)</label>
                <input type="number" inputMode="decimal" step="0.01" value={ecIn} onChange={(e) => setEcIn(e.target.value)} placeholder="1.2"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">Nutrientes / fertilizante</label>
              <input type="text" value={nutrients} onChange={(e) => setNutrients(e.target.value)}
                placeholder="Ej: BioBizz Grow 2ml/L + CalMag 1ml/L"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1.5">NPK (opcional)</label>
              <input type="text" value={npkRatio} onChange={(e) => setNpkRatio(e.target.value)}
                placeholder="Ej: 5-2-3"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* RUNOFF (toggle) */}
        <div>
          <button
            onClick={() => setShowRunoff(!showRunoff)}
            className="w-full flex items-center justify-between bg-gray-100 rounded-xl px-4 py-3 text-sm font-medium text-gray-700"
          >
            <span>💧 Runoff (lo que devuelve la planta)</span>
            <span className="text-gray-400">{showRunoff ? "▼" : "▶"}</span>
          </button>
          {showRunoff && (
            <div className="mt-3 space-y-3 bg-blue-50/50 rounded-2xl p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">pH runoff</label>
                  <input type="number" inputMode="decimal" step="0.1" value={phRunoff} onChange={(e) => setPhRunoff(e.target.value)} placeholder="5.9"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">EC runoff</label>
                  <input type="number" inputMode="decimal" step="0.01" value={ecRunoff} onChange={(e) => setEcRunoff(e.target.value)} placeholder="1.8"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">% de runoff (opcional)</label>
                <input type="number" inputMode="decimal" value={runoffPercent} onChange={(e) => setRunoffPercent(e.target.value)} placeholder="20"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              {(phDelta !== null || ecDelta !== null) && (
                <div className="bg-white rounded-xl p-3 border border-blue-200">
                  <div className="text-xs font-semibold text-blue-900 mb-1">Lectura</div>
                  {phDelta !== null && (
                    <div className="text-xs text-gray-700">
                      Δ pH: <span className={`font-bold ${Math.abs(parseFloat(phDelta)) > 0.5 ? "text-yellow-700" : "text-green-700"}`}>{parseFloat(phDelta) > 0 ? "+" : ""}{phDelta}</span>
                      {Math.abs(parseFloat(phDelta)) > 0.5 && " — drift importante, revisar buffer del sustrato"}
                    </div>
                  )}
                  {ecDelta !== null && (
                    <div className="text-xs text-gray-700">
                      Δ EC: <span className={`font-bold ${parseFloat(ecDelta) > 0.5 ? "text-orange-700" : parseFloat(ecDelta) < -0.3 ? "text-blue-700" : "text-green-700"}`}>{parseFloat(ecDelta) > 0 ? "+" : ""}{ecDelta}</span>
                      {parseFloat(ecDelta) > 0.5 && " — sales acumulándose, considerar flush"}
                      {parseFloat(ecDelta) < -0.3 && " — la planta consumió más sales de las que entraron"}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1.5">Notas</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="Algo que notes? Color de runoff, olor, etc..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
      </div>

      <div className="px-4 pb-8 pt-2">
        <button onClick={handleSave} disabled={!parseNum(volumeMl)}
          className="w-full bg-blue-500 text-white py-4 rounded-2xl text-lg font-semibold shadow-lg disabled:opacity-40 active:scale-[0.98] transition-all">
          Guardar feeding
        </button>
      </div>
    </div>
  );
}

// ─── INSIGHTS VIEW ───
function InsightsView({ plant, feedings, photos, existing, onUpdate, onBack }: {
  plant: Plant;
  feedings: Feeding[];
  photos: Photo[];
  existing?: PlantInsights;
  onUpdate: (i: PlantInsights) => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const insights = existing;

  const generate = async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPlantInsights(plant, feedings, photos);
    setLoading(false);
    if (result) {
      onUpdate(result);
    } else {
      setError("No se pudo generar el análisis. Verificá que GEMINI_API_KEY esté configurada y que tengas al menos 1 foto y 1 feeding registrados.");
    }
  };

  const dirEmoji = insights?.trends?.healthDirection === "subiendo" ? "📈"
    : insights?.trends?.healthDirection === "bajando" ? "📉" : "➡️";

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header title={`Insights · ${plant.name}`} onBack={onBack} />
      <div className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
        <button onClick={generate} disabled={loading}
          className="w-full bg-purple-500 text-white py-3 rounded-2xl font-semibold shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Analizando con Gemini...
            </>
          ) : (
            <>🧠 {insights ? "Regenerar análisis" : "Generar análisis con IA"}</>
          )}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">{error}</div>
        )}

        {!insights && !loading && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-5xl mb-3">🧠</div>
            <p className="text-sm">Cargá feedings y fotos primero. La IA va a buscar patrones, predecir problemas y recomendar el próximo riego.</p>
            <div className="text-xs mt-3 text-gray-400">Datos disponibles: {feedings.length} feedings · {photos.length} fotos</div>
          </div>
        )}

        {insights && (
          <>
            {/* Resumen */}
            <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-purple-700 mb-2">Resumen</h3>
              <p className="text-sm text-gray-800 leading-relaxed">{insights.summary}</p>
              <div className="text-[10px] text-gray-400 mt-2">Generado {new Date(insights.generatedAt).toLocaleString("es-AR")}</div>
            </div>

            {/* Tendencias */}
            <div className="bg-gray-50 rounded-2xl p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Tendencias {dirEmoji}</h3>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium text-gray-700">Salud:</span> <span className="text-gray-600 capitalize">{insights.trends.healthDirection}</span></div>
                {insights.trends.phDrift && <div><span className="font-medium text-gray-700">pH:</span> <span className="text-gray-600">{insights.trends.phDrift}</span></div>}
                {insights.trends.ecDrift && <div><span className="font-medium text-gray-700">EC:</span> <span className="text-gray-600">{insights.trends.ecDrift}</span></div>}
                {insights.trends.recurringIssues?.length > 0 && (
                  <div>
                    <div className="font-medium text-gray-700 mb-1">Problemas recurrentes:</div>
                    <ul className="list-disc list-inside text-gray-600 space-y-0.5">
                      {insights.trends.recurringIssues.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Respuesta a feedings */}
            {insights.feedingResponse?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Respuesta a feedings recientes</h3>
                <div className="space-y-2">
                  {insights.feedingResponse.slice(0, 5).map((fr, i) => {
                    const verdictColor = fr.verdict === "positivo" ? "bg-green-50 border-green-200 text-green-800"
                      : fr.verdict === "negativo" ? "bg-red-50 border-red-200 text-red-800"
                      : "bg-gray-50 border-gray-200 text-gray-700";
                    return (
                      <div key={i} className={`rounded-xl border p-3 ${verdictColor}`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] uppercase font-semibold">{fr.verdict}</span>
                          <span className="text-[10px] text-gray-500">{new Date(fr.feedingDate).toLocaleDateString("es-AR")}</span>
                        </div>
                        <p className="text-xs">{fr.responseObserved}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Forecast */}
            <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-700 mb-2">Predicción</h3>
              <div className="space-y-2 text-sm text-gray-800">
                {insights.forecast.next3Days && (
                  <div><span className="font-medium">3 días:</span> {insights.forecast.next3Days}</div>
                )}
                {insights.forecast.next7Days && (
                  <div><span className="font-medium">7 días:</span> {insights.forecast.next7Days}</div>
                )}
                {insights.forecast.risks?.length > 0 && (
                  <div>
                    <div className="font-medium mt-2">⚠️ Riesgos:</div>
                    <ul className="list-disc list-inside text-gray-700 space-y-0.5">
                      {insights.forecast.risks.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Próximo feeding */}
            {insights.nextFeedingRecommendation?.what && (
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">
                  Próximo feeding {insights.nextFeedingRecommendation.when && `· ${insights.nextFeedingRecommendation.when}`}
                </h3>
                <p className="text-sm text-gray-800 font-medium">{insights.nextFeedingRecommendation.what}</p>
                <p className="text-xs text-gray-600 mt-1 italic">{insights.nextFeedingRecommendation.why}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── PHOTO DETAIL VIEW ───
function PhotoDetailView({ photo, plant, onBack }: {
  photo: Photo;
  plant: Plant;
  onBack: () => void;
}) {
  if (!photo || !plant) return null;
  const a = photo.analysis;

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Header title={`${plant.name} · ${new Date(photo.timestamp).toLocaleDateString("es-AR")}`} onBack={onBack} />
      <div className="flex-1 overflow-y-auto">
        <div className="relative">
          <img src={photo.dataUrl} alt="" className="w-full" />
          <div className="absolute bottom-3 right-3">
            <HealthRing score={a.healthScore} size={70} />
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-green-600">{a.greenRatio}%</div>
              <div className="text-xs text-gray-500">Verde</div>
            </div>
            <div className="bg-yellow-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-yellow-600">{a.yellowRatio}%</div>
              <div className="text-xs text-gray-500">Amarillo</div>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-amber-700">{a.brownRatio}%</div>
              <div className="text-xs text-gray-500">Marron</div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Diagnostico</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{a.diagnosis}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Recomendaciones</h3>
            {a.recommendations.map((r, i) => (
              <div key={i} className="flex items-start gap-2 mb-2">
                <span className="text-green-600 mt-0.5 font-bold">→</span>
                <span className="text-sm text-gray-700">{r}</span>
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-400 pb-4">
            Capturada: {new Date(photo.timestamp).toLocaleString("es-AR")} · Confianza: {a.confidence}
          </div>
        </div>
      </div>
    </div>
  );
}
