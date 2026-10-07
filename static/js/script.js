(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const form = byId('analyzer-form');
  const input = byId('ip-input');
  const errorBox = byId('input-error');
  const inputWrap = document.querySelector('.input-wrap');
  const scanStatus = byId('scan-status');
  const resultLayout = byId('result-layout');
  const scanMessages = [
    'INITIALIZING SCAN...',
    'VALIDATING ADDRESS...',
    'ANALYZING NETWORK RANGE...',
    'IDENTIFYING ADDRESS CLASS...',
    'SCAN COMPLETE'
  ];
  let requestInProgress = false;

  function isValidIpLiteral(value) {
    const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
    if (ipv4Pattern.test(value)) return true;
    if (!value.includes(':') || /[^\da-f:.]/i.test(value)) return false;

    // IPv4-mapped IPv6 may end in dotted-decimal notation; count that tail as two groups.
    let address = value;
    const dottedTail = address.match(/(?:^|:)(\d+\.\d+\.\d+\.\d+)$/);
    if (dottedTail) {
      if (!ipv4Pattern.test(dottedTail[1])) return false;
      const octets = dottedTail[1].split('.').map(Number);
      const mappedTail = `${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
      address = address.slice(0, -dottedTail[1].length) + mappedTail;
    }
    if ((address.match(/::/g) || []).length > 1) return false;

    const compressed = address.includes('::');
    const sides = compressed ? address.split('::') : [address];
    const groups = sides.flatMap((side) => side ? side.split(':') : []);
    if (groups.some((group) => !/^[\da-f]{1,4}$/i.test(group))) return false;
    return compressed ? groups.length < 8 : groups.length === 8;
  }

  function animateServerValue(element) {
    element.classList.remove('data-arrive');
    void element.offsetWidth;
    element.classList.add('data-arrive');
  }

  function setInputError(message) {
    errorBox.innerHTML = `<strong>INVALID IP ADDRESS</strong><br>${message}`;
    errorBox.hidden = false;
    input.setAttribute('aria-invalid', 'true');
    inputWrap.classList.add('invalid');
    input.focus();
  }

  function clearInputError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
    input.setAttribute('aria-invalid', 'false');
    inputWrap.classList.remove('invalid');
  }

  function sleep(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  async function runScanSequence() {
    byId('scan-message').textContent = scanMessages[0];
    byId('scan-submessage').textContent = 'Secure local analysis sequence';
    scanStatus.hidden = false;
    scanStatus.querySelector('.scan-progress i').style.animation = 'none';
    // Reflow restarts the CSS progress animation on every scan.
    void scanStatus.offsetWidth;
    scanStatus.querySelector('.scan-progress i').style.animation = '';

    for (let index = 0; index < scanMessages.length; index += 1) {
      byId('scan-message').textContent = scanMessages[index];
      if (index === 1) byId('scan-submessage').textContent = 'Validating with Python ipaddress';
      if (index === 2) byId('scan-submessage').textContent = 'No network traffic is sent to the target';
      if (index === 3) byId('scan-submessage').textContent = 'Mapping address scope and class';
      if (index < scanMessages.length - 1) await sleep(390);
    }
  }

  function updateStatistics(data) {
    byId('private-count').textContent = data.type === 'Private' ? 'DETECTED' : 'NOT DETECTED';
    byId('public-count').textContent = data.type === 'Public' ? 'DETECTED' : 'NOT DETECTED';
  }

  function displayResult(data) {
    byId('result-ip').textContent = data.ip;
    byId('result-version').textContent = data.version;
    byId('result-class').textContent = data.class.toUpperCase();
    byId('result-type').textContent = data.type.toUpperCase();
    const badge = byId('result-type-badge');
    badge.textContent = data.type.toUpperCase();
    badge.className = 'type-badge';
    if (data.type === 'Private') badge.classList.add('private');
    if (data.type === 'Special/Reserved') badge.classList.add('special');

    document.querySelectorAll('.class-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.class === data.class);
    });
    byId('class-detected').textContent = data.class === 'N/A'
      ? 'IPv6 / NO CLASS'
      : `${data.class.toUpperCase()} DETECTED`;
    updateStatistics(data);
    resultLayout.hidden = false;
    resultLayout.classList.remove('result-layout');
    void resultLayout.offsetWidth;
    resultLayout.classList.add('result-layout');
  }

  async function analyzeAddress(address) {
    const response = await fetch('/api/analyze-ip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: address })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Please enter a valid IPv4 or IPv6 address.');
    return data;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (requestInProgress) return;
    clearInputError();
    resultLayout.hidden = true;
    scanStatus.hidden = true;
    document.querySelectorAll('.class-item').forEach((item) => item.classList.remove('active'));
    byId('class-detected').textContent = 'AWAITING ANALYSIS';
    byId('private-count').textContent = 'READY';
    byId('public-count').textContent = 'READY';
    const address = input.value.trim();
    if (!address) {
      setInputError('Please enter a valid IPv4 or IPv6 address.');
      return;
    }
    if (!isValidIpLiteral(address)) {
      setInputError('Please enter a valid IPv4 or IPv6 address.');
      return;
    }

    requestInProgress = true;
    resultLayout.hidden = true;
    byId('analyze-button').disabled = true;
    try {
      // Run the visual sequence and API request concurrently to avoid artificial wait.
      const [data] = await Promise.all([analyzeAddress(address), runScanSequence()]);
      displayResult(data);
      const terminal = byId('terminal-body');
      terminal.innerHTML = [
        'Initializing network interface...',
        'Detecting hostname...',
        'Resolving IP...',
        `Checking address type... ${data.type}`,
        `Checking address class... ${data.class}`,
        'Analysis complete.'
      ].map((line, index) => `<p class="${index === 5 ? 'terminal-done' : ''}" style="--line-index:${index}"><span>&gt;</span> ${line}${index === 5 ? '<b>_</b>' : ''}</p>`).join('');
      terminal.classList.add('animated');
      scanStatus.hidden = true;
    } catch (error) {
      scanStatus.hidden = true;
      setInputError(error.message || 'Please enter a valid IPv4 or IPv6 address.');
    } finally {
      requestInProgress = false;
      byId('analyze-button').disabled = false;
    }
  });

  document.querySelectorAll('.quick-picks button').forEach((button) => {
    button.addEventListener('click', () => {
      input.value = button.dataset.ip;
      clearInputError();
      input.focus();
    });
  });

  byId('clear-input').addEventListener('click', () => {
    input.value = '';
    clearInputError();
    input.focus();
  });

  byId('reset-analysis').addEventListener('click', () => {
    resultLayout.hidden = true;
    scanStatus.hidden = true;
    input.value = '';
    clearInputError();
    document.querySelectorAll('.class-item').forEach((item) => item.classList.remove('active'));
    byId('class-detected').textContent = 'AWAITING ANALYSIS';
    byId('private-count').textContent = 'READY';
    byId('public-count').textContent = 'READY';
    byId('terminal-body').innerHTML = '<p><span>&gt;</span> Initializing network interface...</p><p><span>&gt;</span> Detecting hostname...</p><p><span>&gt;</span> Resolving IP...</p><p><span>&gt;</span> Checking address type...</p><p><span>&gt;</span> Checking address class...</p><p class="terminal-done"><span>&gt;</span> Analysis complete.<b>_</b></p>';
    input.focus();
  });

  byId('copy-ip').addEventListener('click', async (event) => {
    const ip = byId('server-ip').textContent.trim();
    if (!ip || ip === 'SCANNING...' || ip === 'UNAVAILABLE') return;
    try {
      await navigator.clipboard.writeText(ip);
      event.currentTarget.innerHTML = 'COPIED <span aria-hidden="true">✓</span>';
      window.setTimeout(() => { event.currentTarget.innerHTML = 'COPY <span aria-hidden="true">▢</span>'; }, 1400);
    } catch (_error) {
      const temporary = document.createElement('textarea');
      temporary.value = ip;
      temporary.setAttribute('readonly', '');
      temporary.style.position = 'absolute';
      temporary.style.left = '-9999px';
      document.body.appendChild(temporary);
      temporary.select();
      document.execCommand('copy');
      temporary.remove();
      event.currentTarget.textContent = 'COPIED';
      window.setTimeout(() => { event.currentTarget.textContent = 'COPY'; }, 1400);
    }
  });

  async function loadNetworkInfo() {
    try {
      const response = await fetch('/api/network-info');
      if (!response.ok) throw new Error('Network information is temporarily unavailable.');
      const info = await response.json();
      byId('server-ip').textContent = info.ip;
      byId('server-hostname').textContent = info.hostname || 'Unavailable';
      byId('server-fqdn').textContent = info.fqdn || info.hostname || 'Unavailable';
      byId('server-version').textContent = info.version || 'Unavailable';
      byId('server-runtime').textContent = info.runtime || 'Server';
      byId('scope-note').textContent = info.scope_note;
      ['server-ip', 'server-hostname', 'server-fqdn', 'server-version', 'server-runtime'].forEach((id) => animateServerValue(byId(id)));
    } catch (_error) {
      byId('server-ip').textContent = 'UNAVAILABLE';
      byId('server-hostname').textContent = 'UNAVAILABLE';
      byId('server-fqdn').textContent = 'UNAVAILABLE';
      byId('server-version').textContent = '—';
      byId('network-error').textContent = 'Could not retrieve server network information.';
      byId('network-error').hidden = false;
    }
  }

  byId('start-scan').addEventListener('click', async () => {
    await loadNetworkInfo();
    byId('dashboard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const menuButton = document.querySelector('.menu-toggle');
  const navigation = byId('primary-nav');
  menuButton.addEventListener('click', () => {
    const expanded = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!expanded));
    menuButton.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
    navigation.classList.toggle('open', !expanded);
  });
  navigation.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open navigation');
      navigation.classList.remove('open');
    });
  });

  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
  } else {
    document.querySelectorAll('.reveal').forEach((element) => element.classList.add('visible'));
  }

  input.addEventListener('input', () => {
    if (!errorBox.hidden) clearInputError();
  });

  loadNetworkInfo();
})();
