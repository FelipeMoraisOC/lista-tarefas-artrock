// ── Chart.js wrappers ─────────────────────────────────────

import { responsibleOf, formatHours } from '../utils.js';

// Paleta categórica validada (skill dataviz, ordem fixa: vizinhas com ΔE >= 9 para
// daltonismo e >= 19 para visão normal). A 1ª não é vermelho: vermelho no app é alerta.
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const MAX_SLICES  = 8;              // 7 categorias com cor própria + "Outras"
const OTHER       = '__other';
const OTHER_COLOR = '#9A9A9A';
const EMPTY_COLOR = '#E0E0E0';
const SURFACE     = '#FFFFFF';      // fundo do card: separa fatias e segmentos
const TEXT_2      = '#4A4A4A';      // mesmos valores de --text-2 / --text-muted (style.css)
const TEXT_MUTED  = '#5E5E5E';
const GRID        = '#EBEBEB';
const FONT        = { family: 'Inter', size: 13 };
const FONT_SMALL  = { family: 'Inter', size: 12 };

const mineWithHours = (tasks, userId) =>
  tasks.filter(t => t.hoursInvested && responsibleOf(t) === userId);

// Categorias com horas do usuário: as 7 de mais horas ficam; o resto vira "Outras".
// A cor segue a categoria (ordem do cadastro), não a posição no gráfico — assim
// a mesma categoria tem a mesma cor na pizza e nas barras.
function categoryPlan(tasks, categories, userId) {
  const total = new Map();
  mineWithHours(tasks, userId).forEach(t =>
    total.set(t.categoryId, (total.get(t.categoryId) ?? 0) + t.hoursInvested));

  let ids = [...total.keys()];
  const overflow = ids.length > MAX_SLICES;
  if (overflow) ids = ids.sort((a, b) => total.get(b) - total.get(a)).slice(0, MAX_SLICES - 1);

  const rank = id => { const i = categories.findIndex(c => c.id === id); return i === -1 ? Infinity : i; };
  ids.sort((a, b) => rank(a) - rank(b));

  const color   = new Map(ids.map((id, i) => [id, PALETTE[i]]));
  const keyOf   = id => (color.has(id) ? id : OTHER);
  const nameOf  = key => (key === OTHER ? 'Outras' : categories.find(c => c.id === key)?.name ?? key);
  const colorOf = key => (key === OTHER ? OTHER_COLOR : color.get(key));
  return { keys: overflow ? [...ids, OTHER] : ids, keyOf, nameOf, colorOf, total };
}

// Destroy a previous chart instance attached to a canvas
function destroy(canvas) {
  if (canvas._ci) { canvas._ci.destroy(); delete canvas._ci; }
}

// ── Pie (doughnut) ────────────────────────────────────────
export function renderPie(canvas, tasks, categories, userId) {
  if (!canvas || !window.Chart) return;
  destroy(canvas);

  const plan  = categoryPlan(tasks, categories, userId);
  const empty = plan.keys.length === 0;
  const labels = [], data = [], colors = [];

  if (empty) {
    labels.push('Sem dados'); data.push(1); colors.push(EMPTY_COLOR);
  } else {
    const hours = new Map();
    plan.total.forEach((h, id) => { const k = plan.keyOf(id); hours.set(k, (hours.get(k) ?? 0) + h); });
    plan.keys.forEach(k => {
      labels.push(plan.nameOf(k));
      data.push(hours.get(k));
      colors.push(plan.colorOf(k));
    });
  }

  canvas._ci = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: SURFACE, hoverOffset: 6 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: FONT, color: TEXT_2, padding: 14, usePointStyle: true, pointStyleWidth: 10,
            // Horas visíveis na legenda (não só no tooltip): algumas cores têm pouco contraste com o fundo
            generateLabels: chart => chart.data.labels.map((label, i) => ({
              text: empty ? label : `${label} — ${formatHours(chart.data.datasets[0].data[i])}`,
              fillStyle: colors[i], strokeStyle: colors[i], lineWidth: 0, pointStyle: 'circle',
              fontColor: TEXT_2, hidden: !chart.getDataVisibility(i), index: i,
            })),
          },
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${formatHours(ctx.raw)}` } },
      },
    },
  });
}

// ── Bar (stacked) ─────────────────────────────────────────
export function renderBar(canvas, tasks, categories, userId) {
  if (!canvas || !window.Chart) return;
  destroy(canvas);

  const DAYS = 14;
  const dateKeys = [];
  const dateLabels = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dateKeys.push(d.toISOString().split('T')[0]);
    dateLabels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
  }

  const plan = categoryPlan(tasks, categories, userId);
  const mine = mineWithHours(tasks, userId);

  const datasets = plan.keys.map(k => ({
    label: plan.nameOf(k),
    data: dateKeys.map(dk =>
      mine.filter(t => plan.keyOf(t.categoryId) === k && t.endDate === dk)
          .reduce((sum, t) => sum + (t.hoursInvested ?? 0), 0)
    ),
    backgroundColor: plan.colorOf(k),
    borderColor: SURFACE,           // 2px de fundo entre segmentos empilhados
    borderWidth: 1,
    borderRadius: 4,
    borderSkipped: false,
  }));

  if (datasets.length === 0) {
    datasets.push({ label: 'Sem dados', data: dateKeys.map(() => 0), backgroundColor: EMPTY_COLOR });
  }

  canvas._ci = new Chart(canvas, {
    type: 'bar',
    data: { labels: dateLabels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: FONT, color: TEXT_2, usePointStyle: true, pointStyleWidth: 10 },
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${formatHours(ctx.raw)}` } },
      },
      scales: {
        x: { stacked: true, grid: { display: false },
             ticks: { font: FONT_SMALL, color: TEXT_MUTED } },
        y: { stacked: true, grid: { color: GRID }, beginAtZero: true,
             ticks: { font: FONT_SMALL, color: TEXT_MUTED, callback: v => v + 'h' } },
      },
    },
  });
}
