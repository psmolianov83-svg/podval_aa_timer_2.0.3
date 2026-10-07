/* =========================================================
   ПОДВАЛ IPSC — основной скрипт
   ========================================================= */

const appData = { alpha: 0, charlie: 0, delta: 0, miss: 0, noshoot: 0, procedural: 0 };

function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

/* Формирует HTML с данными упражнения для подписи */
function buildSignatureInfoHTML(name, stage, time, hf, hits, isDnf, wrapperClass) {
    const cls = wrapperClass || 'signature-modal-info';
    const dnfLabel = isDnf
        ? '<span style="color:#ff5555; font-weight:bold;">DNF</span>'
        : '<span style="color:#55ff55; font-weight:bold;">HF: ' + hf + '</span>';

    let tags = '';
    if (hits) {
        tags = '<div class="sig-tags">' +
            '<span class="hits-tag alpha-tag">A:' + (hits.alpha || 0) + '</span>' +
            '<span class="hits-tag charlie-tag">C:' + (hits.charlie || 0) + '</span>' +
            '<span class="hits-tag delta-tag">D:' + (hits.delta || 0) + '</span>' +
            '<span class="hits-tag miss-tag">M:' + (hits.miss || 0) + '</span>' +
            '<span class="hits-tag ns-tag">NS:' + (hits.noshoot || 0) + '</span>' +
            '<span class="hits-tag proc-tag">P:' + (hits.procedural || 0) + '</span>' +
            '</div>';
    }

    return '<div class="' + cls + '">' +
        '<div class="sig-line"><b>Стрелок:</b> <span class="val">' + esc(name) + '</span></div>' +
        '<div class="sig-line"><b>Упражнение:</b> <span class="val">' + esc(stage) + '</span></div>' +
        '<div class="sig-line"><b>Время:</b> <span class="val">' + time + ' с</span></div>' +
        '<div class="sig-line"><b>Результат:</b> ' + dnfLabel + '</div>' +
        tags +
        '</div>';
}

/* =========================================================
   ТАБЫ
   ========================================================= */
window.switchTab = function(tabName) {
    const tabs = ['calc', 'history', 'match', 'archive', 'settings'];
    tabs.forEach(function(t) {
        const btn = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
        const scr = document.getElementById(t + 'Screen');
        if (btn) btn.classList.remove('active');
        if (scr) scr.classList.remove('active');
    });
    const activeBtn = document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
    const activeScr = document.getElementById(tabName + 'Screen');
    if (activeBtn) activeBtn.classList.add('active');
    if (activeScr) activeScr.classList.add('active');

    if (tabName === 'history') window.renderHistory();
    if (tabName === 'match') window.renderMatchResults();
    if (tabName === 'archive') window.renderArchive();
    if (tabName === 'settings') window.renderSettingsLists();
};

/* =========================================================
   СПИСКИ
   ========================================================= */
window.getMatchLists = function() {
    let shooters = JSON.parse(localStorage.getItem('match_shooters_v3')) ||
        [{ name: "Стрелок 1", div: "Production" }];
    let stages = JSON.parse(localStorage.getItem('match_stages_v3')) ||
        [{ name: "Упр 1", points: 60 }];
    return { shooters: shooters, stages: stages };
};

window.getStageType = function(points) {
    if (points <= 60) return "Короткое";
    if (points <= 120) return "Среднее";
    return "Длинное";
};

window.applyShift = function(arr, n) {
    if (!arr || arr.length === 0) return arr;
    n = ((n % arr.length) + arr.length) % arr.length;
    return arr.slice(n).concat(arr.slice(0, n));
};

window.getStageShift = function(stageIdx) {
    const shifts = JSON.parse(localStorage.getItem('aa_stage_shifts_v1')) || {};
    return shifts[stageIdx] || 0;
};

window.setStageShift = function(stageIdx, value) {
    const shifts = JSON.parse(localStorage.getItem('aa_stage_shifts_v1')) || {};
    shifts[stageIdx] = value;
    localStorage.setItem('aa_stage_shifts_v1', JSON.stringify(shifts));
};

window.updateSelectMenus = function() {
    const sSelect = document.getElementById('shooterSelect');
    const stSelect = document.getElementById('stageSelect');
    if (!sSelect || !stSelect) return;

    const { shooters, stages } = window.getMatchLists();
    const currentStageIdx = parseInt(stSelect.value) || 0;

    const shift = window.getStageShift(currentStageIdx);
    const shifted = window.applyShift(shooters, shift);

    sSelect.innerHTML = shifted.map(function(s, i) {
        return '<option value="' + i + '">' + esc(s.name) + ' [' + esc(s.div) + ']</option>';
    }).join('');

    stSelect.innerHTML = stages.map(function(st, idx) {
        return '<option value="' + idx + '">' + esc(st.name) + ' (' + window.getStageType(st.points) + ')</option>';
    }).join('');

    window._shiftedShooters = shifted;
    window.onStageChange();
};

window.onStageChange = function() {
    const stSelect = document.getElementById('stageSelect');
    const maxPointsInput = document.getElementById('maxPoints');
    if (!stSelect || !maxPointsInput) return;

    const { shooters, stages } = window.getMatchLists();
    const selectedIdx = parseInt(stSelect.value) || 0;

    if (stages[selectedIdx]) maxPointsInput.value = stages[selectedIdx].points;

    const shifts = JSON.parse(localStorage.getItem('aa_stage_shifts_v1')) || {};
    if (shifts[selectedIdx] === undefined) {
        shifts[selectedIdx] = selectedIdx % Math.max(1, shooters.length);
        localStorage.setItem('aa_stage_shifts_v1', JSON.stringify(shifts));
    }

    const sSelect = document.getElementById('shooterSelect');
    if (sSelect) {
        const shift = window.getStageShift(selectedIdx);
        const shifted = window.applyShift(shooters, shift);
        sSelect.innerHTML = shifted.map(function(s, i) {
            return '<option value="' + i + '">' + esc(s.name) + ' [' + esc(s.div) + ']</option>';
        }).join('');
        window._shiftedShooters = shifted;
    }

    window.recalcAlpha();
};

