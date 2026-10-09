(function () {
  const MAX_NUMBER = 2500;
  const RANGE_SIZE = 250;
  const RANGE_COUNT = MAX_NUMBER / RANGE_SIZE;
  const PALETTE = ['#6b43b5', '#b69ae9', '#c7f36b', '#8b67cb', '#d8c7ff', '#443063', '#a788df', '#daf49e'];
  const SEED = {
    title: 'Sorteio da corrida.',
    subtitle: 'Gire a roleta para sortear um dos n\u00fameros participantes.',
    prizeName: 'Pr\u00eamio padr\u00e3o da corrida',
    prizeDescription: 'Procure a organiza\u00e7\u00e3o da corrida para receber seu pr\u00eamio.',
    available: Array.from({ length: MAX_NUMBER }, (_, index) => index + 1),
    drawn: []
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  let serverState = null;
  function api(action, payload) {
    const request = new XMLHttpRequest();
    request.open(action === 'load' ? 'GET' : 'POST', 'api.php' + (action === 'load' ? '' : '?action=' + encodeURIComponent(action)), false);
    request.setRequestHeader('Accept', 'application/json');
    if (action !== 'load') request.setRequestHeader('Content-Type', 'application/json');
    try {
      request.send(action === 'load' ? null : JSON.stringify(Object.assign({ action }, payload || {})));
      const response = JSON.parse(request.responseText || '{}');
      if (request.status < 200 || request.status >= 300) throw new Error(response.error || 'Falha ao comunicar com o servidor.');
      return response;
    } catch (error) {
      throw new Error(error.message || 'Não foi possível conectar ao servidor.');
    }
  }
  function reportServerError(error) {
    alert('Não foi possível acessar o sorteio no servidor. Verifique a conexão e tente novamente.\n\n' + error.message);
  }
  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function relativeLuminance(color) {
    const channels = color.match(/[a-f\d]{2}/gi).map(channel => parseInt(channel, 16) / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function contrastText(background) {
    const luminance = relativeLuminance(background);
    const darkContrast = (luminance + 0.05) / (relativeLuminance('#24123e') + 0.05);
    const whiteContrast = 1.05 / (luminance + 0.05);
    return darkContrast >= whiteContrast ? '#24123e' : '#ffffff';
  }

  function freshState() { return clone(SEED); }

  function read() {
    return serverState ? clone(serverState) : freshState();
  }

  function save(value) {
    const response = api('save', value);
    serverState = response.state;
    window.dispatchEvent(new CustomEvent('raffle-update'));
  }

  function refreshFromServer() {
    try {
      const latest = api('load').state;
      if (JSON.stringify(latest) !== JSON.stringify(serverState)) {
        serverState = latest;
        window.dispatchEvent(new CustomEvent('raffle-update'));
      }
    } catch (error) {
      // Keep the last server snapshot visible; actions still report the connection failure.
    }
  }

  function getRanges(available) {
    return Array.from({ length: RANGE_COUNT }, (_, index) => {
      const first = index * RANGE_SIZE + 1;
      const last = first + RANGE_SIZE - 1;
      return { index, first, last, label: first + '-' + last, numbers: available.filter(number => number >= first && number <= last) };
    });
  }

  const wheel = document.getElementById('wheelSvg');

  try {
    serverState = api('load').state;
  } catch (error) {
    document.body.insertAdjacentHTML('afterbegin', '<div class="server-error" role="alert">N&atilde;o foi poss&iacute;vel carregar o sorteio do servidor. Confirme que o site est&aacute; hospedado com PHP ativo.</div>');
  }

  function drawWheel() {
    if (!wheel) return;
    const data = read();
    const total = data.available.length;
    const words = (data.title || SEED.title).trim().split(/\s+/);
    const cut = Math.ceil(words.length / 2);
    document.getElementById('wheelTitle').innerHTML = escapeHtml(words.slice(0, cut).join(' ')) + '<br><em>' + escapeHtml(words.slice(cut).join(' ')) + '</em>';
    document.getElementById('wheelSubtitle').textContent = data.subtitle || SEED.subtitle;
    document.getElementById('numberCount').textContent = total + ' n\u00fameros restantes';
    const prizeLabel = document.getElementById('prizeNameLabel');
    if (prizeLabel) prizeLabel.textContent = data.prizeName || SEED.prizeName;
    const spinButton = document.getElementById('spinButton');
    spinButton.disabled = total === 0;
    spinButton.innerHTML = total ? 'Rodar as tr\u00eas op\u00e7\u00f5es <span>&#8599;</span>' : 'Todos os n\u00fameros sorteados <span>&#10022;</span>';
    wheel.innerHTML = '';
    wheel.style.transition = 'none';
    wheel.style.transform = 'rotate(0deg)';

    if (!total) {
      wheel.innerHTML = '<circle cx="250" cy="250" r="242" fill="#eee8f6"/><text x="250" y="245" text-anchor="middle" fill="#24123e" font-size="20" font-weight="700">Sorteio conclu\u00eddo</text><text x="250" y="276" text-anchor="middle" fill="#51465e" font-size="13">Todos os 2500 n\u00fameros foram sorteados</text>';
      return;
    }

    const ranges = getRanges(data.available).filter(range => range.numbers.length > 0);
    const labelStartRadius = 68;
    const labelEndRadius = 230;
    const labelLength = labelEndRadius - labelStartRadius;
    const startAngle = -90;
    let usedAngle = 0;

    ranges.forEach(range => {
      const rangeAngle = range.numbers.length / total * 360;
      const endAngle = usedAngle + rangeAngle;
      const middleAngle = startAngle + (usedAngle + rangeAngle / 2);
      const radians = angle => angle * Math.PI / 180;
      const radius = 242;
      const x1 = 250 + radius * Math.cos(radians(startAngle + usedAngle));
      const y1 = 250 + radius * Math.sin(radians(startAngle + usedAngle));
      const x2 = 250 + radius * Math.cos(radians(startAngle + endAngle));
      const y2 = 250 + radius * Math.sin(radians(startAngle + endAngle));
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      if (rangeAngle > 359.99) {
        path.setAttribute('d', `M250 250 L250 8 A242 242 0 1 1 250 492 A242 242 0 1 1 250 8 Z`);
      } else {
        path.setAttribute('d', `M250 250 L${x1} ${y1} A${radius} ${radius} 0 ${rangeAngle > 180 ? 1 : 0} 1 ${x2} ${y2} Z`);
      }
      path.setAttribute('fill', PALETTE[range.index % PALETTE.length]);
      path.setAttribute('stroke', '#fff');
      path.setAttribute('stroke-width', '2');
      wheel.appendChild(path);

      const normalizedAngle = ((middleAngle % 360) + 360) % 360;
      const flipForReading = normalizedAngle > 90 && normalizedAngle < 270;
      const anchorRadius = flipForReading ? labelEndRadius : labelStartRadius;
      const labelX = 250 + anchorRadius * Math.cos(radians(middleAngle));
      const labelY = 250 + anchorRadius * Math.sin(radians(middleAngle));
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('class', 'slice-label');
      text.setAttribute('x', String(labelX));
      text.setAttribute('y', String(labelY));
      text.setAttribute('transform', `rotate(${middleAngle + (flipForReading ? 180 : 0)} ${labelX} ${labelY})`);
      text.setAttribute('text-anchor', 'start');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', contrastText(PALETTE[range.index % PALETTE.length]));
      text.setAttribute('font-size', '15');
      text.setAttribute('font-family', 'Arial,sans-serif');
      text.setAttribute('font-weight', '700');
      if (range.label.length * 15 * 0.62 > labelLength) {
        text.setAttribute('textLength', String(labelLength));
        text.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      }
      text.textContent = range.label;
      wheel.appendChild(text);
      usedAngle = endAngle;
    });
    wheel.querySelectorAll('.slice-label').forEach(label => wheel.appendChild(label));
  }

  function showNumberInAllOptions(number) {
    const label = '#' + String(number).padStart(4, '0');
    ['wheelNumberResult', 'crateNumberResult', 'globeNumberResult', 'globeWinner'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.textContent = label;
    });
  }

  function prepareCrateReel(winner, available) {
    const track = document.getElementById('crateTrack');
    const viewport = track.parentElement;
    const targetIndex = 28;
    const cellCount = 36;
    const decoys = available.filter(number => number !== winner);
    track.innerHTML = '';
    track.style.transition = 'none';
    track.style.transform = 'translateX(0px)';
    let targetCell;
    for (let index = 0; index < cellCount; index++) {
      const cell = document.createElement('div');
      const number = index === targetIndex || decoys.length === 0 ? winner : decoys[Math.floor(Math.random() * decoys.length)];
      cell.className = 'crate-cell' + (index === targetIndex ? ' is-winner' : '');
      cell.textContent = String(number).padStart(4, '0');
      if (index === targetIndex) targetCell = cell;
      track.appendChild(cell);
    }
    const viewportBox = viewport.getBoundingClientRect();
    const targetBox = targetCell.getBoundingClientRect();
    const targetCenter = targetBox.left - viewportBox.left + targetBox.width / 2;
    const offset = viewport.clientWidth / 2 - targetCenter;
    track.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      track.style.transition = 'transform 5.4s cubic-bezier(.08,.78,.08,1)';
      track.style.transform = `translateX(${offset}px)`;
    }));
  }

  function spinWheelToNumber(winner, available) {
    const winnerRange = Math.floor((winner - 1) / RANGE_SIZE);
    const ranges = getRanges(available).filter(range => range.numbers.length > 0);
    const previousCount = ranges.filter(range => range.index < winnerRange).reduce((sum, range) => sum + range.numbers.length, 0);
    const winnerRangeCount = ranges.find(range => range.index === winnerRange).numbers.length;
    const offsetAngle = (previousCount + winnerRangeCount / 2) / available.length * 360;
    const rotation = 2160 + ((360 - offsetAngle) % 360);
    wheel.style.transition = 'transform 5.4s cubic-bezier(.12,.73,.08,1)';
    requestAnimationFrame(() => { wheel.style.transform = `rotate(${rotation}deg)`; });
  }

  function drawAdmin() {
    const history = document.getElementById('winnerHistory');
    if (!history) return;
    const data = read();
    const total = data.available.length;
    document.getElementById('titleInput').value = data.title || '';
    document.getElementById('subtitleInput').value = data.subtitle || '';
    document.getElementById('prizeNameInput').value = data.prizeName || '';
    document.getElementById('prizeDescriptionInput').value = data.prizeDescription || '';
    document.getElementById('remainingCount').textContent = total.toLocaleString('pt-BR');
    document.getElementById('drawnCount').textContent = data.drawn.length.toLocaleString('pt-BR');
    document.getElementById('historyCount').textContent = data.drawn.length + ' sorteados';
    document.getElementById('emptyHistory').hidden = data.drawn.length > 0;
    history.innerHTML = data.drawn.slice(-12).reverse().map((entry, index) => {
      const number = typeof entry === 'number' ? entry : entry.number;
      const time = typeof entry === 'number' || !entry.drawnAt ? '' : new Date(entry.drawnAt).toLocaleString('pt-BR');
      return `<div class="winner-row"><span class="winner-order">${data.drawn.length - index}</span><b>N&uacute;mero ${String(number).padStart(4, '0')}</b><small>${escapeHtml(time)}</small></div>`;
    }).join('');
  }

  if (wheel) {
    drawWheel();
    window.addEventListener('raffle-update', drawWheel);
    window.setInterval(refreshFromServer, 5000);
    let spinning = false;
    document.getElementById('spinButton').addEventListener('click', () => {
      if (spinning) return;
      let data = read();
      const total = data.available.length;
      if (!total) return;
      let response;
      try { response = api('draw'); serverState = response.state; }
      catch (error) { reportServerError(error); return; }
      const winner = response.winner;
      if (!Number.isInteger(winner) || !data.available.includes(winner)) { refreshFromServer(); return; }
      spinning = true;
      ['wheelNumberResult', 'crateNumberResult', 'globeNumberResult'].forEach(id => { document.getElementById(id).textContent = '----'; });
      const globe = document.getElementById('lotteryGlobe');
      globe.classList.remove('has-winner');
      globe.classList.add('is-spinning');
      spinWheelToNumber(winner, data.available);
      prepareCrateReel(winner, data.available);
      setTimeout(() => {
        const latest = read();
        globe.classList.remove('is-spinning');
        globe.classList.add('has-winner');
        showNumberInAllOptions(winner);
        document.getElementById('resultImage').textContent = '#' + String(winner).padStart(4, '0');
        document.getElementById('resultNumber').textContent = 'N\u00famero ' + String(winner).padStart(4, '0');
        document.getElementById('resultDescription').textContent = (latest.prizeName || SEED.prizeName) + '. ' + (latest.prizeDescription || SEED.prizeDescription);
        document.getElementById('resultDialog').showModal();
        drawWheel();
        spinning = false;
      }, 5500);
    });
    const close = () => document.getElementById('resultDialog').close();
    document.getElementById('closeDialog').onclick = close;
    document.getElementById('doneButton').onclick = close;
  }

  if (document.getElementById('settingsForm')) {
    drawAdmin();
    window.addEventListener('raffle-update', drawAdmin);
    window.setInterval(refreshFromServer, 5000);
    document.getElementById('settingsForm').addEventListener('submit', event => {
      event.preventDefault();
      const data = read();
      data.title = document.getElementById('titleInput').value.trim() || SEED.title;
      data.subtitle = document.getElementById('subtitleInput').value.trim() || SEED.subtitle;
      data.prizeName = document.getElementById('prizeNameInput').value.trim() || SEED.prizeName;
      data.prizeDescription = document.getElementById('prizeDescriptionInput').value.trim() || SEED.prizeDescription;
      try { save(data); } catch (error) { reportServerError(error); }
    });
    document.getElementById('resetDraw').addEventListener('click', () => {
      if (!confirm('Reiniciar o sorteio? Isso devolver\u00e1 os 2500 n\u00fameros \u00e0 roleta e apagar\u00e1 o hist\u00f3rico atual.')) return;
      try {
        const response = api('reset');
        serverState = response.state;
        window.dispatchEvent(new CustomEvent('raffle-update'));
      } catch (error) { reportServerError(error); }
    });
  }
})();
