// ── Chart.js wrappers ─────────────────────────────────────

const CAT_COLORS = {
  c1: '#E8201E',
  c2: '#FF6B6B',
  c3: '#FFA07A',
  c4: '#2563EB',
  c5: '#7C3AED',
};
const FALLBACK = [
  '#E8201E','#FF6B6B','#2563EB','#7C3AED',
  '#10B981','#F59E0B','#06B6D4','#EC4899',
];
const col = (id, idx) => CAT_COLORS[id] ?? FALLBACK[idx % FALLBACK.length];

// Destroy a previous chart instance attached to a canvas
function destroy(canvas) {
  if (canvas._ci) { canvas._ci.destroy(); delete canvas._ci; }
}

// ── Pie (doughnut) ────────────────────────────────────────
export function renderPie(canvas, tasks, categories, userId) {
  if (!canvas || !window.Chart) return;
  destroy(canvas);

  const map = {};
  tasks.forEach(t => {
    if (t.hoursInvested && (t.responsibleId ?? t.createdById) === userId)
      map[t.categoryId] = (map[t.categoryId] ?? 0) + t.hoursInvested;
  });

  const entries = Object.entries(map);
  const labels = [], data = [], colors = [];

  if (entries.length === 0) {
    labels.push('Sem dados'); data.push(1); colors.push('#E0E0E0');
  } else {
    entries.forEach(([cid, h], i) => {
      const c = categories.find(x => x.id === cid);
      labels.push(c?.name ?? cid);
      data.push(h);
      colors.push(col(cid, i));
    });
  }

  canvas._ci = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Inter', size: 11 }, color: '#555', padding: 14,
                    usePointStyle: true, pointStyleWidth: 8 },
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}h` } },
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

  const catIds = [...new Set(
    tasks.filter(t => t.hoursInvested && (t.responsibleId ?? t.createdById) === userId).map(t => t.categoryId)
  )];

  const datasets = catIds.map((cid, idx) => {
    const cat = categories.find(c => c.id === cid);
    return {
      label: cat?.name ?? cid,
      data: dateKeys.map(dk =>
        tasks.filter(t => t.categoryId === cid && t.endDate === dk && t.hoursInvested && (t.responsibleId ?? t.createdById) === userId)
             .reduce((s, t) => s + (t.hoursInvested ?? 0), 0)
      ),
      backgroundColor: col(cid, idx),
      borderRadius: 4,
      borderSkipped: false,
    };
  });

  if (datasets.length === 0) {
    datasets.push({ label: 'Sem dados', data: dateKeys.map(() => 0), backgroundColor: '#E0E0E0' });
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
          labels: { font: { family: 'Inter', size: 11 }, color: '#555',
                    usePointStyle: true, pointStyleWidth: 8 },
        },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.raw}h` } },
      },
      scales: {
        x: { stacked: true, grid: { display: false },
             ticks: { font: { family: 'Inter', size: 10 }, color: '#999' } },
        y: { stacked: true, grid: { color: '#F0F0F0' }, beginAtZero: true,
             ticks: { font: { family: 'Inter', size: 10 }, color: '#999',
                      callback: v => v + 'h' } },
      },
    },
  });
}