window.addShooter = function() {
    const input = document.getElementById('newShooterName');
    const classSel = document.getElementById('newShooterClass');
    if (!input || !input.value.trim() || !classSel) return;
    let { shooters } = window.getMatchLists();
    shooters.push({ name: input.value.trim(), div: classSel.value });
    localStorage.setItem('match_shooters_v3', JSON.stringify(shooters));
    input.value = '';
    window.renderSettingsLists();
    window.updateSelectMenus();
};

window.editShooter = function(index) {
    const { shooters } = window.getMatchLists();
    const current = shooters[index];
    if (!current) return;
    window._editShooterIndex = index;
    document.getElementById('editShooterName').value = current.name;
    document.getElementById('editShooterClass').value = current.div;
    document.getElementById('editShooterModal').style.display = 'flex';
};

window.closeEditShooter = function() {
    document.getElementById('editShooterModal').style.display = 'none';
    window._editShooterIndex = null;
};

window.saveEditShooter = function() {
    const index = window._editShooterIndex;
    if (index === null || index === undefined) return;

    const newName = document.getElementById('editShooterName').value.trim();
    const newDiv = document.getElementById('editShooterClass').value;
    if (!newName) { alert("Введите ФИО стрелка!"); return; }

    let { shooters } = window.getMatchLists();
    const oldName = shooters[index].name;
    const oldDiv = shooters[index].div;

    shooters[index] = { name: newName, div: newDiv };
    localStorage.setItem('match_shooters_v3', JSON.stringify(shooters));

    if (oldName !== newName || oldDiv !== newDiv) {
        window.updateShooterInHistory(oldName, oldDiv, newName, newDiv);
    }

    window.closeEditShooter();
    window.renderSettingsLists();
    window.updateSelectMenus();

    if (document.getElementById('historyScreen').classList.contains('active')) window.renderHistory();
    if (document.getElementById('matchScreen').classList.contains('active')) window.renderMatchResults();
};

window.updateShooterInHistory = function(oldName, oldDiv, newName, newDiv) {
    let history = JSON.parse(localStorage.getItem('aa_history_v3')) || [];
    let changed = 0;
    history.forEach(function(item) {
        if (item.name === oldName && item.shooterClass === oldDiv) {
            item.name = newName;
            item.shooterClass = newDiv;
            changed++;
        }
    });
    if (changed > 0) {
        localStorage.setItem('aa_history_v3', JSON.stringify(history));
        console.log('Обновлено записей в логе: ' + changed);
    }
};

window.deleteShooter = function(index) {
    let { shooters } = window.getMatchLists();
    if (shooters.length <= 1) return;
    if (confirm("Удалить стрелка?")) {
        shooters.splice(index, 1);
        localStorage.setItem('match_shooters_v3', JSON.stringify(shooters));
        window.renderSettingsLists();
        window.updateSelectMenus();
    }
};

window.addStage = function() {
    const nameIn = document.getElementById('newStageName');
    const ptsIn = document.getElementById('newStagePoints');
    if (!nameIn || !nameIn.value.trim() || !ptsIn) return;
    let { stages } = window.getMatchLists();
    stages.push({ name: nameIn.value.trim(), points: parseInt(ptsIn.value) || 60 });
    localStorage.setItem('match_stages_v3', JSON.stringify(stages));
    nameIn.value = '';
    window.renderSettingsLists();
    window.updateSelectMenus();
};

window.editStage = function(index) {
    let { stages } = window.getMatchLists();
    const current = stages[index];
    const newName = prompt("Название упражнения:", current.name);
    if (newName && newName.trim()) {
        const newPts = prompt("Максимальные очки:", current.points);
        stages[index] = { name: newName.trim(), points: parseInt(newPts) || current.points };
        localStorage.setItem('match_stages_v3', JSON.stringify(stages));
        window.renderSettingsLists();
        window.updateSelectMenus();
    }
};

window.deleteStage = function(index) {
    let { stages } = window.getMatchLists();
    if (stages.length <= 1) return;
    if (confirm("Удалить упражнение?")) {
        stages.splice(index, 1);
        localStorage.setItem('match_stages_v3', JSON.stringify(stages));
        const shifts = JSON.parse(localStorage.getItem('aa_stage_shifts_v1')) || {};
        delete shifts[index];
        localStorage.setItem('aa_stage_shifts_v1', JSON.stringify(shifts));
        window.renderSettingsLists();
        window.updateSelectMenus();
    }
};

window.renderSettingsLists = function() {
    const shList = document.getElementById('settingsShootersList');
    const stList = document.getElementById('settingsStagesList');
    const { shooters, stages } = window.getMatchLists();

    if (shList) {
        shList.innerHTML = shooters.map(function(s, idx) {
            return '<div class="list-item-manage">' +
                '<div class="manage-btn-group">' +
                '<button class="manage-action-btn" onclick="window.editShooter(' + idx + ')">✏️</button>' +
                '<button class="manage-action-btn" onclick="window.deleteShooter(' + idx + ')">❌</button>' +
                '</div>' +
                '<span class="manage-text-label">' + (idx + 1) + '. ' + esc(s.name) +
                ' <span class="class-tag">' + esc(s.div) + '</span></span>' +
                '</div>';
        }).join('');
    }

    if (stList) {
        stList.innerHTML = stages.map(function(st, idx) {
            return '<div class="list-item-manage">' +
                '<div class="manage-btn-group">' +
                '<button class="manage-action-btn" onclick="window.editStage(' + idx + ')">✏️</button>' +
                '<button class="manage-action-btn" onclick="window.deleteStage(' + idx + ')">❌</button>' +
                '</div>' +
                '<span class="manage-text-label">' + (idx + 1) + '. ' + esc(st.name) +
                ' (' + st.points + 'о) <span class="stage-tag">' + window.getStageType(st.points) + '</span></span>' +
                '</div>';
        }).join('');
    }
};

window.resetToDefaultSettings = function() {
    if (confirm("Сбросить списки стрелков и упражнений?")) {
        localStorage.removeItem('match_shooters_v3');
        localStorage.removeItem('match_stages_v3');
        localStorage.removeItem('aa_stage_shifts_v1');
        window.updateSelectMenus();
        window.renderSettingsLists();
    }
};

/* =========================================================
   ОЧЕРЕДНОСТЬ СТРЕЛКОВ
   ========================================================= */
