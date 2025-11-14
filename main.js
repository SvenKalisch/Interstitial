import * as pdfjsLib from "./pdf.mjs";

let worker;
try {
  worker = new Worker(new URL("./pdf.worker.mjs", import.meta.url), {
    type: "module",
  });
  pdfjsLib.GlobalWorkerOptions.workerPort = worker;
} catch (e) {
  console.error("Konnte PDF-Worker nicht starten:", e);
  alert("Der PDF-Worker konnte nicht gestartet werden. Details in der Konsole.");
}

const EXPORT_WIDTH = 2734;
const EXPORT_HEIGHT = 3983;
const DISPLAY_SCALE = 0.18;

const pdfInput = document.getElementById("pdfInput");
const zoomRange = document.getElementById("zoomRange");
const zoomMinus = document.getElementById("zoomMinus");
const zoomPlus = document.getElementById("zoomPlus");
const previewCanvas = document.getElementById("previewCanvas");
const downloadBtn = document.getElementById("downloadBtn");

const ctx = previewCanvas.getContext("2d");

let pdfDoc = null;
let pdfPage = null;
let basePageCanvas = null;

let baseFitScale = 1;
let zoomFactor = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let startOffsetX = 0;
let startOffsetY = 0;

previewCanvas.width = EXPORT_WIDTH;
previewCanvas.height = EXPORT_HEIGHT;

pdfInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    pdfPage = await pdfDoc.getPage(1);

    await renderBasePage();
    computeBaseFit();
    zoomFactor = 1;
    zoomRange.value = "1";
    offsetX = 0;
    offsetY = 0;
    redrawPreview();
    downloadBtn.disabled = false;
  } catch (err) {
    console.error("Fehler beim Laden/Rendern des PDFs:", err);
    alert("PDF konnte nicht geladen werden. Details in der Konsole.");
  }
});

async function renderBasePage() {
  const viewport = pdfPage.getViewport({ scale: 1 });

  const desiredWidth = 2000;
  const scale = desiredWidth / viewport.width;
  const scaledViewport = pdfPage.getViewport({ scale });

  basePageCanvas = document.createElement("canvas");
  basePageCanvas.width = scaledViewport.width;
  basePageCanvas.height = scaledViewport.height;

  const renderContext = {
    canvasContext: basePageCanvas.getContext("2d"),
    viewport: scaledViewport,
  };

  await pdfPage.render(renderContext).promise;
}

function computeBaseFit() {
  if (!basePageCanvas) return;
  const scaleX = EXPORT_WIDTH / basePageCanvas.width;
  const scaleY = EXPORT_HEIGHT / basePageCanvas.height;
  baseFitScale = Math.min(scaleX, scaleY);
}

function redrawPreview() {
  if (!basePageCanvas) return;

  const effectiveScale = baseFitScale * zoomFactor;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);

  ctx.save();
  ctx.translate(EXPORT_WIDTH / 2 + offsetX, EXPORT_HEIGHT / 2 + offsetY);
  ctx.scale(effectiveScale, effectiveScale);
  ctx.drawImage(
    basePageCanvas,
    -basePageCanvas.width / 2,
    -basePageCanvas.height / 2
  );
  ctx.restore();
}

zoomRange.addEventListener("input", (e) => {
  zoomFactor = parseFloat(e.target.value);
  redrawPreview();
});

zoomMinus.addEventListener("click", () => {
  const current = parseFloat(zoomRange.value);
  const next = Math.max(0.5, current - 0.05);
  zoomRange.value = next.toFixed(2);
  zoomFactor = next;
  redrawPreview();
});

zoomPlus.addEventListener("click", () => {
  const current = parseFloat(zoomRange.value);
  const next = Math.min(3, current + 0.05);
  zoomRange.value = next.toFixed(2);
  zoomFactor = next;
  redrawPreview();
});

previewCanvas.addEventListener("mousedown", (e) => {
  if (!basePageCanvas) return;
  isDragging = true;
  previewCanvas.classList.add("dragging");
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  startOffsetX = offsetX;
  startOffsetY = offsetY;
});

window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const dxCSS = e.clientX - dragStartX;
  const dyCSS = e.clientY - dragStartY;

  const dxCanvas = dxCSS / DISPLAY_SCALE;
  const dyCanvas = dyCSS / DISPLAY_SCALE;

  offsetX = startOffsetX + dxCanvas;
  offsetY = startOffsetY + dyCanvas;
  redrawPreview();
});

window.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;
  previewCanvas.classList.remove("dragging");
});

downloadBtn.addEventListener("click", () => {
  if (!basePageCanvas) return;
  const dataUrl = previewCanvas.toDataURL("image/jpeg", 0.92);
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = "interstitial.jpg";
  link.click();
});
