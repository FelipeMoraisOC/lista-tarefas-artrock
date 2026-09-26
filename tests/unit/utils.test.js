// Utilitários compartilhados (renderer/js/utils.js)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatDate, formatDatetime, formatHours, formatDuration, generateId,
  responsibleOf, isOverdue, todayISO, showToast,
} from '../../renderer/js/utils.js';

describe('formatação de datas', () => {
  it('formatDate mostra a data no padrão brasileiro', () => {
    expect(formatDate('2026-09-05')).toBe('05/09/2026');
  });

  it('formatDate mostra "—" quando não há data', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('formatDatetime mostra data e hora, ou "—" sem valor', () => {
    const iso = new Date(2026, 8, 5, 14, 30).toISOString();
    expect(formatDatetime(iso)).toMatch(/05\/09\/2026.*14:30/);
    expect(formatDatetime(undefined)).toBe('—');
  });
});

describe('formatHours (horas decimais → texto)', () => {
  it.each([
    [1.5, '1,5h'],
    [2, '2h'],
    [1.388888, '1,39h'],
    [0, '0h'],
    [null, '0h'],
  ])('%s → %s', (hours, expected) => {
    expect(formatHours(hours)).toBe(expected);
  });
});

describe('formatDuration (segundos → relógio)', () => {
  it.each([
    [0, '0:00'],
    [59, '0:59'],
    [65, '1:05'],
    [3599, '59:59'],
    [3661, '1:01:01'],
    [36000, '10:00:00'],
    [65.9, '1:05'],
    [-10, '0:00'],
  ])('%s s → %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe('generateId', () => {
  it('usa o prefixo e gera ids diferentes', () => {
    const a = generateId('cmt');
    const b = generateId('cmt');
    expect(a).toMatch(/^cmt-\d+-[a-z0-9]+$/);
    expect(a).not.toBe(b);
  });
});

describe('responsibleOf (responsável efetivo)', () => {
  it('usa o responsibleId quando existe', () => {
    expect(responsibleOf({ responsibleId: 'u1', createdById: 'u2' })).toBe('u1');
  });

  it('tarefa do Backlog sem responsável (null) continua sem responsável', () => {
    expect(responsibleOf({ responsibleId: null, createdById: 'u2' })).toBeNull();
  });

  it('tarefa antiga sem o campo cai no criador', () => {
    expect(responsibleOf({ createdById: 'u2' })).toBe('u2');
  });

  it('sem tarefa → null', () => {
    expect(responsibleOf(null)).toBeNull();
  });
});

describe('prazos', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-09-26T12:00:00Z') });
  });

  it('todayISO devolve a data de hoje (AAAA-MM-DD)', () => {
    expect(todayISO()).toBe('2026-09-26');
  });

  it('isOverdue: prazo no passado e tarefa não concluída → vencida', () => {
    expect(isOverdue('2026-09-25', 'Em Andamento')).toBe(true);
  });

  it('isOverdue: tarefa concluída nunca está vencida', () => {
    expect(isOverdue('2026-01-01', 'Concluído')).toBe(false);
  });

  it('isOverdue: prazo hoje, futuro ou ausente → não vencida', () => {
    expect(isOverdue('2026-09-26', 'Para Fazer')).toBe(false);
    expect(isOverdue('2026-12-31', 'Para Fazer')).toBe(false);
    expect(isOverdue(null, 'Para Fazer')).toBe(false);
  });
});

describe('showToast', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="toast-container"></div>';
  });

  it('mostra a mensagem com o tipo', () => {
    showToast('Tarefa criada!', 'success');
    const toast = document.querySelector('.toast');
    expect(toast.classList.contains('success')).toBe(true);
    expect(toast.textContent).toContain('Tarefa criada!');
  });

  it('some sozinho depois do tempo de exibição', () => {
    vi.useFakeTimers();
    showToast('Some logo', 'info', { duration: 1000 });
    expect(document.querySelectorAll('.toast')).toHaveLength(1);
    vi.advanceTimersByTime(1000 + 320);
    expect(document.querySelectorAll('.toast')).toHaveLength(0);
  });

  it('botão de ação (ex.: Desfazer) executa a ação e fecha o toast', () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    showToast('Concluída', 'success', { action: { label: 'Desfazer', onClick } });
    const btn = document.querySelector('.toast-action');
    expect(btn.textContent).toBe('Desfazer');
    btn.click();
    btn.click();                      // clique duplo não repete a ação
    expect(onClick).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(320);
    expect(document.querySelectorAll('.toast')).toHaveLength(0);
  });

  it('não quebra quando a área de toasts não existe (ex.: tela de login)', () => {
    document.body.innerHTML = '';
    expect(() => showToast('x')).not.toThrow();
  });
});
