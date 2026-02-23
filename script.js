// НАСТРОЙКИ MQTT
const cfg = { 
    h: 'm9.wqtt.ru', 
    p: 13733, 
    u: 'u_OCW7RS', 
    w: 'tY9lf91e', 
    id: 'PRO_' + Math.random().toString(16).substr(2,4) 
};

const mqtt = new Paho.MQTT.Client(cfg.h, cfg.p, cfg.id);

// ГЛОБАЛЬНЫЕ СОСТОЯНИЯ
let states = {
    r2: 0, r3: 0, sv1: 0, sv2: 0,
    svbed: 0, svbed_rgb: 0,
    svdet: 0, svdet_rgb: 0,
    kit_light: 0, kit_sub: 0, kit_night: 0, kit_fan: 0,
    bath_light: 0, bath_mirror: 0, bath_dush: 0, bath_vent: 0,
    mode: 'off'
};

// АВТОРИЗАЦИЯ
function checkPass() {
    const p = document.getElementById('passInput').value;
    if (p === "1902") {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'flex';
        connect();
    } else {
        // Демо-режим если пароль неверный
        document.getElementById('demo-badge').style.display = 'block';
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'flex';
        runDemo();
    }
}

// ПОДКЛЮЧЕНИЕ
function connect() {
    mqtt.connect({
        userName: cfg.u,
        password: cfg.w,
        useSSL: true,
        onSuccess: () => {
            console.log("Connected to MQTT");
            mqtt.subscribe("heater/#");
            mqtt.subscribe("dom/#");
        },
        onFailure: (e) => console.log("MQTT Fail:", e)
    });
}

// ПРИЕМ СООБЩЕНИЙ
mqtt.onMessageArrived = (m) => {
    const t = m.destinationName;
    const v = m.payloadString;

    // ЛОГИКА КОТЛА
    if (t === 'heater/temperature') {
        document.getElementById('t_water').innerText = v;
        document.getElementById('t_vod_ov').innerText = v;
    }
    if (t === 'heater/setpoint') {
        document.getElementById('l_sp').innerText = v;
        document.getElementById('l_sp_dash').innerText = v;
        document.getElementById('r_sp').value = v;
    }
    if (t === 'heater/mode') {
        states.mode = v;
        updateModeUI(v);
    }
    if (t === 'heater/relay2') {
        states.r2 = parseInt(v);
        updateBtn('sw_r2', states.r2);
        updateBadge('st_r2_dash', states.r2);
    }
    if (t === 'heater/relay3') {
        states.r3 = parseInt(v);
        updateBtn('sw_r3', states.r3);
        updateBadge('st_r3_dash', states.r3);
    }
    if (t === 'heater/room_temp') {
        document.getElementById('l_rt').innerText = v;
        document.getElementById('r_rt').value = v;
    }
    if (t === 'heater/k_factor') {
        document.getElementById('l_kf').innerText = v;
        document.getElementById('r_kf').value = v;
    }

    // ЛОГИКА ЗАЛА (ШТОРЫ И ДАТЧИКИ)
    if (t === 'dom/tempZal') {
        document.getElementById('t_hall').innerText = v;
        document.getElementById('t_hall_ov').innerText = v;
    }
    if (t === 'dom/humZal') {
        document.getElementById('h_hall').innerText = v;
        document.getElementById('h_hall_ov').innerText = v;
    }
    if (t === 'dom/shtoraZal/proc') {
        updateCurtainVisual(v);
        document.getElementById('l_shtora').innerText = v;
        document.getElementById('r_shtora').value = v;
        document.getElementById('curt-label-dash').innerText = `Шторы: ${v}%`;
    }
    if (t === 'dom/svZal1') { states.sv1 = parseInt(v); updateBtn('sw_sv1', states.sv1); }
    if (t === 'dom/svZal2') { states.sv2 = parseInt(v); updateBtn('sw_sv2', states.sv2); }

    // СПАЛЬНЯ И ДЕТСКАЯ
    if (t === 'dom/tempSpalny') { document.getElementById('t_bed').innerText = v; document.getElementById('t_bed_ov').innerText = v; }
    if (t === 'dom/tempDet') { document.getElementById('t_det').innerText = v; document.getElementById('t_det_ov').innerText = v; }
    
    // Питание света
    if (t === 'dom/svSpalnyLamp/st') { states.svbed = parseInt(v); updateBtn('sw_svbed', states.svbed); }
    if (t === 'dom/svDetLamp/st') { states.svdet = parseInt(v); updateBtn('sw_svdet', states.svdet); }
};

// ОТПРАВКА ДАННЫХ
function send(topic, val) {
    if (mqtt.isConnected()) {
        const message = new Paho.MQTT.Message(String(val));
        message.destinationName = topic;
        mqtt.send(message);
    }
}

// ИНТЕРФЕЙСНЫЕ ФУНКЦИИ
function updateBtn(id, st) {
    const btn = document.getElementById(id);
    if (btn) st ? btn.classList.add('active') : btn.classList.remove('active');
}

function updateBadge(id, st) {
    const b = document.getElementById(id);
    if (b) b.style.background = st ? 'var(--on)' : 'rgba(255,255,255,0.05)';
}

function updateModeUI(m) {
    ['m_auto','m_manual','m_off'].forEach(id => document.getElementById(id).classList.remove('active'));
    ['badge_auto','badge_manual','badge_off'].forEach(id => document.getElementById(id).style.display = 'none');
    
    document.getElementById('m_' + m).classList.add('active');
    document.getElementById('badge_' + m).style.display = 'block';
}

function updateCurtainVisual(val) {
    const p = val / 2; 
    document.getElementById('curt-l').style.transform = `translateX(-${p}%)`;
    document.getElementById('curt-r').style.transform = `translateX(${p}%)`;
}

function openOverlay(id) { document.getElementById(id).style.display = 'flex'; }
function closeOverlay() { document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none'); }

// ЧАСЫ
function updateClock() { 
    const now = new Date(); 
    document.getElementById('clock-time').innerText = now.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'}); 
    document.getElementById('clock-date').innerText = now.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'}); 
}
setInterval(updateClock, 1000); 
updateClock();

// ДЕМО-РЕЖИМ (Если нет связи с MQTT)
function runDemo() {
    setInterval(() => {
        const t = (22 + Math.random() * 2).toFixed(1);
        document.getElementById('t_water').innerText = (40 + Math.random() * 10).toFixed(1);
        document.getElementById('t_hall').innerText = t;
        document.getElementById('pwr_val').innerText = Math.floor(Math.random() * 100) + '%';
    }, 3000);
}

// РЕГИСТРАЦИЯ SERVICE WORKER (Твой sw.js)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW error', err));
    });
}
