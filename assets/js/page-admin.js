(function () {
  'use strict';

  // Read and remove credentials synchronously, before any other page assets or API calls.
  // /command is an in-place alias: keep credentials in memory, never forward them in a URL.
  let incoming = null;
  let incomingInvalid = false;
  let cleanupFailed = false;
  try {
    const params = new URLSearchParams(window.location.search);
    const hasCredentials = params.has('token') || params.has('email');
    if (hasCredentials) {
      incoming = { token: params.get('token') || '', email: params.get('email') || '' };
      incomingInvalid = params.getAll('token').length !== 1 || params.getAll('email').length !== 1;
    }
    const path = /^\/command(?:\.html)?\/?$/.test(window.location.pathname) ? '/admin' : window.location.pathname;
    if (window.location.search || window.location.hash || path !== window.location.pathname) {
      window.history.replaceState(null, '', path);
    }
  } catch (_) {
    incoming = null;
    cleanupFailed = true;
  }

  const BASE = 'https://exujdeqbxjjqnigqphgr.supabase.co/functions/v1';
  const API_KEY = 'sb_publishable__NHmUVigcA0TziMQnZvB0A_kFTfZ1Kz';
  const PAGE_SIZE = 25;
  const previewOnly = !['https://shadowrealmhq.com', 'https://www.shadowrealmhq.com'].includes(window.location.origin) && !['localhost', '127.0.0.1'].includes(window.location.hostname);
  const LOGIN_CONFIRMATION = 'If this address is authorised, an access link will arrive shortly. Check your inbox and spam. If nothing arrives, try again.';
  const SUSPENSION_WARNING = 'Restricted Vault access is blocked. Billing and cancellation remain available. Payment plans are not changed.';
  const CONFIG = {
    overview: { title: 'Overview', description: 'The Realm, at a glance.' },
    members: { title: 'Members', description: 'Automatic enlistment stays on. Manage access, not payment plans.', search: 'email', filters: ['all', 'active', 'suspended'], singular: 'Member' },
    wall: { title: 'Wall', description: 'Review the marks. Hide or restore a record without deleting it.', search: 'name', filters: ['all', 'visible', 'hidden'], singular: 'Wall record' },
    transmissions: { title: 'Transmissions', description: 'Control which signals are published and pinned.', search: 'body', filters: ['all', 'published', 'unpublished'], singular: 'Transmission' },
    contacts: { title: 'Inbox', description: 'Read incoming messages. Resolve or reopen the record.', search: 'email', filters: ['all', 'open', 'resolved'], singular: 'Contact' },
    audit: { title: 'Activity', description: 'Read-only history. Every change, target and reason on record.', filters: ['all'], singular: 'Activity record' }
  };
  // Nothing in this closure is persisted, exposed on window, or sent to analytics.
  const state = {
    session: null, owner: null, epoch: 0, tab: 'overview', items: [],
    revision: 0, requestNumber: 0, dataController: null, loading: false,
    total: 0, modal: null, pending: false, authBusy: false, searchTimer: null,
    prefs: Object.create(null)
  };
  const controllers = new Set();
  const startedAt = performance.now();
  const $ = id => document.getElementById(id);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text === '' ? '' : printable(text);
    return node;
  }
  function printable(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'object') {
      try { return JSON.stringify(value, null, 2); } catch (_) { return '[Unreadable value]'; }
    }
    return String(value);
  }
  function humanise(value) {
    return String(value).replace(/_/g, ' ').replace(/^./, char => char.toUpperCase());
  }
  function dateText(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return printable(value);
    return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  function createdAt(item) { return item.created_at || item.joined_at || item.date; }
  function notice(id, text) {
    const node = $(id);
    node.textContent = text || '';
    node.hidden = !text;
  }
  function button(text, callback, className, label) {
    const node = el('button', 'button' + (className ? ' ' + className : ''), text);
    node.type = 'button';
    if (label) node.setAttribute('aria-label', label);
    node.addEventListener('click', callback);
    return node;
  }
  function badge(text, tone) { return el('span', 'status-badge' + (tone ? ' is-' + tone : ''), text); }
  function abortError() { const error = new Error('Request superseded'); error.silent = true; return error; }
  function apiError(status) { const error = new Error('Request not completed'); error.status = status; return error; }
  function validCredentials(credentials) {
    return credentials && typeof credentials.token === 'string' && credentials.token.length > 0 && credentials.token.length <= 4096 && !/\s/.test(credentials.token) &&
      typeof credentials.email === 'string' && credentials.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email);
  }
  function parseAccessLink(value) {
    // Strict public origin and path; never navigate to pasted content or follow its redirects.
    const raw = value.trim();
    if (!/^https:\/\/shadowrealmhq\.com\/admin(?:\.html)?\?/.test(raw)) return null;
    try {
      const url = new URL(raw);
      if (url.origin !== 'https://shadowrealmhq.com' || url.username || url.password || url.port || url.hash || !/^\/admin(?:\.html)?$/.test(url.pathname)) return null;
      if (url.searchParams.getAll('token').length !== 1 || url.searchParams.getAll('email').length !== 1) return null;
      const credentials = { token: url.searchParams.get('token'), email: url.searchParams.get('email') };
      return validCredentials(credentials) ? credentials : null;
    } catch (_) { return null; }
  }

  async function request(endpoint, payload, options) {
    if (previewOnly) throw abortError();
    const opts = options || {};
    const epoch = state.epoch;
    const session = state.session;
    if (opts.authenticated && !session) throw abortError();
    const controller = opts.controller || new AbortController();
    controllers.add(controller);
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    const headers = { apikey: API_KEY, 'Content-Type': 'application/json' };
    if (opts.authenticated) headers.Authorization = 'Bearer ' + session;
    try {
      const response = await fetch(BASE + '/' + endpoint, {
        method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal,
        credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', redirect: 'error'
      });
      if (epoch !== state.epoch) throw abortError();
      if (opts.authenticated && (response.status === 401 || response.status === 403)) {
        if (response.status === 401) resetLogin('Your session has expired. Request a new access link to continue.');
        else restrictAccess();
        throw abortError();
      }
      if (!response.ok) throw apiError(response.status);
      const data = await response.json().catch(() => null);
      if (epoch !== state.epoch) throw abortError();
      if (!data || data.ok !== true) throw apiError(502);
      return data;
    } catch (error) {
      if (epoch !== state.epoch) throw abortError();
      throw error;
    } finally {
      window.clearTimeout(timeout);
      controllers.delete(controller);
    }
  }
  function gate(panel) {
    $('access-panel').hidden = false;
    $('console').hidden = true;
    ['login-panel', 'verifying-panel', 'restricted-panel', 'boot-error-panel'].forEach(id => { $(id).hidden = id !== panel; });
  }
  function closeDetails() {
    if ($('details-dialog').open) $('details-dialog').close();
    $('details-content').replaceChildren();
    $('details-actions').replaceChildren();
    $('details-target').textContent = '';
    syncDialogLock();
  }
  function closeConfirmation() {
    if ($('confirm-dialog').open) $('confirm-dialog').close();
    $('confirm-form').reset();
    $('confirm-target').textContent = '';
    $('confirm-id').textContent = '';
    state.modal = null;
    syncDialogLock();
  }
  function syncDialogLock() { document.body.classList.toggle('has-dialog', $('details-dialog').open || $('confirm-dialog').open); }
  function wipeState() {
    state.epoch += 1;
    state.requestNumber += 1;
    state.revision += 1;
    window.clearTimeout(state.searchTimer);
    controllers.forEach(controller => controller.abort());
    controllers.clear();
    state.dataController = null;
    state.session = null;
    state.owner = null;
    state.items = [];
    state.prefs = Object.create(null);
    state.pending = false;
    state.loading = false;
    state.authBusy = false;
    state.tab = 'overview';
    state.total = 0;
    closeConfirmation();
    closeDetails();
    $('content').replaceChildren();
    $('content').setAttribute('aria-busy', 'false');
    $('last-updated').textContent = '';
    $('page-summary').textContent = '';
    $('session-label').textContent = 'Owner clearance required.';
    $('logout').hidden = true;
    $('logout').disabled = false;
    $('search').value = '';
    $('login-form').reset();
    $('access-link-form').reset();
    $('access-link-disclosure').open = false;
    $('access-link').removeAttribute('aria-invalid');
    $('login-submit').disabled = cleanupFailed || previewOnly;
    $('access-link-submit').disabled = cleanupFailed || previewOnly;
    notice('access-link-error', '');
    notice('workspace-status', '');
    notice('login-status', '');
    setMutationPending(false);
  }
  function resetLogin(message, focus) {
    wipeState();
    gate('login-panel');
    notice('login-status', message);
    if (focus !== false) $('login-email').focus();
  }
  function restrictAccess() {
    // The API is the authority. An is_admin value returned by login is deliberately ignored.
    wipeState();
    gate('restricted-panel');
    $('session-label').textContent = 'Access restricted. No data displayed.';
    $('restricted-title').focus();
  }
  async function verify(credentials) {
    if (state.authBusy || cleanupFailed || previewOnly) return;
    state.authBusy = true;
    gate('verifying-panel');
    $('verifying-title').textContent = 'Checking access.';
    $('verifying-status').textContent = 'Verifying your email link securely…';
    $('verifying-title').focus();
    const epoch = state.epoch;
    try {
      const data = await request('session', { action: 'verify', token: credentials.token, email: credentials.email });
      if (typeof data.session !== 'string' || !data.session || /[\r\n]/.test(data.session)) throw apiError(502);
      state.session = data.session;
      state.authBusy = false;
      await boot();
    } catch (error) {
      if (error.silent || epoch !== state.epoch) return;
      resetLogin('This link could not be verified. It may have expired or already been used. Request a new access link and try again.');
    } finally {
      // Do not retain the incoming one-time token after verification.
      credentials.token = '';
      credentials.email = '';
      if (epoch === state.epoch) state.authBusy = false;
    }
  }
  async function boot() {
    if (!state.session || state.authBusy) return;
    state.authBusy = true;
    gate('verifying-panel');
    $('verifying-title').textContent = 'Checking owner clearance.';
    $('verifying-status').textContent = 'Realm HQ is checking this session against the active owner register…';
    const epoch = state.epoch;
    try {
      const data = await request('moderation', { action: 'overview' }, { authenticated: true });
      if (!data.owner || typeof data.owner.email !== 'string' || !data.stats || !Array.isArray(data.recent)) throw apiError(502);
      state.owner = { email: data.owner.email };
      state.tab = 'overview';
      state.revision += 1;
      $('access-panel').hidden = true;
      $('console').hidden = false;
      $('logout').hidden = false;
      $('session-label').textContent = data.owner.email + ' / TAB SESSION';
      configureView();
      renderOverview(data);
      updated();
    } catch (error) {
      if (error.silent || epoch !== state.epoch) return;
      gate('boot-error-panel');
      $('boot-error-title').focus();
    } finally { if (epoch === state.epoch) state.authBusy = false; }
  }
  async function logout() {
    if (state.pending) return;
    const session = state.session;
    resetLogin(session ? 'Signed out of this tab. Ending the server session…' : 'Signed out of this tab.');
    if (!session) return;
    const epoch = state.epoch;
    try {
      await request('session', { action: 'logout', session });
      if (epoch === state.epoch) notice('login-status', 'Signed out. Request a new access link when you need to return.');
    } catch (error) {
      if (!error.silent && epoch === state.epoch) notice('login-status', 'Signed out of this tab. Server sign-out could not be confirmed. This tab no longer holds your session.');
    }
  }
  function prefs() {
    if (!state.prefs[state.tab]) state.prefs[state.tab] = { page: 1, page_size: PAGE_SIZE, search: '', filter: 'all' };
    return state.prefs[state.tab];
  }
  function configureView() {
    const config = CONFIG[state.tab];
    document.querySelectorAll('[data-tab]').forEach(node => {
      const selected = node.dataset.tab === state.tab;
      node.setAttribute('aria-selected', String(selected));
      node.tabIndex = selected ? 0 : -1;
    });
    $('workspace').setAttribute('aria-labelledby', 'tab-' + state.tab);
    $('view-title').textContent = config.title;
    $('view-description').textContent = config.description;
    $('list-controls').hidden = state.tab === 'overview';
    $('pagination').hidden = true;
    if (state.tab !== 'overview') {
      const view = prefs();
      $('search-field').hidden = !config.search;
      $('search').disabled = !config.search;
      $('search-label').textContent = 'Search by ' + (config.search || 'email');
      $('search').placeholder = 'Search ' + (config.search || 'email') + '…';
      $('search').value = view.search;
      $('filter').replaceChildren();
      config.filters.forEach(filter => {
        const option = el('option', '', filter === 'all' ? 'All records' : humanise(filter));
        option.value = filter;
        $('filter').append(option);
      });
      $('filter').value = view.filter;
      $('filter').disabled = config.filters.length === 1;
      $('clear-filters').disabled = !view.search && view.filter === 'all';
    }
  }
  function setTab(tab, filter) {
    if (!CONFIG[tab] || !state.session || state.pending) return;
    window.clearTimeout(state.searchTimer);
    closeConfirmation();
    closeDetails();
    state.tab = tab;
    if (filter !== undefined && tab !== 'overview') {
      prefs().filter = filter;
      prefs().page = 1;
      prefs().search = '';
    }
    configureView();
    notice('workspace-status', '');
    loadView();
  }
  function skeleton() {
    $('content').replaceChildren();
    $('content').setAttribute('aria-busy', 'true');
    const holder = el('div', 'loading-state');
    holder.setAttribute('role', 'status');
    holder.append(el('span', 'sr-only', 'Loading ' + CONFIG[state.tab].title.toLowerCase() + '…'));
    const shapes = el('div');
    shapes.setAttribute('aria-hidden', 'true');
    if (state.tab === 'overview') shapes.append(el('span', 'skeleton skeleton-stat'));
    const rows = el('div', 'table-wrap');
    for (let index = 0; index < 4; index += 1) {
      const row = el('div', 'skeleton-row');
      row.append(el('span', 'skeleton'), el('span', 'skeleton'), el('span', 'skeleton short'));
      rows.append(row);
    }
    shapes.append(rows);
    holder.append(shapes);
    $('content').append(holder);
  }
  function invalidateView() {
    state.requestNumber += 1;
    state.revision += 1;
    state.items = [];
    state.loading = true;
    if (state.dataController) state.dataController.abort();
    state.dataController = null;
    closeDetails();
    $('refresh').disabled = true;
    $('previous').disabled = true;
    $('next').disabled = true;
    $('pagination').hidden = true;
    $('last-updated').textContent = '';
    skeleton();
  }
  async function loadView() {
    if (!state.session || state.pending) return;
    window.clearTimeout(state.searchTimer);
    invalidateView();
    const requestNumber = state.requestNumber;
    const tab = state.tab;
    const controller = new AbortController();
    state.dataController = controller;
    const payload = tab === 'overview' ? { action: 'overview' } : Object.assign({ action: 'list', resource: tab }, prefs());
    try {
      const data = await request('moderation', payload, { authenticated: true, controller });
      if (requestNumber !== state.requestNumber || tab !== state.tab) return;
      if (tab === 'overview') {
        if (!data.stats || !Array.isArray(data.recent) || !data.owner || typeof data.owner.email !== 'string') throw apiError(502);
        state.owner = { email: data.owner.email };
        $('session-label').textContent = data.owner.email + ' / TAB SESSION';
        renderOverview(data);
      } else {
        if (!Array.isArray(data.items) || !Number.isSafeInteger(data.total) || data.total < 0 || !Number.isSafeInteger(data.page) || data.page < 1 || !Number.isSafeInteger(data.page_size) || data.page_size < 1 || data.page_size > 100) throw apiError(502);
        state.total = data.total;
        const lastPage = Math.max(1, Math.ceil(data.total / data.page_size));
        if (data.page > lastPage) { prefs().page = lastPage; loadView(); return; }
        prefs().page = data.page;
        prefs().page_size = data.page_size;
        state.items = data.items.filter(item => item && typeof item === 'object').map(item => Object.freeze(Object.assign({}, item)));
        renderList();
        renderPagination();
      }
      updated();
    } catch (error) {
      if (error.silent || requestNumber !== state.requestNumber || tab !== state.tab) return;
      const message = error.status === 429 ? 'The desk is receiving too many requests. Wait a moment, then retry.' : 'We could not load these records. Check your connection, then retry. No old records are shown.';
      $('content').replaceChildren(emptyState('Connection interrupted.', message, 'Retry', () => loadView(), true));
    } finally {
      if (requestNumber === state.requestNumber) {
        state.loading = false;
        state.dataController = null;
        $('refresh').disabled = false;
        $('content').setAttribute('aria-busy', 'false');
      }
    }
  }
  function updated() {
    $('last-updated').textContent = 'UPDATED ' + new Intl.DateTimeFormat('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()) + ' / Refresh for the latest records.';
  }
  function emptyState(title, message, action, callback, isError) {
    const block = el('div', 'empty-state');
    if (isError) block.setAttribute('role', 'alert');
    block.append(el('p', 'empty-code', isError ? 'CONNECTION / INTERRUPTED' : 'REGISTER / CLEAR'), el('h3', '', title), el('p', 'muted', message));
    if (action) block.append(button(action, callback));
    return block;
  }
  function metricValue(value) { return Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString('en-AU') : '—'; }
  function renderOverview(data) {
    const root = document.createDocumentFragment();
    const stats = el('div', 'stat-grid');
    const definitions = [
      ['Members', 'members', 'suspended', 'suspended', 'members', 'suspended'],
      ['Wall records', 'wall', 'hidden_wall', 'hidden', 'wall', 'hidden'],
      ['Transmissions', 'transmissions', 'published_transmissions', 'published', 'transmissions', 'published'],
      ['Inbox', 'contacts', 'unresolved_contacts', 'unresolved', 'contacts', 'open']
    ];
    definitions.forEach(([title, total, subset, suffix, resource, filter]) => {
      const group = el('section', 'stat-group');
      group.setAttribute('aria-label', title + ' metrics');
      const main = button('', () => setTab(resource, 'all'), '', 'View all ' + title.toLowerCase() + ': ' + metricValue(data.stats[total]));
      main.className = 'stat-main';
      const name = el('span', 'stat-name', title);
      const arrow = el('span', '', '↗');
      arrow.setAttribute('aria-hidden', 'true');
      name.append(arrow);
      main.append(name, el('span', 'stat-value', metricValue(data.stats[total])));
      const secondary = button(metricValue(data.stats[subset]) + ' ' + suffix, () => setTab(resource, filter));
      secondary.className = 'stat-secondary';
      group.append(main, secondary);
      stats.append(group);
    });
    root.append(stats);
    const strip = el('div', 'protocol-strip');
    const copy = el('div');
    copy.append(el('h3', '', 'Automatic enlistment stays on.'), el('p', 'hint', 'New members join automatically. Moderation is separate from billing.'));
    strip.append(copy, badge('ENLISTMENT / ON', 'gold'));
    root.append(strip);
    const recentHead = el('div', 'section-heading');
    recentHead.append(el('h3', '', 'Recent activity'), button('View activity', () => setTab('audit'), 'button-quiet'));
    root.append(recentHead);
    const recent = data.recent.filter(item => item && typeof item === 'object');
    if (recent.length) root.append(recordTable('audit', recent));
    else root.append(emptyState('No changes on record yet.', 'Confirmed moderation changes will appear here with their target and reason.', 'Refresh activity', () => loadView()));
    $('content').replaceChildren(root);
    $('content').setAttribute('aria-busy', 'false');
    $('refresh').disabled = false;
  }
  function clearFilters() {
    window.clearTimeout(state.searchTimer);
    const view = prefs();
    view.search = '';
    view.filter = 'all';
    view.page = 1;
    configureView();
    loadView();
  }
  function renderList() {
    if (!state.items.length) {
      const filtered = prefs().search || prefs().filter !== 'all';
      const messages = {
        members: 'Members appear here after automatic enlistment. There is no approval queue.',
        wall: 'Wall marks will appear here as they are submitted.',
        transmissions: 'Transmissions will appear here when they are created.',
        contacts: 'Incoming contact messages will appear here.',
        audit: 'Confirmed moderation changes will appear here with their target, reason and before/after state.'
      };
      $('content').replaceChildren(emptyState(filtered ? 'No matching records.' : 'Nothing to review yet.', filtered ? 'Try another search or clear the current filters.' : messages[state.tab], filtered ? 'Clear filters' : 'Refresh', filtered ? clearFilters : () => loadView()));
    } else $('content').replaceChildren(recordTable(state.tab, state.items));
  }
  function renderPagination() {
    const view = prefs();
    const first = state.total ? (view.page - 1) * view.page_size + 1 : 0;
    const last = Math.min(view.page * view.page_size, state.total);
    const pages = Math.max(1, Math.ceil(state.total / view.page_size));
    $('page-summary').textContent = first + '–' + last + ' of ' + state.total.toLocaleString('en-AU') + ' / Page ' + view.page + ' of ' + pages;
    $('previous').disabled = view.page <= 1;
    $('next').disabled = view.page >= pages;
    $('pagination').hidden = false;
  }
  function targetName(resource, item) {
    if (resource === 'members') return printable(item.email);
    if (resource === 'wall') return printable(item.name);
    if (resource === 'transmissions') return printable(item.body);
    if (resource === 'contacts') return printable(item.name) + ' / ' + printable(item.email);
    return printable(item.action) + ' / ' + printable(item.resource) + ' / ' + printable(item.target_id);
  }
  function textCell(primary, secondary, preview) {
    const cell = el('div');
    cell.append(el('span', preview ? 'cell-text cell-preview' : 'cell-text', primary));
    if (secondary !== undefined) cell.append(el('span', 'cell-secondary', secondary));
    return cell;
  }
  function columns(resource, item) {
    if (resource === 'members') return [
      ['Member', textCell(item.email, item.username)], ['Tier', textCell(item.tier)],
      ['Status', badge(item.moderation_status || 'Unknown', item.moderation_status === 'suspended' ? 'warning' : '')], ['Joined', textCell(dateText(createdAt(item)))]];
    if (resource === 'wall') return [
      ['Name', textCell(item.name)], ['Mark', textCell(item.mark, undefined, true)], ['Added', textCell(dateText(createdAt(item)))],
      ['State', badge(typeof item.hidden === 'boolean' ? (item.hidden ? 'Hidden' : 'Visible') : 'Unknown', item.hidden ? 'warning' : '')]];
    if (resource === 'transmissions') return [
      ['Body', textCell(item.body, undefined, true)], ['Kind', textCell(item.kind)],
      ['State', textCell(typeof item.published === 'boolean' ? (item.published ? 'Published' : 'Unpublished') : 'Unknown', typeof item.pinned === 'boolean' ? (item.pinned ? 'Pinned' : 'Not pinned') : 'Pin state unknown')]];
    if (resource === 'contacts') return [
      ['Contact', textCell(item.name, item.email)], ['Message', textCell(item.message, undefined, true)],
      ['Type / received', textCell(item.type, dateText(createdAt(item)))], ['State', badge(typeof item.resolved === 'boolean' ? (item.resolved ? 'Resolved' : 'Open') : 'Unknown', item.resolved ? '' : 'gold')]];
    return [
      ['When', textCell(dateText(item.created_at))], ['Actor', textCell(item.actor_email)],
      ['Target', textCell(item.resource, item.target_id)], ['Action / reason', textCell(item.action, item.reason)]];
  }
  function recordTable(resource, items) {
    const wrapper = el('div', 'table-wrap');
    const table = el('table', 'record-table resource-' + resource);
    const caption = el('caption', 'sr-only', CONFIG[resource].title + ' records. Open a record for all details.');
    table.append(caption);
    const head = el('thead');
    const headRow = el('tr');
    const labels = columns(resource, items[0]).map(column => column[0]).concat('Actions');
    labels.forEach(label => { const th = el('th', '', label); th.scope = 'col'; headRow.append(th); });
    head.append(headRow);
    table.append(head);
    const body = el('tbody');
    items.forEach(item => {
      const row = el('tr');
      columns(resource, item).forEach(([label, value]) => { const td = el('td'); td.dataset.label = label; td.append(value); row.append(td); });
      const actions = el('td', 'actions-cell');
      actions.dataset.label = 'Actions';
      const controls = el('div', 'button-row');
      controls.append(button('Open record', () => openDetails(resource, item), 'button-quiet', 'Open ' + CONFIG[resource].singular.toLowerCase() + ': ' + targetName(resource, item)));
      if (resource !== 'audit') mutationButtons(resource, item, false).forEach(node => controls.append(node));
      actions.append(controls);
      row.append(actions);
      row.addEventListener('click', event => {
        if (event.target.closest('button, a, input, select, textarea')) return;
        if (window.getSelection() && !window.getSelection().isCollapsed) return;
        openDetails(resource, item);
      });
      body.append(row);
    });
    table.append(body);
    wrapper.append(table);
    return wrapper;
  }
  function itemIsCurrent(resource, item, revision) {
    return Boolean(state.session && state.owner && !state.loading && state.tab === resource && revision === state.revision &&
      state.items.some(current => String(current.id) === String(item.id) && current.moderation_version === item.moderation_version));
  }
  function canVersion(item) { return item.id !== undefined && item.id !== null && String(item.id).length > 0 && Number.isSafeInteger(item.moderation_version) && item.moderation_version >= 0; }
  function ownerIsTarget(item) { return Boolean(state.owner && typeof item.email === 'string' && item.email.trim().toLowerCase() === state.owner.email.trim().toLowerCase()); }
  function mutationButtons(resource, item, includeNotes) {
    const definitions = [];
    if (resource === 'members') {
      if (item.moderation_status === 'active') definitions.push(['Suspend', 'moderation_status', 'suspended', 'Member access: active → suspended.', ownerIsTarget(item)]);
      if (item.moderation_status === 'suspended') definitions.push(['Restore access', 'moderation_status', 'active', 'Member access: suspended → active.']);
      if (includeNotes) definitions.push(['Edit note', 'moderation_note', item.moderation_note == null ? '' : String(item.moderation_note), 'Replace the internal moderation note. Member status and payment plans stay unchanged.']);
    }
    if (resource === 'wall' && typeof item.hidden === 'boolean') definitions.push([item.hidden ? 'Restore to wall' : 'Hide from wall', 'hidden', !item.hidden, item.hidden ? 'Wall state: hidden → visible.' : 'Wall state: visible → hidden.']);
    if (resource === 'transmissions') {
      if (typeof item.published === 'boolean') definitions.push([item.published ? 'Unpublish' : 'Publish', 'published', !item.published, item.published ? 'Publication: published → unpublished.' : 'Publication: unpublished → published.']);
      if (typeof item.pinned === 'boolean') definitions.push([item.pinned ? 'Unpin' : 'Pin', 'pinned', !item.pinned, item.pinned ? 'Pin state: pinned → not pinned.' : 'Pin state: not pinned → pinned.']);
    }
    if (resource === 'contacts' && typeof item.resolved === 'boolean') definitions.push([item.resolved ? 'Reopen' : 'Resolve', 'resolved', !item.resolved, item.resolved ? 'Inbox state: resolved → open.' : 'Inbox state: open → resolved.']);
    return definitions.map(([label, field, value, intent, self]) => {
      const revision = state.revision;
      const node = button(label, () => openConfirmation({ resource, item, revision, label, field, value, intent }), field === 'moderation_status' && value === 'suspended' ? 'button-danger' : '', label + ': ' + targetName(resource, item));
      if (self || !canVersion(item)) {
        node.disabled = true;
        node.title = self ? 'The owner cannot suspend their own account.' : 'Record version unavailable. Refresh before making a change.';
        node.setAttribute('aria-label', label + '. ' + node.title);
      }
      return node;
    });
  }
  function openDetails(resource, item) {
    if (state.loading || state.pending) return;
    const labels = { moderation_version: 'Record version', moderation_note: 'Internal moderation note', before_state: 'Before state', after_state: 'After state' };
    $('details-resource').textContent = CONFIG[resource].title.toUpperCase() + ' / FULL RECORD';
    $('details-title').textContent = CONFIG[resource].singular + ' details';
    $('details-target').textContent = targetName(resource, item);
    $('details-actions').replaceChildren();
    if (resource !== 'audit') {
      mutationButtons(resource, item, true).forEach(node => $('details-actions').append(node));
      if (resource === 'members' && ownerIsTarget(item)) $('details-actions').append(el('p', 'hint', 'This is the signed-in owner. Self-suspension is not available.'));
      if (!canVersion(item)) $('details-actions').append(el('p', 'error-text', 'Record version unavailable. Refresh the list before making changes.'));
    }
    const list = el('dl', 'detail-list');
    Object.keys(item).forEach(key => {
      const term = el('dt', '', labels[key] || humanise(key));
      const description = el('dd');
      if (typeof item[key] === 'object' && item[key] !== null) description.append(el('pre', 'state-code', printable(item[key])));
      else description.textContent = printable(item[key]);
      list.append(term, description);
    });
    $('details-content').replaceChildren(list);
    $('details-dialog').showModal();
    syncDialogLock();
  }
  function openConfirmation(context) {
    if (state.pending || !canVersion(context.item)) return;
    if (!itemIsCurrent(context.resource, context.item, context.revision)) {
      closeDetails();
      notice('workspace-status', 'This record is out of date. Refresh and reopen it before making a change.');
      return;
    }
    if (context.resource === 'members' && context.field === 'moderation_status' && context.value === 'suspended' && ownerIsTarget(context.item)) return;
    state.modal = Object.assign({}, context, { stale: false });
    $('confirm-form').reset();
    $('confirm-title').textContent = context.label === 'Edit note' ? 'Edit internal note' : context.label + '?';
    $('confirm-target').textContent = targetName(context.resource, context.item);
    $('confirm-id').textContent = CONFIG[context.resource].singular + ' ID: ' + context.item.id + ' / Version: ' + context.item.moderation_version;
    $('confirm-intent').textContent = context.intent;
    notice('confirm-warning', context.resource === 'members' && context.field === 'moderation_status' && context.value === 'suspended' ? SUSPENSION_WARNING : '');
    $('note-field').hidden = context.field !== 'moderation_note';
    $('moderation-note').value = context.field === 'moderation_note' ? context.value : '';
    $('reason').removeAttribute('aria-invalid');
    $('moderation-note').removeAttribute('aria-invalid');
    $('confirm-save').textContent = context.field === 'moderation_note' ? 'Save note' : 'Save change';
    $('confirm-refresh').hidden = true;
    notice('confirm-error', '');
    setMutationPending(false);
    $('confirm-dialog').showModal();
    syncDialogLock();
    (context.field === 'moderation_note' ? $('moderation-note') : $('reason')).focus();
  }
  function setMutationPending(pending) {
    state.pending = pending;
    ['confirm-save', 'confirm-cancel', 'confirm-refresh', 'moderation-note', 'reason'].forEach(id => { $(id).disabled = pending; });
    if (!pending && state.modal && state.modal.stale) $('confirm-save').disabled = true;
    $('confirm-progress').hidden = !pending;
    $('confirm-form').setAttribute('aria-busy', String(pending));
    $('logout').disabled = pending;
  }
  function staleConfirmation(message) {
    if (!state.modal) return;
    state.modal.stale = true;
    notice('confirm-error', message);
    $('confirm-refresh').hidden = false;
    $('confirm-save').disabled = true;
  }
  async function saveChange(event) {
    event.preventDefault();
    const context = state.modal;
    if (!context || state.pending || context.stale) return;
    notice('confirm-error', '');
    if (!itemIsCurrent(context.resource, context.item, context.revision)) {
      staleConfirmation('This record has changed or the list was refreshed. Refresh records and review the latest state before saving.');
      return;
    }
    const reason = $('reason').value.trim();
    if (reason.length < 3 || reason.length > 500) {
      notice('confirm-error', 'Enter a reason between 3 and 500 characters.');
      $('reason').setAttribute('aria-invalid', 'true');
      $('reason').focus();
      return;
    }
    $('reason').removeAttribute('aria-invalid');
    const value = context.field === 'moderation_note' ? $('moderation-note').value : context.value;
    if (context.field === 'moderation_note' && value.length > 1000) {
      notice('confirm-error', 'Keep the moderation note to 1,000 characters or fewer.');
      $('moderation-note').setAttribute('aria-invalid', 'true');
      $('moderation-note').focus();
      return;
    }
    // These fields are selected exclusively by the fixed controls above, never by row data.
    const changes = {};
    changes[context.field] = value;
    const epoch = state.epoch;
    setMutationPending(true);
    try {
      const data = await request('moderation', { action: 'mutate', resource: context.resource, id: String(context.item.id), version: context.item.moderation_version, changes, reason }, { authenticated: true });
      if (!data.item || String(data.item.id) !== String(context.item.id) || !Number.isSafeInteger(data.item.moderation_version) || data.item.moderation_version <= context.item.moderation_version) throw apiError(502);
      setMutationPending(false);
      const target = context.resource === 'transmissions' ? 'Transmission ' + context.item.id : targetName(context.resource, context.item);
      closeConfirmation();
      closeDetails();
      notice('workspace-status', 'Saved: ' + context.label + ' — ' + target + '. The change and reason are on record.');
      await loadView();
      $('refresh').focus();
    } catch (error) {
      if (error.silent || epoch !== state.epoch || state.modal !== context) return;
      if (error.status === 409) staleConfirmation('This record changed since you opened it (conflict 409). Your change was not applied. Refresh records, review the latest state and try again.');
      else if (!error.status || error.status >= 500) staleConfirmation('We could not confirm whether the change was saved. Your reason is still editable. Refresh records and check the current state before trying again.');
      else if (error.status === 429) notice('confirm-error', 'Too many requests. Wait a moment, then save again. Your reason is still here.');
      else notice('confirm-error', 'The change was not accepted. Check the intended state, note and required reason, or cancel and refresh the record.');
    } finally {
      if (epoch === state.epoch) setMutationPending(false);
    }
  }

  function init() {
    $('login-submit').disabled = cleanupFailed || previewOnly;
    $('access-link-submit').disabled = cleanupFailed || previewOnly;
    $('login-form').addEventListener('submit', async event => {
      event.preventDefault();
      if (state.authBusy || cleanupFailed || previewOnly || !$('login-form').reportValidity()) return;
      state.authBusy = true;
      $('login-submit').disabled = true;
      $('access-link-submit').disabled = true;
      $('login-submit').textContent = 'Requesting link…';
      notice('login-status', '');
      const epoch = state.epoch;
      try {
        await request('magic-link', { email: $('login-email').value.trim(), destination: 'admin', company: '', elapsed_ms: Math.max(0, Math.floor(performance.now() - startedAt)) });
      } catch (_) {
        // Deliberately identical for unrecognised addresses, rate limits and network failures.
      } finally {
        if (epoch === state.epoch) {
          notice('login-status', LOGIN_CONFIRMATION);
          state.authBusy = false;
          $('login-submit').disabled = false;
          $('access-link-submit').disabled = false;
          $('login-submit').textContent = 'Send access link';
        }
      }
    });
    $('access-link-form').addEventListener('submit', event => {
      event.preventDefault();
      if (state.authBusy || cleanupFailed || previewOnly) return;
      const credentials = parseAccessLink($('access-link').value);
      if (!credentials) {
        notice('access-link-error', 'Use the full https://shadowrealmhq.com/admin or /admin.html email link with one token and one email. Other hosts, paths and incomplete links are not accepted.');
        $('access-link').setAttribute('aria-invalid', 'true');
        $('access-link').focus();
        return;
      }
      $('access-link').value = '';
      $('access-link').removeAttribute('aria-invalid');
      notice('access-link-error', '');
      verify(credentials);
    });
    $('logout').addEventListener('click', logout);
    $('restricted-reset').addEventListener('click', () => resetLogin(''));
    $('boot-reset').addEventListener('click', logout);
    $('boot-retry').addEventListener('click', boot);
    $('refresh').addEventListener('click', () => { notice('workspace-status', ''); loadView(); });
    $('tabs').addEventListener('click', event => { const tab = event.target.closest('[data-tab]'); if (tab) setTab(tab.dataset.tab); });
    $('tabs').addEventListener('keydown', event => {
      const tabs = Array.from($('tabs').querySelectorAll('[data-tab]'));
      let index = tabs.indexOf(document.activeElement);
      if (index < 0) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') index = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') index = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs[index].focus();
      setTab(tabs[index].dataset.tab);
    });
    $('search').addEventListener('input', () => {
      if (!state.session || state.tab === 'overview' || state.tab === 'audit') return;
      const view = prefs();
      view.search = $('search').value.trim();
      view.page = 1;
      $('clear-filters').disabled = !view.search && view.filter === 'all';
      notice('workspace-status', '');
      window.clearTimeout(state.searchTimer);
      // Discard old rows immediately: no stale controls during the debounce window.
      invalidateView();
      state.searchTimer = window.setTimeout(loadView, 300);
    });
    $('list-controls').addEventListener('submit', event => { event.preventDefault(); loadView(); });
    $('filter').addEventListener('change', () => {
      prefs().filter = $('filter').value;
      prefs().page = 1;
      $('clear-filters').disabled = !prefs().search && prefs().filter === 'all';
      notice('workspace-status', '');
      loadView();
    });
    $('clear-filters').addEventListener('click', clearFilters);
    $('previous').addEventListener('click', () => { if (!state.loading && prefs().page > 1) { prefs().page -= 1; loadView(); } });
    $('next').addEventListener('click', () => { if (!state.loading && prefs().page * prefs().page_size < state.total) { prefs().page += 1; loadView(); } });
    $('details-close').addEventListener('click', closeDetails);
    $('details-dialog').addEventListener('cancel', event => { event.preventDefault(); if (!state.pending) closeDetails(); });
    $('details-dialog').addEventListener('close', syncDialogLock);
    $('confirm-dialog').addEventListener('cancel', event => { event.preventDefault(); if (!state.pending) closeConfirmation(); });
    $('confirm-dialog').addEventListener('close', syncDialogLock);
    $('confirm-cancel').addEventListener('click', () => { if (!state.pending) closeConfirmation(); });
    $('confirm-refresh').addEventListener('click', () => {
      if (state.pending) return;
      closeConfirmation();
      closeDetails();
      notice('workspace-status', 'Refreshing records. Reopen the target and review its current state before saving.');
      loadView();
    });
    $('confirm-form').addEventListener('submit', saveChange);
    // No sensitive DOM or session survives the back/forward cache.
    window.addEventListener('pagehide', () => resetLogin('', false));
    window.addEventListener('pageshow', event => { if (event.persisted) resetLogin('This tab was restored. Request a new access link to continue.', false); });
    if (previewOnly) {
      $('preview-warning').hidden = false;
      $('login-email').disabled = true;
      $('access-link').disabled = true;
      $('session-label').textContent = 'Preview only / Sign in on the live site.';
      if (incoming) { incoming.token = ''; incoming.email = ''; incoming = null; }
      return;
    }
    if (cleanupFailed) {
      incoming = null;
      notice('login-status', 'This browser could not remove access details from the address bar. No request was sent. Open https://shadowrealmhq.com/admin in a new tab and try again.');
      return;
    }
    if (incoming) {
      const credentials = incoming;
      incoming = null;
      if (incomingInvalid || !validCredentials(credentials)) {
        credentials.token = '';
        credentials.email = '';
        notice('login-status', 'This access link is incomplete or invalid. Request a new access link.');
      } else verify(credentials);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
