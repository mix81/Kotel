const cfg = { h: 'm9.wqtt.ru', p: 13733, u: 'u_OCW7RS', w: 'tY9lf91e', id: 'PRO_'+Math.random().toString(16).substr(2,4) };
const mqtt = new Paho.MQTT.Client(cfg.h, cfg.p, cfg.id);
let states = { r2: 0, r3: 0, mode: '' };

// ЧАСЫ
function updateClock() {
    const now = new Date();
    document.getElementById('clock-time').innerText = now.toLocaleTimeString('ru-RU', { hour12: false });
    document.getElementById('clock-date').innerText = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}
setInterval(updateClock, 1000);

// ЛОГИКА ОКНА
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
            mqtt.subscribe("heater/#"); mqtt.subscribe("dom/tempUlica");
        },
        onFailure: () => { updateStatusDot(false); setTimeout(connectMQTT, 5000); }
    });
}

function checkPass() {
    if (document.getElementById('passInput').value === "1902") {
        document.getElementById('auth-screen').style.display = 'none';
        updateClock();
        connectMQTT();
    } else { alert("ОШИБКА ПАРОЛЯ"); }
}

mqtt.onMessageArrived = (m) => {
    const t = m.destinationName; const v = m.payloadString;
    
    if(t === 'heater/temperature') {
        document.getElementById('t_water').innerText = v;
        document.getElementById('dash_t_water').innerText = v;
    }
    if(t === 'dom/tempUlica') document.getElementById('t_out_val').innerText = v;
    
    if(t === 'heater/mode/state') {
        states.mode = v;
        const dm = document.getElementById('dash_mode_val');
        ['auto','manual','off'].forEach(x => {
            document.getElementById('m_'+x).className = (v===x?'active':'');
            document.getElementById('badge_'+x).classList.toggle('active', v === x);
        });
        
        // Обновление превью на главном экране
        if(v === 'auto') {
            dm.innerText = "АВТО"; dm.style.color = "var(--accent)"; dm.style.borderColor = "var(--accent)";
        } else if(v === 'manual') {
            dm.innerText = "РУЧНОЙ"; dm.style.color = "var(--on)"; dm.style.borderColor = "var(--on)";
        } else {
            dm.innerText = "ВЫКЛ"; dm.style.color = "var(--off)"; dm.style.borderColor = "var(--off)";
        }

        document.getElementById('card_auto').classList.toggle('locked', v !== 'auto');
        document.getElementById('manual_zone').parentElement.classList.toggle('locked', v === 'auto');
    }

    if(t === 'heater/power_percent') {
        document.getElementById('pwr').innerText = v;
        document.getElementById('st_r1').className = (parseInt(v) > 0) ? 'badge active' : 'badge';
        const waterT = parseFloat(document.getElementById('t_water').innerText) || 0;
        document.getElementById('st_pmp').className = (parseInt(v) > 0 || waterT > 26 || states.r2 || states.r3) ? 'badge active' : 'badge';
    }
    if(t === 'heater/relay2/state') { states.r2 = parseInt(v); updateToggle('sw_r2', 'st_r2', states.r2); }
    if(t === 'heater/relay3/state') { states.r3 = parseInt(v); updateToggle('sw_r3', 'st_r3', states.r3); }
    if(t === 'heater/setpoint/state') { document.getElementById('l_sp').innerText = v; document.getElementById('r_sp').value = v; }
    if(t === 'heater/room_temp/state') { document.getElementById('l_rt').innerText = v; document.getElementById('r_rt').value = v; }
    if(t === 'heater/k_factor/state') document.getElementById('i_kf').value = v;
    if(t === 'heater/kp/state') document.getElementById('i_kp').value = v;
    if(t === 'heater/ki/state') document.getElementById('i_ki').value = v;
    if(t === 'heater/kd/state') document.getElementById('i_kd').value = v;
};

function updateToggle(btnId, badgeId, state) {
    document.getElementById(btnId).className = state ? "toggle-btn is-on" : "toggle-btn";
    document.getElementById(badgeId).className = state ? "badge active" : "badge";
}
function toggleRelay(topic, key) { if (states.mode !== 'auto') send(topic, states[key] ? 0 : 1); }
function send(topic, val) { 
    if(mqtt.isConnected()) {
        let msg = new Paho.MQTT.Message(String(val)); msg.destinationName = topic; mqtt.send(msg); 
    }
}