window.showShootingOrder = function() {
    const stSelect = document.getElementById('stageSelect');
    if (!stSelect) return;
    const { stages, shooters } = window.getMatchLists();
    const stageIdx = parseInt(stSelect.value) || 0;
    const stageObj = stages[stageIdx];
    if (!stageObj) return;

    const shift = window.getStageShift(stageIdx);
    const shifted = window.applyShift(shooters, shift);

    let listHtml = '';
    shifted.forEach(function(s, i) {
        listHtml +=
            '<div style="background:#1e1e1e; padding:8px 12px; border-radius:6px; margin-bottom:4px; ' +
            'display:flex; justify-content:space-between; align-items:center; border-left:4px solid #00ccff;">' +
            '<div>' +
            '<span style="color:#ffcc00; font-weight:bold; font-size:16px;">' + (i + 1) + '.</span> ' +
            '<span style="color:#fff; font-weight:bold;">' + esc(s.name) + '</span>' +
            '<span class="class-tag">' + esc(s.div) + '</span>' +
            '</div>' +
            '</div>';
    });

    document.getElementById('orderTitle').innerHTML =
        'Упражнение: <span style="color:#ffcc00;">' + esc(stageObj.name) + '</span>';
    document.getElementById('orderList').innerHTML = listHtml;
    document.getElementById('orderModal').style.display = 'flex';
};

window.closeOrderModal = function() {
    document.getElementById('orderModal').style.display = 'none';
};

window.resetStageShift = function() {
    const stSelect = document.getElementById('stageSelect');
    if (!stSelect) return;
    const stageIdx = parseInt(stSelect.value) || 0;
    if (confirm("Сбросить сдвиг для этого упражнения?")) {
        window.setStageShift(stageIdx, 0);
        window.updateSelectMenus();
        window.closeOrderModal();
    }
};

/* =========================================================
   КАЛЬКУЛЯТОР
   ========================================================= */
window.recalcAlpha = function() {
    const maxPoints = parseInt(document.getElementById('maxPoints').value) || 0;
    const totalShots = Math.floor(maxPoints / 5);
    const nonAlphas = appData.charlie + appData.delta + appData.miss;
    appData.alpha = Math.max(0, totalShots - nonAlphas);
    const alphaEl = document.getElementById('alpha');
    if (alphaEl) alphaEl.innerText = appData.alpha;
    window.calculateHF();
};

window.changeVal = function(key, step) {
    appData[key] = Math.max(0, appData[key] + step);
    const targetElement = document.getElementById(key);
    if (targetElement) targetElement.innerText = appData[key];
    window.recalcAlpha();
};

window.calculateHF = function() {
    const timeEl = document.getElementById('time');
    const dnfEl = document.getElementById('dnfCheck');
    const statusTextEl = document.getElementById('statusText');
    const bannerEl = document.getElementById('basementBanner');
    const dnfChecked = dnfEl ? dnfEl.checked : false;

    const rawTime = timeEl ? String(timeEl.value).replace(/,/g, '.').trim() : '';
    const timeVal = parseFloat(rawTime) || 0;

    const points = (appData.alpha * 5) + (appData.charlie * 3) + (appData.delta * 1);
    const penalties = (appData.miss * 10) + (appData.noshoot * 10) + (appData.procedural * 10);
    const finalPoints = points - penalties;

    let hf = 0;
    if (dnfChecked) {
        hf = 0;
    } else if (timeVal > 0 && finalPoints > 0) {
        hf = finalPoints / timeVal;
    }

    if (statusTextEl && bannerEl) {
        if (dnfChecked) {
            statusTextEl.innerText = "DNF (НЕ ФИНИШ)";
            bannerEl.style.background = "#3a1a1a";
            statusTextEl.style.color = "#ff5555";
        } else if (finalPoints <= 0 && (appData.charlie > 0 || appData.delta > 0 || penalties > 0)) {
            statusTextEl.innerText = "ПОДВАЛ (0 ОЧКОВ)";
            bannerEl.style.background = "#ff5555";
            statusTextEl.style.color = "#000000";
        } else {
            statusTextEl.innerText = "ЧИСТЫЙ РАСЧЕТ";
            bannerEl.style.background = "#1a291a";
            statusTextEl.style.color = "#55ff55";
        }
    }

    const hfEl = document.getElementById('hitFactor');
    const tpEl = document.getElementById('totalPoints');
    if (hfEl) hfEl.innerText = hf.toFixed(4);
    if (tpEl) tpEl.innerText = 'Очки: ' + finalPoints + ' | Штрафы: ' + penalties;

    return { hf: hf.toFixed(4), finalPoints: finalPoints, penalties: penalties, time: timeVal, isDnf: dnfChecked };
};

/* Обновляем данные только в модалке подписи (на калькуляторе больше нет) */
window.updateSignatureInfo = function() {
    // Функция оставлена для совместимости, ничего не делает
    // Данные в модалке обновляются при её открытии (openSignatureModal)
};

/* =========================================================
   ГРАФИЧЕСКАЯ ПОДПИСЬ
   ========================================================= */
var signatureCtx = null;
var signatureDrawing = false;
var signatureHasInk = false;
var savedSignature = '';
var sigLastX = 0, sigLastY = 0;

