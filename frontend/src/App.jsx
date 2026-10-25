import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Viewer3D from "./Viewer3D";
import { Icon } from "./icons";
import Drawer from "./components/ui/Drawer";
import SelectField from "./components/ui/SelectField";
import Switch from "./components/ui/Switch";
import TabSwitch from "./components/ui/TabSwitch";
import Toast from "./components/ui/Toast";
import UpdateCenter from "./components/ui/UpdateCenter";
import LanguagePicker from "./components/ui/LanguagePicker";
import SplashScreen from "./components/ui/SplashScreen";
import { translate } from "./i18n";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import EmptyState from "./components/ui/EmptyState";

const PALETTE = {
  yellow: { label: "Sarı", hex: "#f0ca55" },
  pink: { label: "Pembe", hex: "#ec91b9" },
  darkpink: { label: "Koyu pembe", hex: "#bb668d" },
  white: { label: "Beyaz", hex: "#e9e8e4" },
  black: { label: "Siyah", hex: "#343434" },
  blue: { label: "Turkuaz", hex: "#65c5cf" },
  brown: { label: "Kahverengi", hex: "#916b51" },
  other: { label: "Diğer", hex: "#a4a29c" },
};
const FACES = {
  "x+": "sağ",
  "x-": "sol",
  "y+": "üst",
  "y-": "alt",
  "z+": "ön",
  "z-": "arka",
};
const EN_FACES = {
  "x+": "right",
  "x-": "left",
  "y+": "top",
  "y-": "bottom",
  "z+": "front",
  "z-": "back",
};
const EN_COLORS = {
  yellow: "Yellow",
  pink: "Pink",
  darkpink: "Dark pink",
  white: "White",
  black: "Black",
  blue: "Turquoise",
  brown: "Brown",
  other: "Other",
};
const FACTOR_OPTIONS = [
  { value: "2", label: "2 · Çok detaylı" },
  { value: "3", label: "3 · Detaylı" },
  { value: "4", label: "4 · Dengeli" },
  { value: "5", label: "5 · Sade" },
  { value: "6", label: "6 · Daha sade" },
  { value: "7", label: "7 · En sade" },
];
const nf = new Intl.NumberFormat("tr-TR");
const cm = (n) =>
  Number.isInteger(Number(n))
    ? String(Number(n))
    : Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 2 });

async function api(path, options = {}) {
  const response = await fetch(path, options);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Sunucudan geçersiz yanıt geldi.");
  }
  if (!response.ok) throw new Error(data.error || `Hata ${response.status}`);
  return data;
}

