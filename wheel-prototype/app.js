(function () {
  const KEY = 'giro-plus-prototype-v1';
  const PALETTE = ['#6b43b5', '#b69ae9', '#c7f36b', '#8b67cb', '#d8c7ff', '#443063', '#a788df', '#daf49e'];
  const SEED = {
    title: 'A sorte est\u00e1 do seu lado.',
    subtitle: 'Gire a roleta e descubra o seu pr\u00eamio.',
    prizes: [
      { id: 'tv', name: 'Smart TV 55"', description: 'Retire seu pr\u00eamio com a equipe do estande.', quantity: 1, image: '' },
      { id: 'geladeira', name: 'Geladeira', description: 'Um pr\u00eamio especial para levar para casa.', quantity: 1, image: '' },
      { id: 'vale', name: 'Vale-presente', description: 'Consulte a equipe do estande para resgatar.', quantity: 3, image: '' },
      { id: 'kit', name: 'Kit exclusivo', description: 'A equipe do estande ajudar\u00e1 voc\u00ea.', quantity: 5, image: '' }
    ]
  };
  const clone = value => JSON.parse(JSON.stringify(value));
  const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function relativeLuminance(color) {
    const channels = color.match(/[a-f\d]{2}/gi).map(channel => parseInt(channel, 16) / 255).map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function contrastText(background) {
    const luminance = relativeLuminance(background);
    const darkContrast = (luminance + 0.05) / (relativeLuminance('#24123e') + 0.05);
    const whiteContrast = (1 + 0.05) / (luminance + 0.05);
    return darkContrast >= whiteContrast ? '#24123e' : '#ffffff';
  }

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY));
      return value && Array.isArray(value.prizes) ? value : clone(SEED);
    } catch (error) {
      return clone(SEED);
    }
  }

  function save(value) {
    localStorage.setItem(KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('giro-update'));
  }

  const wheel = document.getElementById('wheelSvg');

  function drawWheel() {
    if (!wheel) return;
    const data = read();
    const prizes = data.prizes.filter(prize => prize.quantity > 0);
    const total = prizes.reduce((sum, prize) => sum + prize.quantity, 0);
    const titleWords = (data.title || SEED.title).trim().split(/\s+/);
    const titleCut = Math.ceil(titleWords.length / 2);
    document.getElementById('wheelTitle').innerHTML = escapeHtml(titleWords.slice(0, titleCut).join(' ')) + '<br><em>' + escapeHtml(titleWords.slice(titleCut).join(' ')) + '</em>';
    document.getElementById('wheelSubtitle').textContent = data.subtitle || SEED.subtitle;
    document.getElementById('prizeCount').textContent = total + ' pr\u00eamios dispon\u00edveis';
    const spinButton = document.getElementById('spinButton');
    spinButton.disabled = !total;
    spinButton.innerHTML = total ? 'Girar a roleta <span>&#8599;</span>' : 'Pr\u00eamios esgotados <span>&#10022;</span>';
    wheel.innerHTML = '';
    wheel.style.transition = 'none';
    wheel.style.transform = 'rotate(0deg)';

    if (!total) {
      wheel.innerHTML = '<circle cx="250" cy="250" r="242" fill="#eee8f6"/><text x="250" y="245" text-anchor="middle" fill="#6b43b5" font-size="22" font-weight="700">At\u00e9 a pr\u00f3xima!</text><text x="250" y="276" text-anchor="middle" fill="#817b8a" font-size="13">A equipe est\u00e1 preparando novas surpresas</text>';
      return;
    }

    const sectorAngle = 360 / total;
    const labelStartRadius = 68;
    const labelEndRadius = 230;
    const labelLength = labelEndRadius - labelStartRadius;
    const fontSize = Math.max(7, Math.min(17, sectorAngle * 0.42));
    let startAngle = -90;

    prizes.forEach((prize, prizeIndex) => {
      for (let copy = 0; copy < prize.quantity; copy++) {
        const endAngle = startAngle + sectorAngle;
        const middleAngle = (startAngle + endAngle) / 2;
        const radius = 242;
        const radians = angle => angle * Math.PI / 180;
        const x1 = 250 + radius * Math.cos(radians(startAngle));
        const y1 = 250 + radius * Math.sin(radians(startAngle));
        const x2 = 250 + radius * Math.cos(radians(endAngle));
        const y2 = 250 + radius * Math.sin(radians(endAngle));
        const colorIndex = (prizeIndex + copy) % PALETTE.length;
        const slice = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        slice.setAttribute('d', `M250 250 L${x1} ${y1} A${radius} ${radius} 0 ${sectorAngle > 180 ? 1 : 0} 1 ${x2} ${y2} Z`);
        slice.setAttribute('fill', PALETTE[colorIndex]);
        slice.setAttribute('stroke', '#fff');
        slice.setAttribute('stroke-width', '2');
        wheel.appendChild(slice);

        const label = prize.name;
        const normalizedAngle = ((middleAngle % 360) + 360) % 360;
        const flipForReading = normalizedAngle > 90 && normalizedAngle < 270;
        const anchorRadius = flipForReading ? labelEndRadius : labelStartRadius;
        const labelX = 250 + anchorRadius * Math.cos(radians(middleAngle));
        const labelY = 250 + anchorRadius * Math.sin(radians(middleAngle));
        const textRotation = middleAngle + (flipForReading ? 180 : 0);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('class', 'slice-label');
        text.setAttribute('x', String(labelX));
        text.setAttribute('y', String(labelY));
        text.setAttribute('transform', `rotate(${textRotation} ${labelX} ${labelY})`);
        text.setAttribute('text-anchor', 'start');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('fill', contrastText(PALETTE[colorIndex]));
        text.setAttribute('font-size', String(fontSize));
        text.setAttribute('font-family', 'Arial,sans-serif');
        text.setAttribute('font-weight', '700');
        if (label.length * fontSize * 0.62 > labelLength) {
          text.setAttribute('textLength', String(labelLength));
          text.setAttribute('lengthAdjust', 'spacingAndGlyphs');
        }
        text.textContent = label;
        wheel.appendChild(text);
        startAngle = endAngle;
      }
    });
    wheel.querySelectorAll('.slice-label').forEach(label => wheel.appendChild(label));
  }

  function drawAdmin() {
    const list = document.getElementById('prizeList');
    if (!list) return;
    const data = read();
    const total = data.prizes.reduce((sum, prize) => sum + prize.quantity, 0);
    document.getElementById('titleInput').value = data.title || '';
    document.getElementById('subtitleInput').value = data.subtitle || '';
    document.getElementById('adminPrizeCount').textContent = total + ' ativos';
    document.getElementById('emptyState').hidden = !!data.prizes.length;
    list.innerHTML = data.prizes.map(prize => `<div class="prize-row"><div class="prize-thumb" style="${prize.image ? `background-image:url('${prize.image}')` : ''}">${prize.image ? '' : '&#10022;'}</div><div class="prize-info"><b>${escapeHtml(prize.name)}</b><small>${escapeHtml(prize.description || 'Sem descri\u00e7\u00e3o')}</small></div><button class="edit-prize" data-action="edit" data-id="${escapeHtml(prize.id)}">Editar</button><div class="stock-control"><button data-action="minus" data-id="${escapeHtml(prize.id)}">-</button><b>${prize.quantity}</b><button data-action="plus" data-id="${escapeHtml(prize.id)}">+</button></div><button class="delete-prize" data-action="delete" data-id="${escapeHtml(prize.id)}">&times;</button></div>`).join('');
  }

  if (wheel) {
    drawWheel();
    window.addEventListener('storage', event => { if (event.key === KEY) drawWheel(); });
    window.addEventListener('giro-update', drawWheel);
    let spinning = false;
    document.getElementById('spinButton').addEventListener('click', () => {
      if (spinning) return;
      const data = read();
      const prizes = data.prizes.filter(prize => prize.quantity > 0);
      const total = prizes.reduce((sum, prize) => sum + prize.quantity, 0);
      if (!total) return;
      spinning = true;
      const pick = Math.floor(Math.random() * total);
      let passed = 0;
      let winner;
      for (const prize of prizes) {
        passed += prize.quantity;
        if (pick < passed) { winner = prize; break; }
      }
      const rotation = 2160 + 360 - (pick + 0.5) * 360 / total;
      wheel.style.transition = 'transform 5.4s cubic-bezier(.12,.73,.08,1)';
      requestAnimationFrame(() => { wheel.style.transform = `rotate(${rotation}deg)`; });
      setTimeout(() => {
        const latest = read();
        const remaining = latest.prizes.find(prize => prize.id === winner.id);
        if (remaining) {
          remaining.quantity--;
          if (remaining.quantity <= 0) latest.prizes = latest.prizes.filter(prize => prize.id !== remaining.id);
          save(latest);
        }
        document.getElementById('resultName').textContent = winner.name;
        document.getElementById('resultDescription').textContent = winner.description || 'Procure a equipe do estande para receber seu pr\u00eamio.';
        const image = document.getElementById('resultImage');
        image.style.backgroundImage = winner.image ? `url("${winner.image}")` : '';
        image.textContent = winner.image ? '' : '\u2726';
        document.getElementById('resultDialog').showModal();
        drawWheel();
        spinning = false;
      }, 5500);
    });
    const closeDialog = () => document.getElementById('resultDialog').close();
    document.getElementById('closeDialog').onclick = closeDialog;
    document.getElementById('doneButton').onclick = closeDialog;
  }

  if (document.getElementById('settingsForm')) {
    drawAdmin();
    window.addEventListener('storage', event => { if (event.key === KEY) drawAdmin(); });
    window.addEventListener('giro-update', drawAdmin);
    document.getElementById('settingsForm').addEventListener('submit', event => {
      event.preventDefault();
      const data = read();
      data.title = document.getElementById('titleInput').value.trim() || SEED.title;
      data.subtitle = document.getElementById('subtitleInput').value.trim() || SEED.subtitle;
      save(data);
    });

    let image = '';
    const form = document.getElementById('prizeForm');
    const file = document.getElementById('prizeImage');
    const preview = document.getElementById('imagePreview');
    const submit = document.getElementById('submitPrize');
    const cancel = document.getElementById('cancelEdit');
    function resetEdit() {
      form.dataset.editId = '';
      form.reset();
      image = '';
      preview.style.backgroundImage = '';
      preview.textContent = '\u2726';
      submit.innerHTML = 'Adicionar pr\u00eamio <span>+</span>';
      cancel.hidden = true;
    }
    file.addEventListener('change', event => {
      const selected = event.target.files[0];
      if (!selected) return;
      if (selected.size > 1500000) {
        alert('Escolha uma imagem de at\u00e9 1,5 MB para manter o armazenamento offline leve.');
        file.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        image = reader.result;
        preview.style.backgroundImage = `url("${image}")`;
        preview.textContent = '';
      };
      reader.readAsDataURL(selected);
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = read();
      const id = form.dataset.editId;
      const entry = {
        name: document.getElementById('prizeName').value.trim(),
        description: document.getElementById('prizeDescription').value.trim(),
        quantity: Math.max(1, Math.min(100, Number(document.getElementById('prizeQuantity').value) || 1)),
        image
      };
      if (id) {
        const prize = data.prizes.find(item => item.id === id);
        if (prize) Object.assign(prize, entry);
      } else {
        data.prizes.push(Object.assign({ id: 'p' + Date.now() }, entry));
      }
      save(data);
      resetEdit();
    });
    cancel.addEventListener('click', resetEdit);
    document.getElementById('prizeList').addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      const data = read();
      const prize = data.prizes.find(item => item.id === button.dataset.id);
      if (!prize) return;
      if (button.dataset.action === 'edit') {
        form.dataset.editId = prize.id;
        document.getElementById('prizeName').value = prize.name;
        document.getElementById('prizeDescription').value = prize.description || '';
        document.getElementById('prizeQuantity').value = prize.quantity;
        image = prize.image || '';
        preview.style.backgroundImage = image ? `url("${image}")` : '';
        preview.textContent = image ? '' : '\u2726';
        submit.innerHTML = 'Salvar altera\u00e7\u00f5es <span>&#8599;</span>';
        cancel.hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (button.dataset.action === 'delete') data.prizes = data.prizes.filter(item => item.id !== prize.id);
      else if (button.dataset.action === 'plus') prize.quantity = Math.min(100, prize.quantity + 1);
      else if (button.dataset.action === 'minus') prize.quantity = Math.max(1, prize.quantity - 1);
      save(data);
    });
  }
})();