window.openSignatureModal = function() {
    const modal = document.getElementById('signatureModal');

    // Формируем данные упражнения ДЛЯ МОДАЛКИ
    const sSelect = document.getElementById('shooterSelect');
    const stSelect = document.getElementById('stageSelect');
    const timeEl = document.getElementById('time');
    const dnfEl = document.getElementById('dnfCheck');

    if (sSelect && stSelect) {
        const { stages } = window.getMatchLists();
        const shooter = window._shiftedShooters[parseInt(sSelect.value)];
        const stageObj = stages[parseInt(stSelect.value)];
        const rawTime = timeEl ? String(timeEl.value).replace(/,/g, '.').trim() : '';
        const timeVal = parseFloat(rawTime) || 0;
        const dnfChecked = dnfEl ? dnfEl.checked : false;

        const points = (appData.alpha * 5) + (appData.charlie * 3) + (appData.delta * 1);
        const penalties = (appData.miss * 10) + (appData.noshoot * 10) + (appData.procedural * 10);
        const finalPoints = points - penalties;
        let hf = 0;
        if (!dnfChecked && timeVal > 0 && finalPoints > 0) hf = finalPoints / timeVal;

        const infoEl = document.getElementById('signatureModalInfo');
        if (infoEl) {
            infoEl.innerHTML = buildSignatureInfoHTML(
                shooter ? shooter.name : '—',
                stageObj ? stageObj.name : '—',
                timeVal.toFixed(2),
                hf.toFixed(4),
                appData,
                dnfChecked,
                'signature-modal-info'
            );
        }
    }

    modal.style.display = 'flex';

    setTimeout(function() {
        const canvas = document.getElementById('signatureCanvas');
        if (!canvas) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        const w = rect.width || 320;
        const h = rect.height || 160;

        canvas.width = w * dpr;
        canvas.height = h * dpr;

        signatureCtx = canvas.getContext('2d');
        signatureCtx.fillStyle = '#ffffff';
        signatureCtx.fillRect(0, 0, canvas.width, canvas.height);

        signatureCtx.scale(dpr, dpr);
        signatureCtx.lineWidth = 2.5;
        signatureCtx.lineCap = 'round';
        signatureCtx.lineJoin = 'round';
        signatureCtx.strokeStyle = '#000';

        signatureHasInk = false;
        if (savedSignature) {
            const img = new Image();
            img.onload = function() {
                signatureCtx.drawImage(img, 0, 0, w, h);
                signatureHasInk = true;
            };
            img.src = savedSignature;
        }

        canvas.removeEventListener('touchstart', sigStart);
        canvas.removeEventListener('touchmove', sigMove);
        canvas.removeEventListener('touchend', sigEnd);
        canvas.removeEventListener('mousedown', sigStart);
        canvas.removeEventListener('mousemove', sigMove);
        canvas.removeEventListener('mouseup', sigEnd);
        canvas.removeEventListener('mouseleave', sigEnd);

        canvas.addEventListener('touchstart', sigStart, { passive: false });
        canvas.addEventListener('touchmove', sigMove, { passive: false });
        canvas.addEventListener('touchend', sigEnd);
        canvas.addEventListener('mousedown', sigStart);
        canvas.addEventListener('mousemove', sigMove);
        canvas.addEventListener('mouseup', sigEnd);
        canvas.addEventListener('mouseleave', sigEnd);
    }, 50);
};

window.closeSignatureModal = function() {
    const canvas = document.getElementById('signatureCanvas');
    if (canvas) {
        canvas.removeEventListener('touchstart', sigStart);
        canvas.removeEventListener('touchmove', sigMove);
        canvas.removeEventListener('touchend', sigEnd);
        canvas.removeEventListener('mousedown', sigStart);
        canvas.removeEventListener('mousemove', sigMove);
        canvas.removeEventListener('mouseup', sigEnd);
        canvas.removeEventListener('mouseleave', sigEnd);
    }
    document.getElementById('signatureModal').style.display = 'none';
    signatureDrawing = false;
};

window.clearSignatureCanvas = function() {
    const canvas = document.getElementById('signatureCanvas');
    if (!canvas || !signatureCtx) return;
    const rect = canvas.getBoundingClientRect();
    signatureCtx.fillStyle = '#ffffff';
    signatureCtx.fillRect(0, 0, rect.width, rect.height);
    signatureHasInk = false;
};

window.saveSignature = function() {
    if (!signatureHasInk) {
        if (confirm("Подпись пустая. Закрыть без сохранения?")) {
            window.closeSignatureModal();
        }
        return;
    }
    const canvas = document.getElementById('signatureCanvas');
    savedSignature = canvas.toDataURL('image/jpeg', 0.7);
    window.updateSignaturePreview();
    window.closeSignatureModal();
};

window.updateSignaturePreview = function() {
    const previewImg = document.getElementById('signaturePreviewImg');
    const previewText = document.getElementById('signaturePreviewText');
    if (!previewImg || !previewText) return;

    if (savedSignature) {
        previewImg.src = savedSignature;
        previewImg.style.display = 'block';
        previewText.style.display = 'none';
    } else {
        previewImg.style.display = 'none';
        previewText.style.display = 'inline';
    }
};

window.getCurrentSignature = function() {
    return savedSignature || '';
};

window.clearSignature = function() {
    savedSignature = '';
    signatureHasInk = false;
    window.updateSignaturePreview();
};

function sigGetPos(e) {
    const canvas = document.getElementById('signatureCanvas');
    const rect = canvas.getBoundingClientRect();
    let x, y;
    if (e.touches && e.touches.length > 0) {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
    } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
    }
    return { x: x, y: y };
}

function sigStart(e) {
    e.preventDefault();
    signatureDrawing = true;
    const pos = sigGetPos(e);
    sigLastX = pos.x;
    sigLastY = pos.y;
    signatureCtx.beginPath();
    signatureCtx.arc(pos.x, pos.y, 1.2, 0, Math.PI * 2);
    signatureCtx.fillStyle = '#000';
    signatureCtx.fill();
    signatureHasInk = true;
}

function sigMove(e) {
    if (!signatureDrawing) return;
    e.preventDefault();
    const pos = sigGetPos(e);
    signatureCtx.beginPath();
    signatureCtx.moveTo(sigLastX, sigLastY);
    signatureCtx.lineTo(pos.x, pos.y);
    signatureCtx.stroke();
    sigLastX = pos.x;
    sigLastY = pos.y;
}

function sigEnd() {
    signatureDrawing = false;
}

/* =========================================================
   ПРОСМОТР ПОДПИСИ
   ========================================================= */
window.showSignatureLarge = function(recordId) {
    const history = JSON.parse(localStorage.getItem('aa_history_v3')) || [];
    const record = history.find(function(item) { return String(item.id) === String(recordId); });

    if (!record || !record.signature) {
        alert("Подпись не найдена.");
        return;
    }

    document.getElementById('signatureViewImg').src = record.signature;

    const details = buildSignatureInfoHTML(
        record.name,
        record.stage,
        (record.time || 0).toFixed(2),
        record.hf,
        {
            alpha: record.alpha,
            charlie: record.charlie,
            delta: record.delta,
            miss: record.miss,
            noshoot: record.noshoot,
            procedural: record.procedural
        },
        record.isDnf,
        'signature-view-details'
    );

    const detailsEl = document.getElementById('signatureViewDetails');
    if (detailsEl) detailsEl.innerHTML = details;

    document.getElementById('signatureViewModal').style.display = 'flex';
};

