/**
 * Self Assessment Assist (MTD) 1.0 — display layer.
 * Renders only fields returned by HMRC. No invented advice or paraphrasing.
 *
 * Message fields (HMRC OAS): title, body, action?, links[{title,url}]?, path?
 * Report fields: reportId, messages, nino, taxYear, calculationId, correlationId
 */
(function (global) {
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * @param {unknown} raw
   * @returns {{ title: string, body: string, action: string, path: string, links: {title:string,url:string}[] }[]}
   */
  function normaliseMessages(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((m) => {
        if (!m || typeof m !== 'object') return null;
        const title = typeof m.title === 'string' ? m.title : '';
        const body = typeof m.body === 'string' ? m.body : '';
        if (!title && !body) return null;
        const links = Array.isArray(m.links)
          ? m.links
              .map((l) => {
                if (!l || typeof l !== 'object') return null;
                const lt = typeof l.title === 'string' ? l.title : '';
                const url = typeof l.url === 'string' ? l.url : '';
                if (!lt && !url) return null;
                return { title: lt, url };
              })
              .filter(Boolean)
          : [];
        return {
          title,
          body,
          action: typeof m.action === 'string' ? m.action : '',
          path: typeof m.path === 'string' ? m.path : '',
          links,
        };
      })
      .filter(Boolean);
  }

  /**
   * Extract assist payload from product API or workflow response.
   * @param {object} data
   */
  function extractAssistPayload(data) {
    if (!data || typeof data !== 'object') return null;
    const body = data.body && typeof data.body === 'object' ? data.body : data;
    const status = Number(
      data.hmrcStatus ?? data.status ?? body.status ?? (data.ok === true ? 200 : 0)
    );
    const messages = normaliseMessages(body.messages || data.messages);
    const reportId =
      (typeof body.reportId === 'string' && body.reportId) ||
      (typeof data.reportId === 'string' && data.reportId) ||
      '';
    const correlationId =
      (typeof body.correlationId === 'string' && body.correlationId) ||
      (typeof data.correlationId === 'string' && data.correlationId) ||
      (data.responseHeaders && data.responseHeaders['x-correlationid']) ||
      '';
    const calculationId =
      (typeof body.calculationId === 'string' && body.calculationId) ||
      (typeof data.calculationId === 'string' && data.calculationId) ||
      '';
    const taxYear =
      (typeof body.taxYear === 'string' && body.taxYear) ||
      (typeof data.taxYear === 'string' && data.taxYear) ||
      '';
    return {
      status,
      messages,
      reportId,
      correlationId,
      calculationId,
      taxYear,
      nino: typeof body.nino === 'string' ? body.nino : '',
      noContent: status === 204 || data.noContent === true,
      previewOnly: Boolean(data.previewOnly),
      error:
        typeof data.error === 'string'
          ? data.error
          : Array.isArray(body) && body[0]?.message
            ? body[0].message
            : '',
      hmrcCode:
        (Array.isArray(body) && body[0]?.code) ||
        body?.code ||
        data.hmrcCode ||
        '',
    };
  }

  /**
   * Render HMRC Assist content into a host element.
   * Only HMRC message field text is shown for advice content.
   * @param {HTMLElement} host
   * @param {object} data
   * @param {{ onAcknowledge?: (ids:{reportId:string,correlationId:string})=>void }} [opts]
   */
  function renderAssist(host, data, opts = {}) {
    if (!host) return null;
    const payload = extractAssistPayload(data);
    host.hidden = false;
    host.classList.add('assist-view');

    if (!payload) {
      host.innerHTML = '';
      host.hidden = true;
      return null;
    }

    if (payload.previewOnly) {
      // Product state — not HMRC Assist content
      host.innerHTML =
        '<p class="muted">HMRC Assist is available after you connect HMRC and a calculation exists.</p>';
      return payload;
    }

    if (payload.error && !payload.messages.length && !payload.noContent) {
      host.innerHTML = `<p class="error">${esc(payload.error)}${
        payload.hmrcCode ? ` (${esc(payload.hmrcCode)})` : ''
      }</p>`;
      return payload;
    }

    if (payload.noContent || payload.status === 204) {
      // 204 No Content — HMRC had nothing to say; show honest empty state (do not invent feedback)
      host.hidden = false;
      host.dataset.assistStatus = '204';
      host.innerHTML =
        '<div class="assist-empty help-tip"><strong>No Assist messages from HMRC</strong><p>HMRC returned an empty report for this calculation. That is normal when there is nothing to highlight. You can continue year-end.</p></div>';
      return payload;
    }

    if (!payload.messages.length) {
      host.hidden = false;
      host.innerHTML =
        '<div class="assist-empty help-tip"><strong>No Assist messages in this response</strong><p>HMRC did not return message text. Download the receipt from step result if you need the raw response.</p></div>';
      return payload;
    }

    const list = payload.messages
      .map((m) => {
        const linksHtml =
          m.links && m.links.length
            ? `<ul class="assist-links">${m.links
                .map((l) => {
                  if (l.url) {
                    return `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(
                      l.title || l.url
                    )}</a></li>`;
                  }
                  return l.title ? `<li>${esc(l.title)}</li>` : '';
                })
                .join('')}</ul>`
            : '';
        // Only HMRC strings: title, body, action, path, link titles/urls
        return `<article class="assist-message">
          ${m.title ? `<h3 class="assist-title">${esc(m.title)}</h3>` : ''}
          ${m.body ? `<p class="assist-body">${esc(m.body)}</p>` : ''}
          ${m.action ? `<p class="assist-action">${esc(m.action)}</p>` : ''}
          ${linksHtml}
          ${m.path ? `<p class="assist-path"><code>${esc(m.path)}</code></p>` : ''}
        </article>`;
      })
      .join('');

    const ack =
      payload.reportId && payload.correlationId && typeof opts.onAcknowledge === 'function'
        ? `<div class="assist-actions"><button type="button" class="btn btn-primary" id="assist-ack-btn">Confirm</button></div>`
        : '';

    host.innerHTML = `<div class="assist-report" data-report-id="${esc(
      payload.reportId
    )}" data-correlation-id="${esc(payload.correlationId)}">${list}${ack}</div>`;

    if (payload.reportId) {
      try {
        sessionStorage.setItem('st_assist_report_id', payload.reportId);
      } catch {
        /* ignore */
      }
    }
    if (payload.correlationId) {
      try {
        sessionStorage.setItem('st_assist_correlation_id', payload.correlationId);
      } catch {
        /* ignore */
      }
    }
    if (payload.calculationId) {
      try {
        sessionStorage.setItem('st_last_calculation_id', payload.calculationId);
      } catch {
        /* ignore */
      }
    }

    const btn = host.querySelector('#assist-ack-btn');
    if (btn && typeof opts.onAcknowledge === 'function') {
      btn.addEventListener('click', () => {
        opts.onAcknowledge({
          reportId: payload.reportId,
          correlationId: payload.correlationId,
        });
      });
    }
    return payload;
  }

  function renderAcknowledged(host) {
    if (!host) return;
    host.hidden = false;
    host.classList.add('assist-view');
    // Minimal chrome only — not advice
    host.innerHTML = '<p class="assist-ack-done">Confirmed</p>';
  }

  global.HmrcAssist = {
    esc,
    normaliseMessages,
    extractAssistPayload,
    renderAssist,
    renderAcknowledged,
  };
})(typeof window !== 'undefined' ? window : globalThis);
