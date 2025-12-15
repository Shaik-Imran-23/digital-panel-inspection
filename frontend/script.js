const API = "http://localhost:8000";
let checklistData = [];

/* =========================
   PDF.js Setup
   ========================= */
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "pdfjs/pdf.worker.js";

let pdfDoc = null;
let currentPage = 1;
let scale = 1.3;
let gaLoaded = false;
let currentViewport = null;

/* =========================
   BOM Upload
   ========================= */
async function uploadBOM() {
  const fileInput = document.getElementById("bomFile");
  if (!fileInput.files.length) return alert("Select BOM");

  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append("file", file);

  await fetch(`${API}/upload/bom`, {
    method: "POST",
    body: formData
  });

  const res = await fetch(
    `${API}/process/bom?filename=${file.name}`,
    { method: "POST" }
  );

  checklistData = await res.json();
  renderChecklist();
}

/* =========================
   Render Checklist
   ========================= */
function renderChecklist() {
  const tbody = document.getElementById("checklistBody");
  tbody.innerHTML = "";

  checklistData.forEach((item, index) => {
    const row = document.createElement("tr");
    row.style.cursor = "pointer";

    row.innerHTML = `
      <td>${item["FIND NUMBER"]}</td>
      <td>${item["PART DESCRIPTION"]}</td>
      <td>
        <select onchange="checklistData[${index}].STATUS=this.value">
          <option value="">--Select--</option>
          <option value="OK">OK</option>
          <option value="NOT OK">NOT OK</option>
        </select>
      </td>
      <td>
        <input oninput="checklistData[${index}].REMARKS=this.value" />
      </td>
    `;

    row.onclick = () => loadDetails(item["FIND NUMBER"]);
    tbody.appendChild(row);
  });
}

/* =========================
   Load BOM Details + GA Sync
   ========================= */
async function loadDetails(findNumber) {
  const res = await fetch(`${API}/bom/details/${findNumber}`);
  const data = await res.json();

  const tbody = document.querySelector("#detailsTable tbody");
  tbody.innerHTML = "";

  for (const key in data) {
    tbody.innerHTML += `
      <tr>
        <td><b>${key}</b></td>
        <td>${data[key]}</td>
      </tr>
    `;
  }

  if (!gaLoaded) {
    alert("Please upload GA drawing first");
    return;
  }

  const map = GA_MAPPING[findNumber];
  if (!map) {
    console.warn(`No GA mapping for FIND NUMBER ${findNumber}`);
    return;
  }

  currentPage = map.page;
  await renderPage(currentPage);
  highlightComponent(map);
}

/* =========================
   GA Upload
   ========================= */
async function uploadGA() {
  const fileInput = document.getElementById("gaFile");
  if (!fileInput.files.length) return alert("Select GA");

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  const res = await fetch(`${API}/upload/ga`, {
    method: "POST",
    body: formData
  });

  const data = await res.json();
  loadGA(data.filename);
}

/* =========================
   Load GA PDF
   ========================= */
async function loadGA(filename) {
  const url = `${API}/ga/${filename}`;
  pdfDoc = await pdfjsLib.getDocument(url).promise;
  currentPage = 1;
  gaLoaded = true;
  renderPage(currentPage);
}

/* =========================
   Render PDF Page
   ========================= */
async function renderPage(pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  currentViewport = page.getViewport({ scale });

  const canvas = document.getElementById("pdfCanvas");
  const ctx = canvas.getContext("2d");

  canvas.width = currentViewport.width;
  canvas.height = currentViewport.height;

  const layer = document.getElementById("highlightLayer");
  layer.style.width = canvas.width + "px";
  layer.style.height = canvas.height + "px";
  layer.innerHTML = "";

  await page.render({
    canvasContext: ctx,
    viewport: currentViewport
  }).promise;

  document.getElementById("pageInfo").innerText =
    `Page ${currentPage} / ${pdfDoc.numPages}`;
}

/* =========================
   Page Controls
   ========================= */
function nextPage() {
  if (currentPage < pdfDoc.numPages) {
    currentPage++;
    renderPage(currentPage);
  }
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderPage(currentPage);
  }
}

/* =========================
   PDF → Canvas Conversion
   ========================= */
function pdfToCanvasCoords(pdfX, pdfY, pdfW, pdfH, viewport) {
  const pageHeight = viewport.viewBox[3]; // PDF page height

  // Convert from PDF bottom-left origin to top-left origin
  const [x1, y1] = viewport.convertToViewportPoint(
    pdfX,
    pageHeight - pdfY
  );

  const [x2, y2] = viewport.convertToViewportPoint(
    pdfX + pdfW,
    pageHeight - (pdfY + pdfH)
  );

  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1)
  };
}


/* =========================
   Highlight Component (ACCURATE)
   ========================= */
function highlightComponent(map) {
  if (!currentViewport) return;

  const layer = document.getElementById("highlightLayer");
  layer.innerHTML = "";

  const rect = pdfToCanvasCoords(
    map.pdfX,
    map.pdfY,
    map.pdfWidth,
    map.pdfHeight,
    currentViewport
  );

  const div = document.createElement("div");
  div.className = "highlight-box";

  div.style.left = rect.x + "px";
  div.style.top = rect.y + "px";
  div.style.width = rect.width + "px";
  div.style.height = rect.height + "px";

  layer.appendChild(div);
}

/* =========================
   TEMP: Click to Capture PDF Coords
   (Use once, then remove)
   ========================= */
document.getElementById("pdfCanvas").onclick = e => {
  if (!currentViewport) return;

  const rect = pdfCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const [pdfX, pdfY] =
    currentViewport.convertToPdfPoint(x, y);

  console.log("PDF COORDINATES:", pdfX, pdfY);
};
