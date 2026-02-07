const cfg = { 
    h: 'm9.wqtt.ru', 
    p: 13733, 
    u: 'u_OCW7RS', 
    w: 'tY9lf91e', 
    id: 'PRO_' + Math.random().toString(16).substr(2,4) 
};

const mqtt = new Paho.MQTT.Client(cfg.h, cfg.p, cfg.id);
let states = { r2: 0, r3: 0, mode: '' };

function updateClock() {
    const now = new Date();
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    if(timeEl) timeEl.innerText = now.toLocaleTimeString('ru-RU', { hour12: false });
    if(dateEl) dateEl.innerText = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}
setInterval(updateClock, 1000);

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

function updateStatusDot(online) {
    ['dot-auth', 'dot-main', 'dot-main-dash'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.toggle('online', online);
    });
}

function connectMQTT() {
    mqtt.connect({ 
        userName: cfg.u, password: cfg.w, useSSL: true, 
        onSuccess: () => {
            updateStatusDot(true);
            mqtt.subscribe("heater/#"); 
            mqtt.subscribe("dom/tempUlica");
        },
        onFailure: (e) => {
            updateStatusDot(false);
            setTimeout(connectMQTT, 5000);
        }
    });
}

mqtt.onConnectionLost = () => { updateStatusDot(false); setTimeout(connectMQTT, 5000); };

mqtt.onMessageArrived = (m) => {
    const t = m.destinationName; 
    const v = m.payloadString;
    
    // Температуры
    if(t === 'heater/temperature') {
        if(document.getElementById('t_water')) document.getElementById('t_water').innerText = v;
        if(document.getElementById('dash_t_water')) document.getElementById('dash_t_water').innerText = v;
    }
    if(t === 'heater/setpoint/state') {
        if(document.getElementById('dash_t_setpoint')) document.getElementById('dash_t_setpoint').innerText = v; 
        if(document.getElementById('l_sp')) document.getElementById('l_sp').innerText = v; 
        if(document.getElementById('r_sp')) document.getElementById('r_sp').value = v; 
    }
    if(t === 'dom/tempUlica') {
        if(document.getElementById('t_out_val')) document.getElementById('t_out_val').innerText = v;
    }
    
    // Режимы и анимация
    if(t === 'heater/mode/state') {
        states.mode = v;
        const dm = document.getElementById('dash_mode_val');
        if(dm) {
            dm.className = 'mode-badge-dash'; 
            if(v === 'auto') { dm.innerText = "АВТО"; dm.classList.add('pulse-blue'); }
            else if(v === 'manual') { dm.innerText = "РУЧНОЙ"; dm.classList.add('pulse-green'); }
            else { dm.innerText = "ВЫКЛ"; dm.classList.add('pulse-red'); }
        }
        ['auto','manual','off'].forEach(x => {
            const btn = document.getElementById('m_'+x);
            const bdg = document.getElementById('badge_'+x);
            if(btn) btn.classList.toggle('active', v === x);
            if(bdg) bdg.classList.toggle('active', v === x);
        });
        const cardAuto = document.getElementById('card_auto');
        const manZone = document.getElementById('manual_zone');
        if(cardAuto) cardAuto.classList.toggle('locked', v !== 'auto');
        if(manZone) manZone.parentElement.classList.toggle('locked', v === 'auto');
    }

    // ТЭНы и Мощность
    if(t === 'heater/power_percent') {
        if(document.getElementById('dash_pwr_val')) document.getElementById('dash_pwr_val').innerText = v + '%';
        if(document.getElementById('pwr')) document.getElementById('pwr').innerText = v;
        const r1 = document.getElementById('st_r1');
        if(r1) r1.className = (parseInt(v) > 0) ? 'badge active' : 'badge';
    }
    if(t === 'heater/relay2/state') { 
        states.r2 = parseInt(v); 
        if(document.getElementById('dot_r2')) document.getElementById('dot_r2').classList.toggle('active', states.r2 === 1);
        updateToggle('sw_r2', 'st_r2', states.r2); 
    }
    if(t === 'heater/relay3/state') { 
        states.r3 = parseInt(v); 
        if(document.getElementById('dot_r3')) document.getElementById('dot_r3').classList.toggle('active', states.r3 === 1);
        updateToggle('sw_r3', 'st_r3', states.r3); 
    }
    
    // Сервисные
    if(t === 'heater/room_temp/state') { 
        if(document.getElementById('l_rt')) document.getElementById('l_rt').innerText = v; 
        if(document.getElementById('r_rt')) document.getElementById('r_rt').value = v; 
    }
    if(t === 'heater/k_factor/state') if(document.getElementById('i_kf')) document.getElementById('i_kf').value = v;
    if(t === 'heater/kp/state') if(document.getElementById('i_kp')) document.getElementById('i_kp').value = v;
    if(t === 'heater/ki/state') if(document.getElementById('i_ki')) document.getElementById('i_ki').value = v;
    if(t === 'heater/kd/state') if(document.getElementById('i_kd')) document.getElementById('i_kd').value = v;
};

function updateToggle(btnId, badgeId, state) {
    const btn = document.getElementById(btnId);
    const badge = document.getElementById(badgeId);
    if(btn) btn.className = state ? "toggle-btn is-on" : "toggle-btn";
    if(badge) badge.className = state ? "badge active" : "badge";
}

function toggleRelay(topic, key) { if (states.mode !== 'auto') send(topic, states[key] ? 0 : 1); }

function send(topic, val) { 
    if(mqtt && mqtt.isConnected()) {
        let msg = new Paho.MQTT.Message(String(val));
        msg.destinationName = topic;
        mqtt.send(msg); 
    }
}

function checkPass() {
    if (document.getElementById('passInput').value === "1902") {
        document.getElementById('auth-screen').style.display = 'none';
        updateClock();
        connectMQTT();
    } else { alert("ОШИБКА"); }
}
