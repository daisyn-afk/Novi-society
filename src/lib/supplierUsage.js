const SUBMITTED_STATUS = "submitted";
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

export function normalizeProductName(value) {
  return String(value || "").trim().toLowerCase();
}

export function buildInventoryProductOptions(inventory = []) {
  const seen = new Set();
  const options = [];

  for (const line of inventory) {
    const productName = String(line.product_name || "").trim();
    const manufacturerId = String(line.manufacturer_id || "").trim();
    if (!productName || !manufacturerId) continue;

    const key = `${manufacturerId}::${normalizeProductName(productName)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    options.push({
      key,
      product_name: productName,
      manufacturer_id: manufacturerId,
      manufacturer_name: String(line.manufacturer_name || "").trim(),
      unit: String(line.unit || "units").trim() || "units",
    });
  }

  return options.sort(
    (a, b) =>
      a.manufacturer_name.localeCompare(b.manufacturer_name)
      || a.product_name.localeCompare(b.product_name)
  );
}

export function productMatchesManufacturer(product, manufacturer) {
  if (!product?.product_name || !manufacturer?.id) return false;

  if (
    product.manufacturer_id
    && String(product.manufacturer_id) === String(manufacturer.id)
  ) {
    return true;
  }

  const productNameLower = normalizeProductName(product.product_name);
  const manufacturerNameLower = normalizeProductName(manufacturer.name);

  if (manufacturerNameLower && productNameLower.includes(manufacturerNameLower)) {
    return true;
  }

  return (manufacturer.products || []).some(
    (catalogProduct) => productNameLower.includes(normalizeProductName(catalogProduct))
  );
}

export function recordUsesManufacturer(record, manufacturer) {
  if (String(record?.status || "") !== SUBMITTED_STATUS) return false;
  return (record.products_used || []).some((product) => productMatchesManufacturer(product, manufacturer));
}

export function matchingProductsForManufacturer(record, manufacturer) {
  return (record.products_used || []).filter((product) => productMatchesManufacturer(product, manufacturer));
}

export function unitsUsedForManufacturer(record, manufacturer) {
  const matching = matchingProductsForManufacturer(record, manufacturer);
  if (!matching.length) return 0;

  const fromProductAmounts = matching.reduce(
    (sum, product) => sum + (Number(product.amount) || 0),
    0
  );
  if (fromProductAmounts > 0) return fromProductAmounts;

  if (matching.length === 1 && record.units_used != null && record.units_used !== "") {
    return Number(record.units_used) || 0;
  }

  return 0;
}

export function buildMonthlyTreatmentCounts(brandRecords = [], monthCount = 3) {
  const now = new Date();
  const months = [];

  for (let offset = monthCount - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    months.push({
      key: monthKey(date),
      label: MONTH_SHORT[date.getMonth()],
      count: 0,
    });
  }

  brandRecords.forEach((record) => {
    if (!record.treatment_date) return;
    const date = new Date(record.treatment_date);
    if (Number.isNaN(date.getTime())) return;
    const bucket = months.find((month) => month.key === monthKey(date));
    if (bucket) bucket.count += 1;
  });

  return months;
}

export function buildRecentTreatmentLines(brandRecords = [], manufacturer, limit = 5) {
  const lines = [];

  brandRecords.forEach((record) => {
    const matching = matchingProductsForManufacturer(record, manufacturer);
    matching.forEach((product) => {
      const amount = Number(product.amount);
      const units = Number.isFinite(amount) && amount > 0
        ? amount
        : (matching.length === 1 ? Number(record.units_used) || 0 : 0);

      lines.push({
        id: `${record.id}-${product.product_name}`,
        product_name: product.product_name,
        units,
        unit_label: record.units_label || "units",
        treatment_date: record.treatment_date,
      });
    });
  });

  return lines
    .sort((a, b) => new Date(b.treatment_date) - new Date(a.treatment_date))
    .slice(0, limit);
}

export function buildSupplierUsageStats(treatmentRecords = [], manufacturer) {
  const brandRecords = treatmentRecords.filter((record) => recordUsesManufacturer(record, manufacturer));
  const usedLots = new Set();

  brandRecords.forEach((record) => {
    matchingProductsForManufacturer(record, manufacturer).forEach((product) => {
      if (product.batch_lot) usedLots.add(String(product.batch_lot).trim());
    });
  });

  const totalUnits = brandRecords.reduce(
    (sum, record) => sum + unitsUsedForManufacturer(record, manufacturer),
    0
  );

  const lastUsed = brandRecords.length
    ? brandRecords
      .slice()
      .sort((a, b) => new Date(b.treatment_date) - new Date(a.treatment_date))[0]
      ?.treatment_date
    : null;

  return { brandRecords, totalUnits, usedLots, lastUsed };
}

export function formatTreatmentCountLabel(count = 0) {
  if (count === 1) return "1 treatment logged";
  return `${count} treatments logged`;
}

export function getInventoryProductSelectValue(product, inventoryOptions = []) {
  if (!product?.product_name) return "";
  if (!product.manufacturer_id) return "__other__";

  const key = `${product.manufacturer_id}::${normalizeProductName(product.product_name)}`;
  return inventoryOptions.some((option) => option.key === key) ? key : "__other__";
}

export function sanitizeProductsUsed(products = []) {
  return products
    .filter((product) => String(product.product_name || "").trim())
    .map(({ product_name, batch_lot, amount, manufacturer_id, manufacturer_name }) => ({
      product_name: String(product_name).trim(),
      batch_lot: String(batch_lot || "").trim(),
      amount: amount != null ? String(amount).trim() : "",
      ...(manufacturer_id ? { manufacturer_id: String(manufacturer_id) } : {}),
      ...(manufacturer_name ? { manufacturer_name: String(manufacturer_name).trim() } : {}),
    }));
}
