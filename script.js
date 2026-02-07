const cfg = { h: 'm9.wqtt.ru', p: 13733, u: 'u_OCW7RS', w: 'tY9lf91e', id: 'PRO_'+Math.random().toString(16).substr(2,4) };
const mqtt = new Paho.MQTT.Client(cfg.h, cfg.p, cfg.id);
let states = { r2: 0, r3: 0, mode: '' };

function updateStatusDot(online) {
    ['dot-auth', 'dot-main'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.toggle('online', online);
    });
}

function connectMQTT() {
    mqtt.connect({ 
        userName: cfg.u, password: cfg.w, useSSL: true, 
        onSuccess: () => {
            updateStatusDot(true);
            mqtt.subscribe("heater/#"); mqtt.subscribe("dom/#");
        },
        onFailure: () => {
            updateStatusDot(false);
            setTimeout(connectMQTT, 5000);
        }
    });
}

mqtt.onConnectionLost = (e) => {
    updateStatusDot(false);
    if (e.errorCode !== 0) setTimeout(connectMQTT, 5000);
};

function checkPass() {
    if (document.getElementById('passInput').value === "1902") {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'flex';
        connectMQTT();
    } else { alert("ОШИБКА ПАРОЛЯ"); }
}

mqtt.onMessageArrived = (m) => {
    const t = m.destinationName; const v = m.payloadString;
    
    if(t === 'heater/temperature') document.getElementById('t_water').innerText = v;
    if(t === 'dom/tempUlica') document.getElementById('t_out_val').innerText = v;
    if(t === 'Dom/mojnost/kot') document.getElementById('pwr_total').innerText = v;
    
    if(t === 'heater/mode/state') {
        states.mode = v;
        const targetWater = document.getElementById('l_sp');
        const targetRoom = document.getElementById('l_rt');
        const lockManual = document.getElementById('lock_manual');
        const lockAuto = document.getElementById('lock_auto');

        targetWater.classList.remove('mode-auto-glow', 'mode-manual-glow');
        targetRoom.classList.remove('mode-auto-glow', 'mode-manual-glow');

        if(v === 'auto') {
            targetWater.classList.add('mode-auto-glow');
            targetRoom.classList.add('mode-auto-glow');
            lockManual.classList.add('locked');
            lockAuto.classList.remove('locked');
        } else if(v === 'manual') {
            targetWater.classList.add('mode-manual-glow');
            targetRoom.classList.add('mode-manual-glow');
            lockManual.classList.remove('locked');
            lockAuto.classList.add('locked');
        } else {
            lockManual.classList.add('locked');
            lockAuto.classList.add('locked');
        }

        ['auto','manual','off'].forEach(x => {
            document.getElementById('m_'+x).className = (v===x?'active':'');
            document.getElementById('badge_'+x).classList.toggle('active', v === x);
        });
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
    const btn = document.getElementById(btnId); const badge = document.getElementById(badgeId);
    if(btn) btn.className = state ? "toggle-btn is-on" : "toggle-btn";
    if(badge) badge.className = state ? "badge active" : "badge";
}

function toggleRelay(topic, key) { if (states.mode === 'manual') send(topic, states[key] ? 0 : 1); }

function send(topic, val) { 
    if(mqtt.isConnected()) {
        let msg = new Paho.MQTT.Message(String(val)); msg.destinationName = topic; mqtt.send(msg); 
    }
}
