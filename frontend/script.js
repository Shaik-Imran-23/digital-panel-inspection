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

/* =========================
   BOM Upload
   ========================= */
async function uploadBOM() {
  const fileInput = document.getElementById("bomFile");
  if (!fileInput.files.length) return alert("Select BOM");

  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append("file", file);

  await fetch(`${API}/upload/bom`, { method: "POST", body: formData });

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
   Load BOM Details
   ========================= */
async function loadDetails(findNumber) {
  // 1. Load BOM details (already working)
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

  // 2. GA handling
  if (!gaLoaded) {
    alert("Please upload GA drawing first");
    return;
  }

  const map = GA_MAPPING[findNumber];

  if (!map) {
    console.warn(`No GA mapping for FIND NUMBER ${findNumber}`);
    return;
  }

  // 3. Navigate to correct page
  currentPage = map.page;
  await renderPage(currentPage);

  // 4. Highlight component
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
   PDF.js Rendering
   ========================= */
async function loadGA(filename) {
  const url = `${API}/ga/${filename}`;
  pdfDoc = await pdfjsLib.getDocument(url).promise;
  currentPage = 1;
  gaLoaded = true;
  renderPage(currentPage);
}


async function renderPage(pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.getElementById("pdfCanvas");
  const ctx = canvas.getContext("2d");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const layer = document.getElementById("highlightLayer");
  layer.style.width = canvas.width + "px";
  layer.style.height = canvas.height + "px";
  layer.innerHTML = "";

  await page.render({ canvasContext: ctx, viewport }).promise;

  document.getElementById("pageInfo").innerText =
    `Page ${currentPage} / ${pdfDoc.numPages}`;
}

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
   Highlight Component
   ========================= */
function highlightComponent(box) {
  const layer = document.getElementById("highlightLayer");
  layer.innerHTML = "";

  const div = document.createElement("div");
  div.className = "highlight-box";

  div.style.left = box.x + "px";
  div.style.top = box.y + "px";
  div.style.width = box.width + "px";
  div.style.height = box.height + "px";

  layer.appendChild(div);
}