window.closeSignatureView = function() {
    document.getElementById('signatureViewModal').style.display = 'none';
};

/* =========================================================
   ЛОГ
   ========================================================= */
window.renderHistory = function() {
    const history = JSON.parse(localStorage.getItem('aa_history_v3')) || [];
    const container = document.getElementById('historyList');
    if (!container) return;

    window.refreshLogFilterOptions(history);

    const filterShooter = document.getElementById('logFilterShooter').value;
    const filterClass = document.getElementById('logFilterClass').value;
    const filterStage = document.getElementById('logFilterStage').value;

    const filtered = history.filter(function(item) {
        if (filterShooter && item.name !== filterShooter) return false;
        if (filterClass && item.shooterClass !== filterClass) return false;
        if (filterStage && item.stage !== filterStage) return false;
        return true;
    });

    container.innerHTML = '';

    if (filtered.length === 0) {
        const msg = history.length === 0 ? 'Нет результатов' : 'По фильтру ничего не найдено';
        container.innerHTML = '<div style="text-align:center; color:#666; margin-top:20px;">' + msg + '</div>';
        return;
    }

    if (filterShooter || filterClass || filterStage) {
        const counter = document.createElement('div');
        counter.style.cssText = 'text-align:center; color:#888; font-size:11px; margin-bottom:4px;';
        counter.innerText = 'Показано: ' + filtered.length + ' из ' + history.length;
        container.appendChild(counter);
    }

    filtered.forEach(function(item, idx) {
        const el = document.createElement('div');
        el.className = 'history-item';

        const hitsLine =
            '<span class="hits-tag alpha-tag">A:' + (item.alpha || 0) + '</span>' +
            '<span class="hits-tag charlie-tag">C:' + (item.charlie || 0) + '</span>' +
            '<span class="hits-tag delta-tag">D:' + (item.delta || 0) + '</span>' +
            '<span class="hits-tag miss-tag">M:' + (item.miss || 0) + '</span>' +
            '<span class="hits-tag ns-tag">NS:' + (item.noshoot || 0) + '</span>' +
            '<span class="hits-tag proc-tag">P:' + (item.procedural || 0) + '</span>';

        const signLine = item.signature
            ? '<div class="history-sign-link" onclick="window.showSignatureLarge(' + item.id + ')">✍️ Показать подпись</div>'
            : '';

        const sub = item.isDnf
            ? esc(item.stage) + ' | ' + esc(item.shooterClass) + ' | ' + item.time + 'с | <span style="color:#ff5555;">DNF</span>'
            : esc(item.stage) + ' | ' + esc(item.shooterClass) + ' | ' + item.time + 'с | HF: ' + item.hf;

        const right = item.isDnf
            ? '<span style="color:#ff5555;">DNF</span>'
            : '<b>' + item.hf + '</b>';

        el.innerHTML =
            '<div style="flex:1; min-width:0;">' +
            '<div class="history-name">' + (idx + 1) + '. ' + esc(item.name) + '</div>' +
            '<div class="history-sub">' + sub + '</div>' +
            '<div class="history-hits">' + hitsLine + '</div>' +
            signLine +
            '</div>' +
            '<div class="history-hf">' + right + '</div>';
        container.appendChild(el);
    });
};

window.refreshLogFilterOptions = function(history) {
    const shooterSel = document.getElementById('logFilterShooter');
    const stageSel = document.getElementById('logFilterStage');
    if (!shooterSel || !stageSel) return;

    const shooters = Array.from(new Set(history.map(function(i) { return i.name; }))).sort();
    const stages = Array.from(new Set(history.map(function(i) { return i.stage; })));

    const curShooter = shooterSel.value;
    const curStage = stageSel.value;

    shooterSel.innerHTML = '<option value="">Все стрелки</option>' +
        shooters.map(function(s) {
            return '<option value="' + esc(s) + '">' + esc(s) + '</option>';
        }).join('');
    if (curShooter && shooters.indexOf(curShooter) !== -1) shooterSel.value = curShooter;

    stageSel.innerHTML = '<option value="">Все упражнения</option>' +
        stages.map(function(s) {
            return '<option value="' + esc(s) + '">' + esc(s) + '</option>';
        }).join('');
    if (curStage && stages.indexOf(curStage) !== -1) stageSel.value = curStage;
};

window.resetLogFilters = function() {
    const s = document.getElementById('logFilterShooter');
    const c = document.getElementById('logFilterClass');
    const st = document.getElementById('logFilterStage');
    if (s) s.value = '';
    if (c) c.value = '';
    if (st) st.value = '';
    window.renderHistory();
};

window.moveToNextShooter = function() {
    const sSelect = document.getElementById('shooterSelect');
    if (!sSelect) return;
    const current = parseInt(sSelect.value) || 0;
    const total = sSelect.options.length;
    if (total === 0) return;
    const next = (current + 1) % total;
    sSelect.value = next;
};

window.saveToHistory = function() {
    const sSelect = document.getElementById('shooterSelect');
    const stSelect = document.getElementById('stageSelect');
    const timeEl = document.getElementById('time');
    const dnfEl = document.getElementById('dnfCheck');
    if (!sSelect || !stSelect || !timeEl || !dnfEl) return;

    const { stages } = window.getMatchLists();
    const shooter = window._shiftedShooters[parseInt(sSelect.value)];
    const stageObj = stages[parseInt(stSelect.value)];
    if (!shooter || !stageObj) return;

    const rawTime = String(timeEl.value).replace(/,/g, '.').trim();
    const timeVal = parseFloat(rawTime) || 0;
    const dnfChecked = dnfEl.checked;

    if (timeVal <= 0 && !dnfChecked) {
        alert("Введите время упражнения!");
        return;
    }

    const res = window.calculateHF();
    const signature = window.getCurrentSignature();

    const record = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: shooter.name,
        shooterClass: shooter.div,
        stage: stageObj.name,
        stageMaxPoints: stageObj.points,
        hf: parseFloat(res.hf),
        points: res.finalPoints,
        time: timeVal,
        isDnf: dnfChecked,
        alpha: appData.alpha,
        charlie: appData.charlie,
        delta: appData.delta,
        miss: appData.miss,
        noshoot: appData.noshoot,
        procedural: appData.procedural,
        signature: signature
    };

    let history = JSON.parse(localStorage.getItem('aa_history_v3')) || [];
    history.unshift(record);
    localStorage.setItem('aa_history_v3', JSON.stringify(history));

    for (let key in appData) {
        if (key !== 'alpha') {
            appData[key] = 0;
            const counterEl = document.getElementById(key);
            if (counterEl) counterEl.innerText = 0;
        }
    }
    timeEl.value = "";
    dnfEl.checked = false;
    window.clearSignature();
    window.recalcAlpha();
    window.moveToNextShooter();

    alert("Запись сохранена!");
};

