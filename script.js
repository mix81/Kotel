const cfg = { 
    h: 'm9.wqtt.ru', 
    p: 13733, 
    u: 'u_OCW7RS', 
    w: 'tY9lf91e', 
    id: 'PRO_' + Math.random().toString(16).substr(2,4) 
};

const mqtt = new Paho.MQTT.Client(cfg.h, cfg.p, cfg.id);
let states = { r2: 0, r3: 0, mode: '' };

// ЧАСЫ (Работают автономно)
function updateClock() {
    const now = new Date();
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    if(timeEl) timeEl.innerText = now.toLocaleTimeString('ru-RU', { hour12: false });
    if(dateEl) dateEl.innerText = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}
setInterval(updateClock, 1000);

// УПРАВЛЕНИЕ ПАНЕЛЬЮ
function openControl() {
    document.getElementById('overlay').style.display = 'block';
    const content = document.getElementById('app-content');
    content.style.display = 'flex';
    setTimeout(() => { 
        content.classList.add('show');
        document.getElementById('main-dashboard').style.filter = 'blur(15px)';
    }, 10);
}

function closeControl() {
    const content = document.getElementById('app-content');
    content.classList.remove('show');
    document.getElementById('main-dashboard').style.filter = 'none';
    setTimeout(() => {
        content.style.display = 'none';
        document.getElementById('overlay').style.display = 'none';
    }, 400);
}

// ИНДИКАТОРЫ СВЯЗИ
function updateStatusDot(online) {
    const dots = ['dot-auth', 'dot-main', 'dot-main-dash'];
    dots.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.classList.toggle('online', online);
        }
    });
}

// ПОДКЛЮЧЕНИЕ
function connectMQTT() {
    console.log("Attempting to connect...");
    mqtt.connect({ 
        userName: cfg.u, password: cfg.w, useSSL: true, 
        onSuccess: () => {
            console.log("MQTT Connected!");
            updateStatusDot(true);
            mqtt.subscribe("heater/#"); 
            mqtt.subscribe("dom/tempUlica");
            mqtt.subscribe("dom/mojnost/kot");
        },
        onFailure: (e) => {
            console.log("Failed:", e);
            updateStatusDot(false);
            setTimeout(connectMQTT, 5000);
        }
    });
}

mqtt.onConnectionLost = (e) => {
    updateStatusDot(false);
    console.log("Lost connection");
    setTimeout(connectMQTT, 5000);
};

function checkPass() {
    if (document.getElementById('passInput').value === "1902") {
        document.getElementById('auth-screen').style.display = 'none';
        updateClock();
        connectMQTT();
    } else { alert("ОШИБКА ПАРОЛЯ"); }
}

// ОБРАБОТКА ДАННЫХ (Здесь была проблема с прочерками)
mqtt.onMessageArrived = (m) => {
    const t = m.destinationName; 
    const v = m.payloadString;
    
    // Температура воды
    if(t === 'heater/temperature') {
        const el1 = document.getElementById('t_water');
        const el2 = document.getElementById('dash_t_water');
        if(el1) el1.innerText = v;
        if(el2) el2.innerText = v;
    }
    
    // Улица
    if(t === 'dom/tempUlica') {
        const el = document.getElementById('t_out_val');
        if(el) el.innerText = v;
    }
    
    // Режимы
    if(t === 'heater/mode/state') {
        states.mode = v;
        const dm = document.getElementById('dash_mode_val');
        
        // Массив кнопок и баджей для синхронизации
        ['auto','manual','off'].forEach(x => {
            const btn = document.getElementById('m_'+x);
            const bdg = document.getElementById('badge_'+x);
            if(btn) btn.classList.toggle('active', v === x);
            if(bdg) bdg.classList.toggle('active', v === x);
        });
        
        // Текст на главной карточке
        if(dm) {
            if(v === 'auto') {
                dm.innerText = "АВТО"; dm.style.color = "var(--accent)"; dm.style.borderColor = "var(--accent)";
            } else if(v === 'manual') {
                dm.innerText = "РУЧНОЙ"; dm.style.color = "var(--on)"; dm.style.borderColor = "var(--on)";
            } else {
                dm.innerText = "ВЫКЛ"; dm.style.color = "var(--off)"; dm.style.borderColor = "var(--off)";
            }
        }

        // Блокировка управления (Твой эффект Blur)
        const cardAuto = document.getElementById('card_auto');
        const manZone = document.getElementById('manual_zone');
        if(cardAuto) cardAuto.classList.toggle('locked', v !== 'auto');
        if(manZone) manZone.parentElement.classList.toggle('locked', v === 'auto');
    }

    // Мощность и ТЭНы
    if(t === 'heater/power_percent') {
        const pwrEl = document.getElementById('pwr');
        if(pwrEl) pwrEl.innerText = v;
        const r1 = document.getElementById('st_r1');
        if(r1) r1.className = (parseInt(v) > 0) ? 'badge active' : 'badge';
        
        // Логика насоса
        const waterT = parseFloat(document.getElementById('t_water')?.innerText) || 0;
        const pmp = document.getElementById('st_pmp');
        if(pmp) pmp.className = (parseInt(v) > 0 || waterT > 26 || states.r2 || states.r3) ? 'badge active' : 'badge';
    }

    if(t === 'heater/relay2/state') { states.r2 = parseInt(v); updateToggle('sw_r2', 'st_r2', states.r2); }
    if(t === 'heater/relay3/state') { states.r3 = parseInt(v); updateToggle('sw_r3', 'st_r3', states.r3); }
    
    // Уставки
    if(t === 'heater/setpoint/state') { 
        const lsp = document.getElementById('l_sp');
        const rsp = document.getElementById('r_sp');
        if(lsp) lsp.innerText = v; 
        if(rsp) rsp.value = v; 
    }
    if(t === 'heater/room_temp/state') { 
        const lrt = document.getElementById('l_rt');
        const rrt = document.getElementById('r_rt');
        if(lrt) lrt.innerText = v; 
        if(rrt) rrt.value = v; 
    }
    
    // ПИД и К-фактор
    if(t === 'heater/k_factor/state') document.getElementById('i_kf').value = v;
    if(t === 'heater/kp/state') document.getElementById('i_kp').value = v;
    if(t === 'heater/ki/state') document.getElementById('i_ki').value = v;
    if(t === 'heater/kd/state') document.getElementById('i_kd').value = v;
};

function updateToggle(btnId, badgeId, state) {
    const btn = document.getElementById(btnId);
    const badge = document.getElementById(badgeId);
    if(btn) btn.className = state ? "toggle-btn is-on" : "toggle-btn";
    if(badge) badge.className = state ? "badge active" : "badge";
}

function toggleRelay(topic, key) { 
    if (states.mode !== 'auto') send(topic, states[key] ? 0 : 1); 
}

function send(topic, val) { 
    if(mqtt && mqtt.isConnected()) {
        let msg = new Paho.MQTT.Message(String(val));
        msg.destinationName = topic;
        mqtt.send(msg); 
    }
}
