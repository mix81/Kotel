const cfg = { h: 'm9.wqtt.ru', p: 13733, u: 'u_OCW7RS', w: 'tY9lf91e', id: 'PRO_'+Math.random().toString(16).substr(2,4) };
const mqtt = new Paho.MQTT.Client(cfg.h, cfg.p, cfg.id);
let states = { r2: 0, r3: 0, mode: '' };

function updateClock() {
    const now = new Date();
    document.getElementById('clock-time').innerText = now.toLocaleTimeString('ru-RU', { hour12: false });
    document.getElementById('clock-date').innerText = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
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
    }, 300);
}

function connectMQTT() {
    mqtt.connect({ 
        userName: cfg.u, password: cfg.w, useSSL: true, 
        onSuccess: () => {
            document.getElementById('dot-auth').classList.add('online');
            document.getElementById('dot-main').classList.add('online');
            mqtt.subscribe("heater/#"); mqtt.subscribe("dom/#");
        },
        onFailure: () => setTimeout(connectMQTT, 5000)
    });
}

function checkPass() {
    if (document.getElementById('passInput').value === "1902") {
        document.getElementById('auth-screen').style.display = 'none';
        updateClock();
        connectMQTT();
    } else { alert("ОШИБКА"); }
}

mqtt.onMessageArrived = (m) => {
    const t = m.destinationName; const v = m.payloadString;
    
    if(t === 'heater/temperature') {
        document.getElementById('t_water').innerText = v;
        document.getElementById('dash_t_water').innerText = v;
    }
    if(t === 'dom/tempUlica') document.getElementById('t_out_val').innerText = v;
    if(t === 'dom/mojnost/kot') document.getElementById('pwr_total').innerText = v;
    
    if(t === 'heater/mode/state') {
        states.mode = v;
        const dm = document.getElementById('dash_mode_val');
        
        // Очистка старых классов
        ['m_auto_badge','m_manual_badge','m_off_badge'].forEach(id => document.getElementById(id).className = '');
        dm.className = 'info-mode-status';

        if(v === 'auto') {
            document.getElementById('m_auto_badge').className = 'active-auto';
            dm.innerText = "АВТОМАТ"; dm.style.color = "#58a6ff"; dm.style.borderColor = "#58a6ff";
            document.getElementById('lock_manual').classList.add('locked');
            document.getElementById('lock_auto').classList.remove('locked');
        } else if(v === 'manual') {
            document.getElementById('m_manual_badge').className = 'active-manual';
            dm.innerText = "РУЧНОЙ"; dm.style.color = "#238636"; dm.style.borderColor = "#238636";
            document.getElementById('lock_manual').classList.remove('locked');
            document.getElementById('lock_auto').classList.add('locked');
        } else {
            document.getElementById('m_off_badge').className = 'active-off';
            dm.innerText = "ВЫКЛ"; dm.style.color = "#da3633"; dm.style.borderColor = "#da3633";
            document.getElementById('lock_manual').classList.add('locked');
            document.getElementById('lock_auto').classList.add('locked');
        }
        ['auto','manual','off'].forEach(x => {
            if(document.getElementById('m_'+x)) document.getElementById('m_'+x).className = (v===x?'active':'');
        });
    }

    if(t === 'heater/power_percent') {
        document.getElementById('pwr').innerText = v;
        document.getElementById('st_r1').className = (parseInt(v) > 0) ? 'badge active' : 'badge';
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

function toggleRelay(topic, key) { if (states.mode === 'manual') send(topic, states[key] ? 0 : 1); }
function send(topic, val) { 
    if(mqtt && mqtt.isConnected()) {
        let msg = new Paho.MQTT.Message(String(val)); msg.destinationName = topic; mqtt.send(msg); 
    }
}