window.clearHistory = function() {
    if (confirm("Удалить текущие записи лога?")) {
        localStorage.removeItem('aa_history_v3');
        window.renderHistory();
    }
};

/* =========================================================
   МАТЧ
   ========================================================= */
window.calculateMatchStandings = function(targetClass) {
    const history = JSON.parse(localStorage.getItem('aa_history_v3')) || [];
    if (history.length === 0) return [];

    const filtered = targetClass === 'Overall'
        ? history
        : history.filter(function(item) { return item.shooterClass === targetClass; });
    if (filtered.length === 0) return [];

    const stageWinners = {};
    filtered.forEach(function(item) {
        if (!item.isDnf) {
            if (!stageWinners[item.stage] || item.hf > stageWinners[item.stage]) {
                stageWinners[item.stage] = item.hf;
            }
        }
    });

    const totals = {};
    filtered.forEach(function(item) {
        const key = item.name + '|' + item.shooterClass;
        if (!totals[key]) {
            totals[key] = { name: item.name, shooterClass: item.shooterClass, matchPoints: 0 };
        }
        const winnerHf = stageWinners[item.stage] || 0;
        let earned = 0;
        if (winnerHf > 0 && !item.isDnf && item.hf > 0) {
            earned = item.stageMaxPoints * (item.hf / winnerHf);
        }
        totals[key].matchPoints += earned;
    });

    const standings = Object.values(totals);
    standings.sort(function(a, b) { return b.matchPoints - a.matchPoints; });

    const leader = standings.length > 0 ? standings[0].matchPoints : 0;
    standings.forEach(function(s) {
        s.matchPercentage = leader > 0 ? ((s.matchPoints / leader) * 100).toFixed(2) : "0.00";
        s.matchPoints = parseFloat(s.matchPoints).toFixed(4);
    });

    return standings;
};

window.renderMatchResults = function() {
    const container = document.getElementById('matchLeaderboard');
    const filterEl = document.getElementById('matchClassFilter');
    if (!container || !filterEl) return;
    container.innerHTML = '';

    const standings = window.calculateMatchStandings(filterEl.value);
    if (standings.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#666; margin-top:20px;">В выбранном зачете пока нет записей</div>';
        return;
    }

    standings.forEach(function(shooter, idx) {
        const el = document.createElement('div');
        el.className = 'history-item';
        let medal = '<span style="color:#aaa; font-weight:bold; margin-right:5px;">' + (idx + 1) + '.</span>';
        if (idx === 0) medal = '🥇 ';
        if (idx === 1) medal = '🥈 ';
        if (idx === 2) medal = '🥉 ';

        el.innerHTML =
            '<div>' +
            '<div class="history-name">' + medal + esc(shooter.name) +
            ' <span class="class-tag" style="color:#ffcc00; background:#333;">' + esc(shooter.shooterClass) + '</span></div>' +
            '<div class="history-sub">Сумма очков: ' + shooter.matchPoints + '</div>' +
            '</div>' +
            '<div class="history-hf" style="color:#00ccff;">' + shooter.matchPercentage + '%</div>';
        container.appendChild(el);
    });
};

/* =========================================================
   АРХИВ
   ========================================================= */
window.archiveCurrentMatch = function() {
    const matchNameInput = document.getElementById('archiveMatchName');
    if (!matchNameInput) return;

    const classes = ["Overall", "Production", "Standard", "Open", "Classic", "PCC"];
    const allResults = {};
    let hasData = false;

    classes.forEach(function(c) {
        const table = window.calculateMatchStandings(c);
        if (table.length > 0) { allResults[c] = table; hasData = true; }
    });

    if (!hasData) { alert("Лог матча пуст! Нечего архивировать."); return; }

    const rawHistory = JSON.parse(localStorage.getItem('aa_history_v3')) || [];

    const archiveRecord = {
        id: Date.now(),
        name: matchNameInput.value.trim() || "Клубный матч",
        date: new Date().toLocaleDateString(),
        dataByClasses: allResults,
        rawHistory: rawHistory
    };

    let archive = JSON.parse(localStorage.getItem('aa_match_archive_v3')) || [];
    archive.unshift(archiveRecord);
    localStorage.setItem('aa_match_archive_v3', JSON.stringify(archive));

    localStorage.removeItem('aa_history_v3');
    localStorage.removeItem('aa_stage_shifts_v1');
    matchNameInput.value = "Клубный матч";

    alert("Матч успешно сохранен в архив!");
    window.switchTab('archive');
};

window.renderArchive = function() {
    const container = document.getElementById('archiveList');
    if (!container) return;
    container.innerHTML = '';

    const archive = JSON.parse(localStorage.getItem('aa_match_archive_v3')) || [];
    if (archive.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#666; margin-top:20px;">Архив пуст</div>';
        return;
    }

    archive.forEach(function(match) {
        const el = document.createElement('div');
        el.className = 'history-item';
        el.style.flexDirection = 'column';
        el.style.alignItems = 'flex-start';
        el.style.gap = '5px';

        let classesHtml = '';
        for (let className in match.dataByClasses) {
            const displayName = className === 'Overall' ? 'Общий зачет (Overall)' : className;
            classesHtml += '<div style="font-weight:bold; color:#ffcc00; font-size:11px; margin-top:4px;">• ' + displayName + '</div>';
            classesHtml += match.dataByClasses[className].map(function(s, i) {
                return '<div style="font-size:11px; color:#ccc; padding-left:8px;">' + (i + 1) + '. ' +
                    esc(s.name) + ' [' + esc(s.shooterClass) + '] — <b>' + s.matchPercentage + '%</b></div>';
            }).join('');
        }

        el.innerHTML =
            '<div style="width:100%; display:flex; justify-content:space-between; border-bottom:1px solid #333; padding-bottom:3px; margin-bottom:2px;">' +
            '<span style="font-weight:bold; color:#00ccff;">🏆 ' + esc(match.name) + '</span>' +
            '<span style="font-size:11px; color:#666;">' + match.date + '</span>' +
            '</div>' +
            '<div style="width:100%;">' + classesHtml + '</div>' +
            '<button onclick="window.deleteFromArchive(' + match.id + ')" style="background:none; border:none; color:#ff5555; font-size:10px; padding:0; margin-top:6px; cursor:pointer; text-decoration:underline;">Удалить из архива</button>';
        container.appendChild(el);
    });
};

