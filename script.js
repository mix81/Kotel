const cfg = { 
    h: 'm9.wqtt.ru', p: 13733, u: 'u_OCW7RS', w: 'tY9lf91e', 
    id: 'PRO_' + Math.random().toString(16).substr(2, 4) 
};

const mqtt = new Paho.MQTT.Client(cfg.h, cfg.p, cfg.id);
let states = { r2: 0, r3: 0, mode: 'off', sp: 50, rt: 22 };
let isDemo = false;

// --- НОВАЯ СИСТЕМА ВХОДА ---
function checkPass() {
    const pass = document.getElementById('passInput').value;
    
    if (pass === "1902") {
        startApp(false); // Реальный вход
    } else {
        startApp(true);  // Демо-режим при любых других цифрах/тексте
    }
}

function startApp(demo) {
    isDemo = demo;
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-content').style.display = 'flex';
    updateClock();

    if (isDemo) {
        setupDemoMode();
    } else {
        connectMQTT();
    }
}

// --- ДЕМО-РЕЖИМ (СИМУЛЯЦИЯ) ---
function setupDemoMode() {
    document.body.classList.add('demo-active');
    updateStatusDot(true);
    
    // Заполняем экран фейковыми данными
    document.getElementById('t_water').innerText = "42.3";
    document.getElementById('t_out_val').innerText = "-8";
    document.getElementById('l_sp_dash').innerText = states.sp;
    document.getElementById('l_sp').innerText = states.sp;
    document.getElementById('l_rt').innerText = states.rt;
    document.getElementById('pwr_val').innerText = "15%";
    updateUIMode('auto');

    // Эффект "живых" датчиков (плавание температуры)
    setInterval(() => {
        let currentT = parseFloat(document.getElementById('t_water').innerText);
        let drift = (Math.random() - 0.5) * 0.3;
        document.getElementById('t_water').innerText = (currentT + drift).toFixed(1);
    }, 3000);
}

// --- РАБОЧИЙ РЕЖИМ (MQTT) ---
function connectMQTT() {
    mqtt.connect({ 
        userName: cfg.u, password: cfg.w, useSSL: true, 
        onSuccess: () => { 
            updateStatusDot(true); 
            mqtt.subscribe("heater/#"); 
            mqtt.subscribe("dom/tempUlica"); 
        },
        onFailure: () => { updateStatusDot(false); setTimeout(connectMQTT, 5000); }
    });
}

mqtt.onMessageArrived = (m) => {
    if (isDemo) return;
    const t = m.destinationName; const v = m.payloadString;
    
    if(t === 'heater/temperature') document.getElementById('t_water').innerText = v;
    if(t === 'dom/tempUlica') document.getElementById('t_out_val').innerText = v;
    if(t === 'heater/power_percent') document.getElementById('pwr_val').innerText = v + '%';
    if(t === 'heater/mode/state') updateUIMode(v);
    
    if(t === 'heater/relay2/state') updateRelayUI('r2', v);
    if(t === 'heater/relay3/state') updateRelayUI('r3', v);
    
    if(t === 'heater/setpoint/state') { 
        document.getElementById('l_sp').innerText = v; 
        document.getElementById('l_sp_dash').innerText = v; 
        document.getElementById('r_sp').value = v; 
    }
    if(t === 'heater/room_temp/state') { 
        document.getElementById('l_rt').innerText = v; 
        document.getElementById('r_rt').value = v; 
    }
    if(t === 'heater/k_factor/state') document.getElementById('i_kf').value = v;
    if(t === 'heater/kp/state') document.getElementById('i_kp').value = v;
    if(t === 'heater/ki/state') document.getElementById('i_ki').value = v;
    if(t === 'heater/kd/state') document.getElementById('i_kd').value = v;
};

// --- УПРАВЛЕНИЕ И ИНТЕРФЕЙС ---
function updateUIMode(m) {
    states.mode = m;
    ['auto','manual','off'].forEach(x => {
        const btn = document.getElementById('m_'+x);
        const bge = document.getElementById('badge_'+x);
        if(btn) btn.className = (m === x ? 'active' : '');
        if(bge) bge.classList.toggle('active', m === x);
    });
    document.getElementById('group_manual').classList.toggle('locked-ui', m === 'auto');
    document.getElementById('group_pza').classList.toggle('locked-ui', m !== 'auto');
}

function updateRelayUI(key, val) {
    states[key] = parseInt(val);
    const btn = document.getElementById('sw_' + key);
    const bge = document.getElementById('st_' + key + '_dash');
    if(btn) btn.className = states[key] ? "toggle-btn is-on" : "toggle-btn";
    if(bge) bge.className = states[key] ? 'badge active' : 'badge';
}

function send(t, v) { 
    if (isDemo) {
        if (t.includes('mode/set')) updateUIMode(v);
        if (t.includes('relay2/set')) updateRelayUI('r2', v);
        if (t.includes('relay3/set')) updateRelayUI('r3', v);
        return;
    }
    if(mqtt && mqtt.isConnected()) { 
        let m = new Paho.MQTT.Message(String(v)); m.destinationName = t; mqtt.send(m); 
    } 
}

function sendSetpoint(v) { 
    if (isDemo) { document.getElementById('l_sp_dash').innerText = v; return; }
    if (states.mode !== 'auto') send('heater/setpoint/set', v); 
}

function toggleRelay(t, k) { 
    if (states.mode !== 'auto') send(t, states[k] ? 0 : 1); 
}

function updateClock() {
    const now = new Date();
    document.getElementById('clock-time').innerText = now.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
    document.getElementById('clock-date').innerText = now.toLocaleDateString('ru-RU', {weekday: 'long', day: 'numeric', month: 'long'});
}
setInterval(updateClock, 1000);

function openOverlay() {
    document.getElementById('dashboard-view').classList.add('blur-bg');
    document.getElementById('controls-overlay').style.display = 'flex';
}
function closeOverlay() {
    document.getElementById('dashboard-view').classList.remove('blur-bg');
    document.getElementById('controls-overlay').style.display = 'none';
}
function updateStatusDot(s) { 
    const d1 = document.getElementById('dot-auth');
    const d2 = document.getElementById('dot-main');
    if(d1) d1.className = s ? 'status-dot online' : 'status-dot'; 
    if(d2) d2.className = s ? 'status-dot online' : 'status-dot'; 
}