export default function App() {
  const [theme, setTheme] = useState(
      () =>
        localStorage.getItem("pixelpath-theme") ||
        localStorage.getItem("voxel-theme") ||
        "light",
    ),
    [language, setLanguage] = useState(
      () =>
        localStorage.getItem("pixelpath-language") ||
        localStorage.getItem("voxel-language") ||
        "tr",
    ),
    [splashVisible, setSplashVisible] = useState(true);
  const [library, setLibrary] = useState([]),
    [model, setModel] = useState(null),
    [modelId, setModelId] = useState(null);
  const [step, setStep] = useState(1),
    [tab, setTab] = useState("build"),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState("");
  const [future, setFuture] = useState(false),
    [highlight, setHighlight] = useState(true),
    [follow, setFollow] = useState(
      () =>
        (localStorage.getItem("pixelpath-camera-follow") ||
          localStorage.getItem("voxel-camera-follow")) === "true",
    ),
    [rotating, setRotating] = useState(false);
  const [importOpen, setImportOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [sideOpen, setSideOpen] = useState(false),
    [guideOpen, setGuideOpen] = useState(false),
    [languageOpen, setLanguageOpen] = useState(false);
  const [file, setFile] = useState(null),
    [importName, setImportName] = useState("Yeni Model"),
    [factor, setFactor] = useState("5"),
    [cube, setCube] = useState("2"),
    [algorithm, setAlgorithm] = useState("cube"),
    [hybridMin, setHybridMin] = useState("100"),
    [hybridTarget, setHybridTarget] = useState("130"),
    [hybridMax, setHybridMax] = useState("150"),
    [hybridPriority, setHybridPriority] = useState("balanced");
  const [formBusy, setFormBusy] = useState(false),
    [formError, setFormError] = useState("");
  const viewer = useRef(null),
    saveTimer = useRef(null),
    fileInput = useRef(null);
  const t = useMemo(() => translate(language), [language]);
  const factorOptions = useMemo(
    () =>
      language === "en"
        ? [
            { value: "2", label: "2 · Very detailed" },
            { value: "3", label: "3 · Detailed" },
            { value: "4", label: "4 · Balanced" },
            { value: "5", label: "5 · Simple" },
            { value: "6", label: "6 · Simpler" },
            { value: "7", label: "7 · Simplest" },
          ]
        : FACTOR_OPTIONS,
    [language],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("pixelpath-theme", theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem("pixelpath-language", language);
  }, [language]);
  useEffect(() => {
    localStorage.setItem("pixelpath-camera-follow", String(follow));
  }, [follow]);
  useEffect(() => {
    if (busy) return;
    const timer = setTimeout(() => setSplashVisible(false), 900);
    return () => clearTimeout(timer);
  }, [busy]);

  const refresh = useCallback(async () => {
    const data = await api("/api/models");
    setLibrary(data.models);
    return data.models;
  }, []);
  const openModel = useCallback(async (id) => {
    setBusy(true);
    setMessage("");
    try {
      const data = await api(`/api/models/${id}`);
      setModel(data);
      setModelId(id);
      setStep(Math.min(Math.max(1, data.last_step || 1), data.piece_count));
      setSideOpen(false);
      setGuideOpen(false);
      setTab("build");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const items = await refresh();
        if (items.length) await openModel(items[0].id);
        else setBusy(false);
      } catch (error) {
        setMessage(error.message);
        setBusy(false);
      }
    })();
  }, [refresh, openModel]);
  useEffect(() => {
    if (!modelId || !model) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      () =>
        api(`/api/models/${modelId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step }),
        }).catch(() => {}),
      500,
    );
    return () => clearTimeout(saveTimer.current);
  }, [step, modelId, model]);
  useEffect(() => {
    const key = (e) => {
      if (
        e.target.closest("input,textarea,select") ||
        importOpen ||
        settingsOpen ||
        tab !== "build" ||
        !model
      )
        return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setStep((s) => Math.min(model.piece_count, s + 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setStep((s) => Math.max(1, s - 1));
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [model, tab, importOpen, settingsOpen]);

  const piece = model?.pieces?.[step - 1],
    color = PALETTE[piece?.color] || PALETTE.other;
  const pieceSize = piece?.size || 1;
  const pieceDimensions = [
    piece?.sx || pieceSize,
    piece?.sy || pieceSize,
    piece?.sz || pieceSize,
  ];
  const colorLabel =
    language === "en"
      ? EN_COLORS[piece?.color] || EN_COLORS.other
      : color.label;
  const faceLabel =
    language === "en"
      ? EN_FACES[piece?.face] || piece?.face
      : FACES[piece?.face] || piece?.face;
  const progress = model ? (step / model.piece_count) * 100 : 0;
  const dimensions = model?.dimensions
    .map((d) => cm(d * model.cube_cm))
    .join(" × ");
  const colors = useMemo(
    () => (model ? new Set(model.materials.map((x) => x.color)).size : 0),
    [model],
  );
  const go = (n) =>
    model && setStep(Math.min(model.piece_count, Math.max(1, Math.round(n))));
  const toggleRotate = () =>
    setRotating((value) => {
      viewer.current?.setRotating(!value);
      return !value;
    });

  const pickFile = (selected) => {
    if (!selected) return;
    if (!/\.(schem|csv)$/i.test(selected.name)) {
      setFormError("Lütfen .schem veya .csv dosyası seç.");
      return;
    }
    setFile(selected);
    setImportName(selected.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    setFormError("");
  };
  const resetImport = () => {
    setFile(null);
    setImportName("Yeni Model");
    setFactor("5");
    setCube("2");
    setAlgorithm("cube");
    setHybridMin("100");
    setHybridTarget("130");
    setHybridMax("150");
    setHybridPriority("balanced");
    setFormError("");
    setImportOpen(true);
  };
  const submitImport = async () => {
    if (!file) {
      setFormError("Önce bir model dosyası seç.");
      return;
    }
    setFormBusy(true);
    setFormError("");
    try {
      const params = new URLSearchParams({
        name: importName || "Yeni Model",
        filename: file.name,
        factor,
        cube_cm: cube,
        algorithm,
        hybrid_min: hybridMin,
        hybrid_target: hybridTarget,
        hybrid_max: hybridMax,
        hybrid_priority: hybridPriority,
      });
      const out = await api(`/api/models/import?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: await file.arrayBuffer(),
      });
      await refresh();
      await openModel(out.id);
      setImportOpen(false);
      setMessage(`${nf.format(out.piece_count)} parçalık model hazır.`);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setFormBusy(false);
    }
  };
  const openSettings = () => {
    if (!model) return;
    setImportName(model.name);
    setFactor(String(model.factor || 5));
    setCube(String(model.cube_cm));
    setAlgorithm(model.algorithm || "cube");
    setHybridMin(String(model.hybrid?.minimum || 100));
    setHybridTarget(String(model.hybrid?.requested_target || 130));
    setHybridMax(String(model.hybrid?.maximum || 150));
    setHybridPriority(model.hybrid?.priority || "balanced");
    setFormError("");
    setSettingsOpen(true);
  };
  const saveSettings = async () => {
    setFormBusy(true);
    setFormError("");
    try {
      await api(`/api/models/${modelId}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: importName,
          factor,
          cube_cm: cube,
          algorithm,
          hybrid_min: hybridMin,
          hybrid_target: hybridTarget,
          hybrid_max: hybridMax,
          hybrid_priority: hybridPriority,
        }),
      });
      await refresh();
      await openModel(modelId);
      setSettingsOpen(false);
      setMessage(t("updated"));
    } catch (error) {
      setFormError(error.message);
    } finally {
      setFormBusy(false);
    }
  };
  const deleteModel = async () => {
    if (
      !confirm(
        `“${model.name}” modelini ve kayıtlı ilerlemesini silmek istiyor musun?`,
      )
    )
      return;
    setFormBusy(true);
    try {
      await api(`/api/models/${modelId}`, { method: "DELETE" });
      const items = await refresh();
      setSettingsOpen(false);
      if (items.length) await openModel(items[0].id);
      else {
        setModel(null);
        setModelId(null);
      }
      setMessage("Model silindi.");
    } catch (error) {
      setFormError(error.message);
    } finally {
      setFormBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar
        open={sideOpen}
        onToggle={() => setSideOpen((value) => !value)}
        onNewModel={() => {
          resetImport();
          setSideOpen(false);
        }}
        library={library}
        modelId={modelId}
        busy={busy}
        onOpenModel={openModel}
        formatNumber={nf}
        language={language}
        onLanguagePicker={() => setLanguageOpen(true)}
        t={t}
      />
      <main className="main">
        <Topbar
          model={model}
          tab={tab}
          onTab={setTab}
          guideOpen={guideOpen}
          onGuide={() => setGuideOpen((value) => !value)}
          onSettings={openSettings}
          onMenu={() => setSideOpen(true)}
          t={t}
        />
        {busy && !model ? (
          <div className="center-state">
            <div className="spinner" />
            <p>{t("loading")}</p>
          </div>
        ) : !model ? (
          <EmptyState onAdd={resetImport} t={t} />
        ) : (
          <div className={`workspace ${tab === "build" ? "studio-mode" : ""}`}>
            <section className="page-heading">
              <div>
                <span className="overline">3D MONTAJ ÇALIŞMA ALANI</span>
                <h1>{model.name}</h1>
                <p>Küp küp ilerle. Her adımda yalnızca ihtiyacın olanı gör.</p>
              </div>
              <div className="headline-stats">
                <div>
                  <span>Parça</span>
                  <strong>{nf.format(model.piece_count)}</strong>
                </div>
                <i />
                <div>
                  <span>Boyut</span>
                  <strong>{dimensions} cm</strong>
                </div>
              </div>
            </section>
            <div className="tabs">
              <button
                className={tab === "build" ? "active" : ""}
                onClick={() => setTab("build")}
              >
                <Icon name="layers" size={16} />
                Montaj rehberi
              </button>
              <button
                className={tab === "materials" ? "active" : ""}
                onClick={() => setTab("materials")}
              >
                <Icon name="list" size={16} />
                Malzeme listesi
              </button>
            </div>
            {tab === "build" ? (
              <div className="build-layout">
                <section className="viewer-card card">
                  <div className="viewer-toolbar">
                    <div className="viewer-actions">
                      <button
                        onClick={() => viewer.current?.focusBuilt()}
                        aria-label={t("fitBuilt")}
                        data-tooltip={t("fitBuilt")}
                      >
                        <Icon name="target" />
                      </button>
                      <button
                        onClick={() => viewer.current?.focusAll()}
                        aria-label={t("fitAll")}
                        data-tooltip={t("fitAll")}
                      >
                        <Icon name="expand" />
                      </button>
                      <button
                        className={rotating ? "active" : ""}
                        onClick={toggleRotate}
                        aria-label={t("autoRotate")}
                        data-tooltip={t("autoRotate")}
                      >
                        <Icon name="rotate" />
                      </button>
                    </div>
                  </div>
                  <div className="viewer-wrap">
                    <Viewer3D
                      ref={viewer}
                      model={model}
                      step={step}
                      showFuture={future}
                      highlight={highlight}
                      follow={follow}
                      onSelect={go}
                      theme={theme}
                    />
                    <div className="step-overlay">
                      <span>{t("step").toUpperCase()}</span>
                      <b>{step}</b>
                      <small>/ {model.piece_count}</small>
                    </div>
                    <div className="viewer-hint">{t("viewerHint")}</div>
                  </div>
                  <div className="viewer-options">
                    <Switch
                      checked={future}
                      onChange={setFuture}
                      label={t("ghost")}
                      help={t("ghostHelp")}
                    />
                    <Switch
                      checked={follow}
                      onChange={setFollow}
                      label={t("smartCamera")}
                      help={t("smartCameraHelp")}
                    />
                  </div>
                </section>
                <aside className={`guide-card card ${guideOpen ? "open" : ""}`}>
                  <div className="guide-panel-head">
                    <div>
                      <span className="overline">
                        {t("assemblyGuide").toUpperCase()}
                      </span>
                      <b>{t("stepByStep")}</b>
                    </div>
                    <button
                      onClick={() => setGuideOpen(false)}
                      aria-label={t("closeAssembly")}
                    >
                      <Icon name="x" size={18} />
                    </button>
                  </div>
                  <div className="guide-progress">
                    <div>
                      <span>{t("progress").toUpperCase()}</span>
                      <strong>%{Math.round(progress)}</strong>
                    </div>
                    <div className="progress-track">
                      <i style={{ width: `${progress}%` }} />
                    </div>
                    <input
                      type="range"
                      min="1"
                      max={model.piece_count}
                      value={step}
                      onChange={(e) => go(Number(e.target.value))}
                    />
                  </div>
                  <div className="guide-body">
                    <span className="overline">
                      {t("addNow").toUpperCase()}
                    </span>
                    <div className="part-card">
                      <span
                        className="part-swatch"
                        style={{ background: color.hex }}
                      />
                      <span>
                        <strong>
                          {colorLabel} {t("cube")}
                        </strong>
                        <small>
                          {t("piece")} #{piece.id}
                        </small>
                      </span>
                      <b>
                        {pieceDimensions
                          .map((value) => cm(value * model.cube_cm))
                          .join(" × ")}{" "}
                        cm
                      </b>
                    </div>
                    <div className="metrics">
                      <div>
                        <span>{t("edgeLength")}</span>
                        <b>
                          {pieceDimensions
                            .map((value) => cm(value * model.cube_cm))
                            .join(" × ")}{" "}
                          cm
                        </b>
                      </div>
                      <div>
                        <span>{t("position")}</span>
                        <b>
                          {cm(piece.x * model.cube_cm)} ·{" "}
                          {cm(piece.y * model.cube_cm)} ·{" "}
                          {cm(piece.z * model.cube_cm)}
                        </b>
                      </div>
                    </div>
                    <div className="instruction">
                      <span>
                        <Icon name="target" size={18} />
                      </span>
                      <div>
                        <small>{t("attachWhere").toUpperCase()}</small>
                        <b>
                          {piece.anchor == null
                            ? t("startPiece")
                            : t("joinPiece").replace("{id}", piece.anchor)}
                        </b>
                        <p>
                          {piece.anchor == null
                            ? t("placeOnSurface")
                            : t("contactInstruction")
                                .replace("{face}", faceLabel)
                                .replace(
                                  "{area}",
                                  cm(
                                    piece.area * model.cube_cm * model.cube_cm,
                                  ),
                                )}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={highlight}
                      onChange={setHighlight}
                      label={t("highlightPiece")}
                    />
                  </div>
                  <div className="guide-footer">
                    <div className="step-buttons">
                      <button
                        className="button secondary"
                        disabled={step === 1}
                        onClick={() => go(step - 1)}
                      >
                        <Icon name="arrowLeft" />
                        {t("previous")}
                      </button>
                      <button
                        className="button primary"
                        disabled={step === model.piece_count}
                        onClick={() => go(step + 1)}
                      >
                        {t("next")}
                        <Icon name="arrowRight" />
                      </button>
                    </div>
                    <div className="jump-links">
                      <button onClick={() => go(1)}>{t("firstStep")}</button>
                      <span>{t("keyboardHint")}</span>
                      <button onClick={() => go(model.piece_count)}>
                        {t("lastStep")}
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            ) : (
              <section className="materials card">
                <div className="materials-title">
                  <div>
                    <span className="overline">ÜRETİM PLANI</span>
                    <h2>Malzeme listesi</h2>
                    <p>
                      Küpleri üretime başlamadan önce renk ve boyuta göre
                      hazırla.
                    </p>
                  </div>
                  <div className="production-actions">
                    <a
                      className="button secondary"
                      href={`/api/models/${modelId}/export.csv`}
                      download
                    >
                      <Icon name="download" />
                      CSV indir
                    </a>
                    <a
                      className="button primary"
                      href={`/api/models/${modelId}/production.zip`}
                      download
                    >
                      <Icon name="download" />
                      {t("productionZip")}
                    </a>
                  </div>
                </div>
                <div className="material-stats">
                  <div>
                    <span>Toplam parça</span>
                    <b>{nf.format(model.piece_count)}</b>
                  </div>
                  <div>
                    <span>Renk sayısı</span>
                    <b>{colors}</b>
                  </div>
                  <div>
                    <span>Model ölçüsü</span>
                    <b>{dimensions} cm</b>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Renk</th>
                        <th>Tip</th>
                        <th>Parça ölçüsü</th>
                        <th>Adet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...model.materials]
                        .sort((a, b) => b.count - a.count)
                        .map((row, i) => (
                          <tr key={`${row.color}-${row.edge_cm}-${i}`}>
                            <td>
                              <span className="color-name">
                                <i style={{ background: row.hex }} />
                                {row.label}
                              </span>
                            </td>
                            <td>
                              {row.sx === row.sy && row.sy === row.sz
                                ? "Küp"
                                : "Dikdörtgen"}
                            </td>
                            <td>
                              {cm((row.sx || row.size) * model.cube_cm)} ×{" "}
                              {cm((row.sy || row.size) * model.cube_cm)} ×{" "}
                              {cm((row.sz || row.size) * model.cube_cm)} cm
                            </td>
                            <td>
                              <b className="count">{nf.format(row.count)}</b>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            <p className="footnote">
              Montaj sırası yüzey temasına göre hesaplanır. Yapıştırma
              sağlamlığını ve gerçek montaj erişimini küçük bir denemeyle
              kontrol et.
            </p>
          </div>
        )}
      </main>
      <Toast message={message} onClose={() => setMessage("")} />
      <UpdateCenter t={t} />
      <LanguagePicker
        open={languageOpen}
        value={language}
        onChange={setLanguage}
        onClose={() => setLanguageOpen(false)}
        t={t}
      />
      <SplashScreen visible={splashVisible} />
      <Drawer
        open={importOpen}
        title="Yeni model"
        onClose={() => !formBusy && setImportOpen(false)}
      >
        <div className="dialog-head">
          <div>
            <span className="overline">YENİ PROJE</span>
            <h2>Modelini içeri aktar</h2>
            <p>Dosyanı seç, gerisini PixelPath hazırlasın.</p>
          </div>
          <button className="icon-close" onClick={() => setImportOpen(false)}>
            <Icon name="x" />
          </button>
        </div>
        <button
          className={`dropzone ${file ? "has-file" : ""}`}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pickFile(e.dataTransfer.files[0]);
          }}
        >
          <input
            ref={fileInput}
            type="file"
            hidden
            accept=".schem,.csv"
            onChange={(e) => pickFile(e.target.files[0])}
          />
          <span>
            <Icon name={file ? "check" : "upload"} size={24} />
          </span>
          <b>{file ? file.name : "Dosyanı buraya bırak"}</b>
          <small>
            {file
              ? "Dosya hazır · değiştirmek için tıkla"
              : ".schem veya pieces.csv · en fazla 30 MB"}
          </small>
        </button>
        <div className="form-grid drawer-form">
          <label className="wide">
            Model adı
            <input
              value={importName}
              maxLength="90"
              onChange={(e) => setImportName(e.target.value)}
            />
          </label>
          <label>
            Detay seviyesi
            <SelectField
              value={factor}
              disabled={Boolean(file && /\.csv$/i.test(file.name))}
              onChange={setFactor}
              options={factorOptions}
              label="Detay seviyesi"
            />
          </label>
          <label>
            Küp kenarı (cm)
            <input
              type="number"
              min=".2"
              max="20"
              step=".5"
              value={cube}
              onChange={(e) => setCube(e.target.value)}
            />
          </label>
          <label className="wide">
            {t("algorithm")}
            <SelectField
              value={algorithm}
              disabled={Boolean(file && /\.csv$/i.test(file.name))}
              onChange={setAlgorithm}
              options={[
                { value: "cube", label: t("cubeAlgorithm") },
                { value: "cuboid", label: t("cuboidAlgorithm") },
                { value: "hybrid", label: t("hybridAlgorithm") },
              ]}
              label={t("algorithm")}
            />
          </label>
          {algorithm === "hybrid" && (
            <div className="hybrid-settings wide">
              <span className="field-title">{t("hybridRange")}</span>
              <div className="hybrid-number-grid">
                <label>
                  {t("hybridMin")}
                  <input
                    type="number"
                    min="1"
                    max="2000"
                    value={hybridMin}
                    onChange={(e) => setHybridMin(e.target.value)}
                  />
                </label>
                <label>
                  {t("hybridTarget")}
                  <input
                    type="number"
                    min="1"
                    max="2000"
                    value={hybridTarget}
                    onChange={(e) => setHybridTarget(e.target.value)}
                  />
                </label>
                <label>
                  {t("hybridMax")}
                  <input
                    type="number"
                    min="1"
                    max="2000"
                    value={hybridMax}
                    onChange={(e) => setHybridMax(e.target.value)}
                  />
                </label>
              </div>
              <label>
                {t("hybridPriority")}
                <SelectField
                  value={hybridPriority}
                  onChange={setHybridPriority}
                  options={[
                    { value: "balanced", label: t("balancedPriority") },
                    { value: "cost", label: t("costPriority") },
                    { value: "assembly", label: t("assemblyPriority") },
                    { value: "detail", label: t("detailPriority") },
                  ]}
                  label={t("hybridPriority")}
                />
              </label>
            </div>
          )}
        </div>
        {formError && <p className="form-error">{formError}</p>}
        <div className="dialog-actions drawer-actions">
          <button
            className="button secondary"
            onClick={() => setImportOpen(false)}
          >
            Vazgeç
          </button>
          <button
            className="button primary"
            disabled={formBusy}
            onClick={submitImport}
          >
            {formBusy ? "Model hazırlanıyor…" : "Modeli oluştur"}
            <Icon name="arrowRight" />
          </button>
        </div>
      </Drawer>
      <Drawer
        open={settingsOpen}
        title={t("modelSettings")}
        onClose={() => !formBusy && setSettingsOpen(false)}
      >
        <div className="dialog-head">
          <div>
            <span className="overline">{t("modelSettings").toUpperCase()}</span>
            <h2>{t("editProject")}</h2>
            <p>{t("editProjectHelp")}</p>
          </div>
          <button className="icon-close" onClick={() => setSettingsOpen(false)}>
            <Icon name="x" />
          </button>
        </div>
        <div className="settings-identity">
          <span className="model-thumb">
            <Icon name="cube" size={19} />
          </span>
          <div>
            <b>{model?.name}</b>
            <small>
              {nf.format(model?.piece_count || 0)} parça · {dimensions} cm
            </small>
          </div>
        </div>
        <div className="form-grid settings-form drawer-form">
          <label className="wide">
            {t("modelName")}
            <input
              value={importName}
              maxLength="90"
              onChange={(e) => setImportName(e.target.value)}
            />
          </label>
          <label>
            {t("detail")}
            <SelectField
              value={factor}
              disabled={model?.factor == null}
              onChange={setFactor}
              options={factorOptions}
              label={t("detail")}
            />
          </label>
          <label>
            {t("cubeEdge")}
            <input
              type="number"
              min=".2"
              max="20"
              step=".5"
              value={cube}
              onChange={(e) => setCube(e.target.value)}
            />
          </label>
          <label className="wide">
            {t("algorithm")}
            <SelectField
              value={algorithm}
              disabled={model?.factor == null}
              onChange={setAlgorithm}
              options={[
                { value: "cube", label: t("cubeAlgorithm") },
                { value: "cuboid", label: t("cuboidAlgorithm") },
                { value: "hybrid", label: t("hybridAlgorithm") },
              ]}
              label={t("algorithm")}
            />
          </label>
          {algorithm === "hybrid" && (
            <div className="hybrid-settings wide">
              <span className="field-title">{t("hybridRange")}</span>
              <div className="hybrid-number-grid">
                <label>
                  {t("hybridMin")}
                  <input
                    type="number"
                    min="1"
                    max="2000"
                    value={hybridMin}
                    onChange={(e) => setHybridMin(e.target.value)}
                  />
                </label>
                <label>
                  {t("hybridTarget")}
                  <input
                    type="number"
                    min="1"
                    max="2000"
                    value={hybridTarget}
                    onChange={(e) => setHybridTarget(e.target.value)}
                  />
                </label>
                <label>
                  {t("hybridMax")}
                  <input
                    type="number"
                    min="1"
                    max="2000"
                    value={hybridMax}
                    onChange={(e) => setHybridMax(e.target.value)}
                  />
                </label>
              </div>
              <label>
                {t("hybridPriority")}
                <SelectField
                  value={hybridPriority}
                  onChange={setHybridPriority}
                  options={[
                    { value: "balanced", label: t("balancedPriority") },
                    { value: "cost", label: t("costPriority") },
                    { value: "assembly", label: t("assemblyPriority") },
                    { value: "detail", label: t("detailPriority") },
                  ]}
                  label={t("hybridPriority")}
                />
              </label>
            </div>
          )}
        </div>
        <section className="preferences-section">
          <span className="overline">{t("preferences").toUpperCase()}</span>
          <div className="preference-row">
            <div>
              <b>{t("appearance")}</b>
              <small>{t("appearanceHelp")}</small>
            </div>
            <TabSwitch
              value={theme}
              onChange={setTheme}
              label={t("appearance")}
              options={[
                { value: "light", label: t("light") },
                { value: "dark", label: t("dark") },
              ]}
            />
          </div>
          <div className="preference-row">
            <div>
              <b>{t("cameraBehavior")}</b>
              <small>{t("cameraBehaviorHelp")}</small>
            </div>
            <Switch checked={follow} onChange={setFollow} label="" />
          </div>
        </section>
        <p className="form-note">{t("recomputeNote")}</p>
        {formError && <p className="form-error">{formError}</p>}
        <div className="dialog-actions split drawer-actions">
          <button
            className="button danger"
            disabled={formBusy}
            onClick={deleteModel}
          >
            {t("deleteModel")}
          </button>
          <span />
          <button
            className="button secondary"
            onClick={() => setSettingsOpen(false)}
          >
            {t("cancel")}
          </button>
          <button
            className="button primary"
            disabled={formBusy}
            onClick={saveSettings}
          >
            {formBusy ? t("calculating") : t("save")}
          </button>
        </div>
      </Drawer>
    </div>
  );
}