window.deleteFromArchive = function(id) {
    if (confirm("Удалить этот матч из архива навсегда?")) {
        let archive = JSON.parse(localStorage.getItem('aa_match_archive_v3')) || [];
        archive = archive.filter(function(m) { return m.id !== id; });
        localStorage.setItem('aa_match_archive_v3', JSON.stringify(archive));
        window.renderArchive();
    }
};

/* =========================================================
   ЭКСПОРТ В EXCEL
   ========================================================= */
window.exportMatchToExcel = function() {
    const filterEl = document.getElementById('matchClassFilter');
    const matchNameInput = document.getElementById('archiveMatchName');
    if (!filterEl || !matchNameInput) return;

    const selectedClass = filterEl.value;
    const standings = window.calculateMatchStandings(selectedClass);
    if (standings.length === 0) { alert("Нет данных для экспорта в Excel!"); return; }

    const matchName = matchNameInput.value.trim() || "Матч_Action_Air";

    let csvContent = "\uFEFF";
    csvContent += "Место;Стрелок;Класс;Очки матча;Процент\n";
    standings.forEach(function(shooter, idx) {
        csvContent += (idx + 1) + ';' + shooter.name + ';' + shooter.shooterClass + ';' + shooter.matchPoints + ';' + shooter.matchPercentage + '%\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", matchName.replace(/\s+/g, '_') + '_' + selectedClass + '.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/* =========================================================
   ID УСТРОЙСТВА И МАТЧА
   ========================================================= */
window.getDeviceId = function() {
    let id = localStorage.getItem('aa_device_id');
    if (!id) {
        id = 'J' + Math.random().toString(36).slice(2, 8).toUpperCase();
        localStorage.setItem('aa_device_id', id);
    }
    return id;
};

window.getMatchId = function() {
    let mid = localStorage.getItem('aa_match_id');
    if (!mid) {
        mid = 'MATCH-' + new Date().toISOString().slice(0, 10);
        localStorage.setItem('aa_match_id', mid);
    }
    return mid;
};

window.changeMatchId = function() {
    const current = window.getMatchId();
    const newId = prompt("Введите ID матча (одинаковый для всех судей):", current);
    if (newId && newId.trim()) {
        localStorage.setItem('aa_match_id', newId.trim());
        document.getElementById('currentMatchId').innerText = newId.trim();
    }
};

/* =========================================================
   QR-ПЕРЕДАЧА (без подписей)
   ========================================================= */
var qrParts = [];
var qrCurrent = 0;

window.openQRTransfer = function() {
    const history = JSON.parse(localStorage.getItem('aa_history_v3')) || [];
    if (history.length === 0) { alert("Лог пуст — нечего передавать."); return; }

    const CHUNK = 5;
    const mid = window.getMatchId();
    const sid = window.getDeviceId();
    const totalParts = Math.ceil(history.length / CHUNK);
    qrParts = [];

    for (let i = 0; i < totalParts; i++) {
        const chunk = history.slice(i * CHUNK, (i + 1) * CHUNK);
        const rows = chunk.map(function(item) {
            return {
                n: item.name, c: item.shooterClass, s: item.stage,
                m: item.stageMaxPoints, h: item.hf, p: item.points,
                t: item.time, d: item.isDnf ? 1 : 0,
                a: item.alpha || 0, cc: item.charlie || 0, dd: item.delta || 0,
                mm: item.miss || 0, nn: item.noshoot || 0, pp: item.procedural || 0
            };
        });
        const payload = {
            v: 1, mid: mid, sid: sid, pn: i + 1, pt: totalParts,
            ids: chunk.map(function(x, k) { return x.id || (Date.now() + i * 100 + k); }),
            rows: rows
        };
        qrParts.push(JSON.stringify(payload));
    }

    qrCurrent = 0;
    document.getElementById('qrModal').style.display = 'flex';

    setTimeout(function() {
        window.renderQRPart();
    }, 100);
};

window.renderQRPart = function() {
    const payload = qrParts[qrCurrent];
    const canvas = document.getElementById('qrCanvas');

    if (!canvas) {
        alert("Ошибка: canvas не найден.");
        return;
    }
    if (typeof qrcode !== 'function') {
        alert("Ошибка: библиотека qrcode не загружена. Проверьте qrcode.min.js");
        console.error('typeof qrcode =', typeof qrcode);
        return;
    }

    try {
        const qr = qrcode(0, 'L');
        qr.addData(payload);
        qr.make();

        const size = 320;
        const modules = qr.getModuleCount();
        const cell = Math.floor(size / modules);
        const realSize = cell * modules;

        canvas.width = realSize;
        canvas.height = realSize;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, realSize, realSize);
        ctx.fillStyle = '#000';
        for (let r = 0; r < modules; r++) {
            for (let c = 0; c < modules; c++) {
                if (qr.isDark(r, c)) ctx.fillRect(c * cell, r * cell, cell, cell);
            }
        }

        document.getElementById('qrTitle').innerText = 'Пакет ' + (qrCurrent + 1) + ' из ' + qrParts.length;
        let totalRows = 0;
        qrParts.forEach(function(p) { totalRows += JSON.parse(p).rows.length; });
        document.getElementById('qrInfo').innerText = 'Сканируйте по порядку. Всего стрелков в передаче: ' + totalRows;
    } catch (e) {
        console.error('QR generation error:', e);
        alert("Ошибка генерации QR: " + e.message);
    }
};

window.qrNextPart = function() {
    if (qrCurrent < qrParts.length - 1) { qrCurrent++; window.renderQRPart(); }
    else { alert("Это последний пакет. Можно закрывать."); }
};

window.qrPrevPart = function() {
    if (qrCurrent > 0) { qrCurrent--; window.renderQRPart(); }
};

window.closeQRTransfer = function() {
    document.getElementById('qrModal').style.display = 'none';
    qrParts = []; qrCurrent = 0;
};

/* =========================================================
   QR-ПРИЁМ
   ========================================================= */
var scanStream = null;
var scanRAF = null;
var receivedParts = JSON.parse(localStorage.getItem('aa_received_parts_v1')) || {};
var receivedIds = new Set(JSON.parse(localStorage.getItem('aa_received_ids_v1')) || []);

window.openQRScanner = function() {
    document.getElementById('scanModal').style.display = 'flex';
    document.getElementById('scanStatus').innerText = 'Запуск камеры...';
    document.getElementById('scanLog').innerHTML = '';

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(function(stream) {
            scanStream = stream;
            const video = document.getElementById('scanVideo');
            video.srcObject = stream;
            video.setAttribute('playsinline', true);
            video.play();
            document.getElementById('scanStatus').innerText = 'Наведите камеру на QR-код...';
            scanRAF = requestAnimationFrame(window.scanTick);
        })
        .catch(function(err) {
            document.getElementById('scanStatus').innerText = 'Ошибка доступа к камере: ' + err.message;
        });
};

window.closeQRScanner = function() {
    if (scanRAF) cancelAnimationFrame(scanRAF);
    scanRAF = null;
    if (scanStream) {
        scanStream.getTracks().forEach(function(t) { t.stop(); });
        scanStream = null;
    }
    document.getElementById('scanModal').style.display = 'none';
};

window.scanTick = function() {
    const video = document.getElementById('scanVideo');
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA || !scanStream) {
        scanRAF = requestAnimationFrame(window.scanTick);
        return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (typeof jsQR === 'function') {
        const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });
        if (code && code.data) window.handleScannedPayload(code.data);
    }
    scanRAF = requestAnimationFrame(window.scanTick);
};

