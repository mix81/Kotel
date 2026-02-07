const cfg = { 
    h: 'm9.wqtt.ru', p: 13733, u: 'u_OCW7RS', w: 'tY9lf91e', 
    id: 'PRO_' + Math.random().toString(16).substr(2, 4) 
};

const mqtt = new Paho.MQTT.Client(cfg.h, cfg.p, cfg.id);
let states = { r2: 0, r3: 0, mode: 'off' };

function updateClock() {
    const now = new Date();
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    if(timeEl) timeEl.innerText = now.toLocaleTimeString('ru-RU', {hour: '2-digit', minute: '2-digit'});
    if(dateEl) dateEl.innerText = now.toLocaleDateString('ru-RU', {weekday: 'long', day: 'numeric', month: 'long'});
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

function checkPass() {
    if (document.getElementById('passInput').value === "1902") {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'flex';
        updateClock(); 
        connectMQTT();
    } else { alert("ОШИБКА"); }
}

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
    const t = m.destinationName; 
    const v = m.payloadString;
    
    if(t === 'heater/temperature') document.getElementById('t_water').innerText = v;
    if(t === 'dom/tempUlica') document.getElementById('t_out_val').innerText = v;
    if(t === 'heater/power_percent') document.getElementById('pwr_val').innerText = v + '%';
    
    if(t === 'heater/mode/state') {
        states.mode = v;
        ['auto','manual','off'].forEach(x => {
            const btn = document.getElementById('m_'+x);
            const bge = document.getElementById('badge_'+x);
            if(btn) btn.className = (v === x ? 'active' : '');
            if(bge) bge.classList.toggle('active', v === x);
        });
        document.getElementById('group_manual').classList.toggle('locked-ui', v === 'auto');
        document.getElementById('group_pza').classList.toggle('locked-ui', v !== 'auto');
    }
    
    if(t === 'heater/relay2/state') { 
        states.r2 = parseInt(v); 
        document.getElementById('sw_r2').className = states.r2 ? "toggle-btn is-on" : "toggle-btn";
        document.getElementById('st_r2_dash').className = states.r2 ? 'badge active' : 'badge';
    }
    if(t === 'heater/relay3/state') { 
        states.r3 = parseInt(v); 
        document.getElementById('sw_r3').className = states.r3 ? "toggle-btn is-on" : "toggle-btn";
        document.getElementById('st_r3_dash').className = states.r3 ? 'badge active' : 'badge';
    }
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

function updateStatusDot(s) { 
    const d1 = document.getElementById('dot-auth');
    const d2 = document.getElementById('dot-main');
    if(d1) d1.className = s ? 'status-dot online' : 'status-dot'; 
    if(d2) d2.className = s ? 'status-dot online' : 'status-dot'; 
}

function send(t, v) { 
    if(mqtt && mqtt.isConnected()) { 
        let m = new Paho.MQTT.Message(String(v)); m.destinationName = t; mqtt.send(m); 
    } 
}
function sendSetpoint(v) { if (states.mode !== 'auto') send('heater/setpoint/set', v); }
function toggleRelay(t, k) { if (states.mode !== 'auto') send(t, states[k] ? 0 : 1); }
