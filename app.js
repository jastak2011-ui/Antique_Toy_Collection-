const STORAGE_KEY = "antique-toy-ledger-items";

const form = document.querySelector("#itemForm");
const itemId = document.querySelector("#itemId");
const formTitle = document.querySelector("#formTitle");
const saveBtn = document.querySelector("#saveBtn");
const cancelEditBtn = document.querySelector("#cancelEditBtn");
const searchInput = document.querySelector("#searchInput");
const inventoryBody = document.querySelector("#inventoryBody");
const emptyState = document.querySelector("#emptyState");
const reportBody = document.querySelector("#reportBody");
const reportStats = document.querySelector("#reportStats");
const reportDate = document.querySelector("#reportDate");
const saveStatus = document.querySelector("#saveStatus");
const imageData = document.querySelector("#imageData");
const imageInput = document.querySelector("#imageInput");
const imagePreview = document.querySelector("#imagePreview");
const addImageBtn = document.querySelector("#addImageBtn");
const removeImageBtn = document.querySelector("#removeImageBtn");
const imageModal = document.querySelector("#imageModal");
const modalImage = document.querySelector("#modalImage");
const modalCaption = document.querySelector("#modalCaption");
const closeImageModal = document.querySelector("#closeImageModal");

let items = [];

const fields = [
  "itemName",
  "maker",
  "origin",
  "era",
  "category",
  "pricePaid",
  "estimatedValue",
  "condition",
  "acquiredDate",
  "source",
  "notes",
  "imageData"
];
const searchableFields = fields.filter((field) => field !== "imageData");

function loadLocalItems() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLocalItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // The server-backed save still protects data when browser storage is blocked.
  }
}

function setSaveStatus(message, state = "") {
  saveStatus.textContent = message;
  if (state) {
    saveStatus.dataset.state = state;
  } else {
    delete saveStatus.dataset.state;
  }
}

async function loadItems() {
  const localItems = loadLocalItems();

  try {
    const response = await fetch("/api/items", { cache: "no-store" });
    if (!response.ok) throw new Error("Item API unavailable");
    const serverItems = await response.json();
    if (Array.isArray(serverItems) && serverItems.length > 0) {
      items = serverItems;
      saveLocalItems();
      setSaveStatus("Loaded from server", "ok");
      return;
    }
  } catch {
    // Opening index.html directly still works with browser storage.
  }

  items = localItems;
  if (items.length > 0) await saveItems();
  if (items.length === 0) setSaveStatus("Ready");
}

async function saveItems() {
  saveLocalItems();

  try {
    setSaveStatus("Saving...", "");
    const response = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(items)
    });

    if (!response.ok) throw new Error("Item API unavailable");
    const result = await response.json();
    if (result.github && result.github.enabled && result.github.error) {
      setSaveStatus("Saved locally; GitHub sync failed", "warn");
      return result;
    }

    if (result.github && result.github.enabled) {
      setSaveStatus("Saved to GitHub", "ok");
      return result;
    }

    setSaveStatus("Saved locally", "ok");
    return result;
  } catch {
    // Browser-only mode cannot write to disk, so localStorage remains the fallback.
    setSaveStatus("Saved in this browser only", "warn");
    return { ok: true, localOnly: true };
  }
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function exactMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeImageData(value) {
  const text = String(value || "");
  if (/^data:image\/(jpeg|jpg|png|webp|gif);base64,[a-z0-9+/=]+$/i.test(text)) return text;
  return "";
}

function renderFormImage() {
  const src = safeImageData(imageData.value);
  if (!src) {
    imagePreview.innerHTML = "<span>No image selected</span>";
    addImageBtn.textContent = "Add Image";
    removeImageBtn.classList.add("hidden");
    return;
  }

  imagePreview.innerHTML = `<img src="${src}" alt="Selected item image">`;
  addImageBtn.textContent = "Change Image";
  removeImageBtn.classList.remove("hidden");
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function resizeImage(file) {
  const source = await readFileAsDataUrl(file);
  const image = await loadImage(source);
  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.78);
}

function getTotals(sourceItems = items) {
  return sourceItems.reduce(
    (totals, item) => {
      totals.paid += Number(item.pricePaid) || 0;
      totals.value += Number(item.estimatedValue) || 0;
      return totals;
    },
    { paid: 0, value: 0 }
  );
}

function searchableText(item) {
  return searchableFields.map((field) => item[field]).join(" ").toLowerCase();
}

function filteredItems() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) return items;
  return items.filter((item) => searchableText(item).includes(query));
}

function renderStats(sourceItems = items) {
  const totals = getTotals(sourceItems);
  document.querySelector("#totalItems").textContent = sourceItems.length;
  document.querySelector("#totalPaid").textContent = exactMoney(totals.paid);
  document.querySelector("#totalValue").textContent = money(totals.value);
  document.querySelector("#totalGain").textContent = money(totals.value - totals.paid);
}