window.handleScannedPayload = function(raw) {
    let payload;
    try { payload = JSON.parse(raw); } catch (e) {
        console.log('QR: не удалось распарсить JSON', e);
        return;
    }
    if (!payload || payload.v !== 1 || !payload.mid || !payload.rows) {
        console.log('QR: не наш формат', payload);
        return;
    }

    const key = payload.mid + '|' + payload.sid;
    console.log('QR: часть ' + payload.pn + '/' + payload.pt + ' от ' + payload.sid);

    if (!receivedParts[key]) receivedParts[key] = {};

    if (receivedParts[key][payload.pn]) {
        window.logScan('Часть ' + payload.pn + ' уже принята.');
        return;
    }

    receivedParts[key][payload.pn] = payload;
    localStorage.setItem('aa_received_parts_v1', JSON.stringify(receivedParts));

    window.logScan('✓ Принята часть ' + payload.pn + '/' + payload.pt + ' (' + payload.rows.length + ' записей, судья ' + payload.sid + ')');
    window.updateScanProgress();

    const allParts = Object.values(receivedParts[key]);
    console.log('QR: всего принято частей ' + allParts.length + ' из ' + payload.pt);
    if (allParts.length === payload.pt) {
        console.log('QR: все части собраны, вызываем commitReceivedBatch');
        window.commitReceivedBatch(key);
    }
};

window.updateScanProgress = function() {
    const el = document.getElementById('scanProgress');
    if (!el) return;
    let received = 0;
    for (const key in receivedParts) received += Object.keys(receivedParts[key]).length;
    el.innerText = 'Принято частей: ' + received;
};

window.commitReceivedBatch = function(key) {
    const parts = receivedParts[key];
    const sorted = Object.values(parts).sort(function(a, b) { return a.pn - b.pn; });

    let addedCount = 0, skippedCount = 0;
    let history = JSON.parse(localStorage.getItem('aa_history_v3')) || [];

    console.log('QR: commitReceivedBatch, частей ' + sorted.length);

    sorted.forEach(function(part) {
        part.rows.forEach(function(row, idx) {
            const recordId = part.ids ? part.ids[idx] : (Date.now() + Math.random());
            if (receivedIds.has(recordId)) { skippedCount++; return; }
            history.push({
                id: recordId,
                name: row.n, shooterClass: row.c, stage: row.s,
                stageMaxPoints: row.m, hf: row.h, points: row.p,
                time: row.t, isDnf: !!row.d,
                alpha: row.a || 0, charlie: row.cc || 0, delta: row.dd || 0,
                miss: row.mm || 0, noshoot: row.nn || 0, procedural: row.pp || 0,
                signature: ''
            });
            receivedIds.add(recordId);
            addedCount++;
        });
    });

    localStorage.setItem('aa_history_v3', JSON.stringify(history));
    localStorage.setItem('aa_received_ids_v1', JSON.stringify(Array.from(receivedIds)));

    console.log('QR: добавлено записей ' + addedCount + ', пропущено дублей ' + skippedCount);

    window.logScan('✅ Пакет от ' + key.split('|')[1] + ' полностью принят: +' + addedCount + ' записей (дублей: ' + skippedCount + ')');

    const matchScr = document.getElementById('matchScreen');
    const histScr = document.getElementById('historyScreen');
    if (matchScr && matchScr.classList.contains('active')) window.renderMatchResults();
    if (histScr && histScr.classList.contains('active')) window.renderHistory();

    delete receivedParts[key];
    localStorage.setItem('aa_received_parts_v1', JSON.stringify(receivedParts));
    window.updateScanProgress();

    if (navigator.vibrate) navigator.vibrate(200);
};

window.logScan = function(msg) {
    const el = document.getElementById('scanLog');
    if (!el) return;
    const time = new Date().toLocaleTimeString();
    el.innerHTML = '<div>[' + time + '] ' + esc(msg) + '</div>' + el.innerHTML;
};

/* =========================================================
   ИНИЦИАЛИЗАЦИЯ
   ========================================================= */
document.addEventListener("DOMContentLoaded", function() {
    window.updateSelectMenus();
    window.renderSettingsLists();

    const midEl = document.getElementById('currentMatchId');
    if (midEl) midEl.innerText = window.getMatchId();

    const sidEl = document.getElementById('currentDeviceId');
    if (sidEl) sidEl.innerText = window.getDeviceId();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(function(err) {
            console.warn('SW registration failed:', err);
        });
    }
});