function renderInventory() {
  const visibleItems = filteredItems();
  renderStats(visibleItems);

  inventoryBody.innerHTML = visibleItems
    .map(
      (item) => {
        const src = safeImageData(item.imageData);
        return `
        <tr>
          <td>
            ${
              src
                ? `<button class="thumb-button" type="button" title="View image" data-action="view-image" data-id="${item.id}"><img src="${src}" alt="${escapeHtml(item.itemName)}"></button>`
                : `<span class="thumb-button">No Photo</span>`
            }
          </td>
          <td>
            <span class="item-title">${escapeHtml(item.itemName)}</span>
            <span class="item-meta">${escapeHtml([item.maker, item.era, item.category].filter(Boolean).join(" / "))}</span>
          </td>
          <td>${escapeHtml(item.origin)}</td>
          <td><span class="condition">${escapeHtml(item.condition)}</span></td>
          <td>${exactMoney(item.pricePaid)}</td>
          <td>${exactMoney(item.estimatedValue)}</td>
          <td>
            <div class="action-row">
              <button class="icon-button" type="button" title="Edit item" data-action="edit" data-id="${item.id}">Edit</button>
              <button class="icon-button danger" type="button" title="Delete item" data-action="delete" data-id="${item.id}">Del</button>
            </div>
          </td>
        </tr>
      `;
      }
    )
    .join("");

  emptyState.textContent = items.length ? "No items match your search." : "Add your first find to start the ledger.";
  emptyState.classList.toggle("visible", visibleItems.length === 0);
  renderReport();
}

function renderReport() {
  const totals = getTotals(items);
  reportDate.textContent = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  reportStats.innerHTML = `
    <div><span>Total Items</span><strong>${items.length}</strong></div>
    <div><span>Total Paid</span><strong>${exactMoney(totals.paid)}</strong></div>
    <div><span>Estimated Value</span><strong>${money(totals.value)}</strong></div>
    <div><span>Appreciation</span><strong>${money(totals.value - totals.paid)}</strong></div>
  `;

  reportBody.innerHTML = items
    .map(
      (item) => {
        const src = safeImageData(item.imageData);
        return `
        <tr>
          <td>${src ? `<img class="report-thumb" src="${src}" alt="">` : ""}</td>
          <td>${escapeHtml(item.itemName)}</td>
          <td>${escapeHtml(item.maker)}</td>
          <td>${escapeHtml(item.origin)}</td>
          <td>${escapeHtml(item.era)}</td>
          <td>${escapeHtml(item.condition)}</td>
          <td>${exactMoney(item.pricePaid)}</td>
          <td>${exactMoney(item.estimatedValue)}</td>
        </tr>
      `;
      }
    )
    .join("");
}

function resetForm() {
  form.reset();
  itemId.value = "";
  formTitle.textContent = "Add a Find";
  saveBtn.textContent = "Add Item";
  cancelEditBtn.classList.add("hidden");
  document.querySelector("#condition").value = "Excellent";
  imageData.value = "";
  imageInput.value = "";
  renderFormImage();
}

function readFormItem() {
  const item = { id: itemId.value || createId(), updatedAt: new Date().toISOString() };
  fields.forEach((field) => {
    item[field] = document.querySelector(`#${field}`).value.trim();
  });
  return item;
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function editItem(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  itemId.value = item.id;
  fields.forEach((field) => {
    document.querySelector(`#${field}`).value = item[field] || "";
  });
  formTitle.textContent = "Edit Find";
  saveBtn.textContent = "Save Changes";
  cancelEditBtn.classList.remove("hidden");
  renderFormImage();
  document.querySelector("#itemName").focus();
}

function openImageModal(id) {
  const item = items.find((entry) => entry.id === id);
  const src = item ? safeImageData(item.imageData) : "";
  if (!item || !src) return;
  modalImage.src = src;
  modalImage.alt = item.itemName || "Item image";
  modalCaption.textContent = item.itemName || "Item image";
  imageModal.classList.remove("hidden");
}

function closeModal() {
  imageModal.classList.add("hidden");
  modalImage.src = "";
  modalCaption.textContent = "";
}

async function deleteItem(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  const confirmed = confirm(`Delete "${item.itemName}" from your ledger?`);
  if (!confirmed) return;
  items = items.filter((entry) => entry.id !== id);
  await saveItems();
  renderInventory();
  resetForm();
}

function exportCsv() {
  const headers = ["Item", "Maker", "Origin", "Era", "Category", "Price Paid", "Estimated Value", "Condition", "Acquired Date", "Source", "Notes"];
  const rows = items.map((item) => fields.map((field) => item[field] || ""));
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "antique-toy-ledger.csv";
  link.click();
  URL.revokeObjectURL(url);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nextItem = readFormItem();
  const existingIndex = items.findIndex((entry) => entry.id === nextItem.id);

  if (existingIndex >= 0) {
    items[existingIndex] = nextItem;
  } else {
    items.unshift(nextItem);
  }

  await saveItems();
  renderInventory();
  resetForm();
});

inventoryBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "edit") editItem(id);
  if (action === "delete") deleteItem(id);
  if (action === "view-image") openImageModal(id);
});

searchInput.addEventListener("input", renderInventory);
cancelEditBtn.addEventListener("click", resetForm);
addImageBtn.addEventListener("click", () => imageInput.click());
removeImageBtn.addEventListener("click", () => {
  imageData.value = "";
  imageInput.value = "";
  renderFormImage();
});
imageInput.addEventListener("change", async () => {
  const file = imageInput.files && imageInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setSaveStatus("Please choose an image file", "error");
    return;
  }

  addImageBtn.disabled = true;
  setSaveStatus("Preparing image...", "");
  try {
    imageData.value = await resizeImage(file);
    renderFormImage();
    setSaveStatus("Image ready", "ok");
  } catch {
    setSaveStatus("Could not read image", "error");
  } finally {
    addImageBtn.disabled = false;
  }
});
closeImageModal.addEventListener("click", closeModal);
imageModal.addEventListener("click", (event) => {
  if (event.target === imageModal) closeModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !imageModal.classList.contains("hidden")) closeModal();
});
document.querySelector("#printReportBtn").addEventListener("click", () => {
  renderReport();
  window.print();
});
document.querySelector("#exportCsvBtn").addEventListener("click", exportCsv);

async function init() {
  await loadItems();
  resetForm();
  renderInventory();
}

init();
