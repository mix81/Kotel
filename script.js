const cfg = { 
    h: 'm9.wqtt.ru', 
    p: 13733, 
    u: 'u_OCW7RS', 
    w: 'tY9lf91e', 
    id: 'PRO_' + Math.random().toString(16).substr(2,4) 
};

const mqtt = new Paho.MQTT.Client(cfg.h, cfg.p, cfg.id);
let states = { r2:0, r3:0, sv1:0, sv2:0, mode:'off' };

function checkPass() {
    if (document.getElementById('passInput').value === "1902") {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'flex';
        connect();
    }
}

function connect() {
    mqtt.connect({ userName: cfg.u, password: cfg.w, useSSL: true, 
        onSuccess: () => {
            mqtt.subscribe("heater/#"); mqtt.subscribe("dom/#");
            ['dot-auth', 'dot-boiler', 'dot-hall'].forEach(id => {
                if(document.getElementById(id)) document.getElementById(id).className = 'status-dot online';
            });
        },
        onFailure: () => setTimeout(connect, 5000)
    });
}

mqtt.onMessageArrived = (m) => {
    const t = m.destinationName; const v = m.payloadString;
    
    if(t === 'heater/temperature') document.getElementById('t_water').innerText = v;
    if(t === 'heater/setpoint/state') { document.getElementById('l_sp').innerText = v; document.getElementById('l_sp_dash').innerText = v; document.getElementById('r_sp').value = v; }
    if(t === 'heater/mode/state') updateBoilerMode(v);
    if(t === 'heater/relay2/state') updateItem('r2', v);
    if(t === 'heater/relay3/state') updateItem('r3', v);
    if(t === 'heater/power_percent') document.getElementById('pwr_val').innerText = v + '%';
    if(t === 'dom/tempUlica') document.getElementById('t_out').innerText = v;
    if(t === 'heater/room_temp/state') { document.getElementById('l_rt').innerText = v; document.getElementById('r_rt').value = v; }
    if(t === 'heater/k_factor/state') { document.getElementById('l_kf').innerText = v; document.getElementById('r_kf').value = v; }
    if(t === 'heater/kp/state') document.getElementById('i_kp').value = v;
    if(t === 'heater/ki/state') document.getElementById('i_ki').value = v;
    if(t === 'heater/kd/state') document.getElementById('i_kd').value = v;
    if(t === 'dom/tempZal') { document.getElementById('t_hall').innerText = v; document.getElementById('t_hall_ov').innerText = v; }
    if(t === 'dom/vlagZal') { document.getElementById('h_hall').innerText = v; document.getElementById('h_hall_ov').innerText = v; }
    if(t === 'dom/svZal1') updateItem('sv1', v);
    if(t === 'dom/svZal2') updateItem('sv2', v);
};

function updateItem(key, val) {
    states[key] = parseInt(val);
    const btn = document.getElementById('sw_' + key);
    const badge = document.getElementById('st_' + key + '_dash');
    if(btn) btn.className = states[key] ? 'toggle-btn is-on' : 'toggle-btn';
    if(badge) badge.className = states[key] ? 'badge active' : 'badge';
    
    if(key.includes('sv')) {
        const isAnyOn = states.sv1 || states.sv2;
        const hallCard = document.getElementById('card-hall');
        const statusTxt = document.getElementById('zal_light_status');
        if(hallCard) isAnyOn ? hallCard.classList.add('glow-active') : hallCard.classList.remove('glow-active');
        if(statusTxt) {
            statusTxt.innerText = isAnyOn ? "ВКЛ" : "ВЫКЛ";
            statusTxt.style.color = isAnyOn ? "var(--on)" : "#8b949e";
        }
    }
}

function updateBoilerMode(m) {
    states.mode = m;
    ['auto','manual','off'].forEach(x => {
        const btn = document.getElementById('m_'+x);
        const bge = document.getElementById('badge_'+x);
        if(btn) btn.className = (m === x ? 'active' : '');
        if(bge) bge.style.display = (m === x ? 'block' : 'none');
    });
    
    const colManual = document.getElementById('col-manual');
    const colPza = document.getElementById('col-pza');
    
    if(m === 'auto') {
        colManual.classList.add('locked-ui');
        colPza.classList.remove('locked-ui');
    } else if(m === 'manual') {
        colManual.classList.remove('locked-ui');
        colPza.classList.add('locked-ui');
    } else {
        colManual.classList.add('locked-ui');
        colPza.classList.add('locked-ui');
    }
}

function send(t, v) {
    const msg = new Paho.MQTT.Message(String(v));
    msg.destinationName = t;
    msg.retained = true; // Теперь брокер запомнит последнее действие
    mqtt.send(msg);
    console.log(`Отправлено: ${t} -> ${v} (Retain: true)`); // Добавил лог для проверки в консоли
}

function openOverlay(id) {
    Object.keys(states).forEach(key => {
        const btn = document.getElementById('sw_' + key);
        if(btn) btn.className = states[key] ? 'toggle-btn is-on' : 'toggle-btn';
    });
    updateBoilerMode(states.mode);

    document.getElementById('app-content').classList.add('blurred');
    const ov = document.getElementById(id);
    ov.style.display = 'flex';
    setTimeout(() => ov.classList.add('active'), 10);
}

function closeOverlay() {
    document.getElementById('app-content').classList.remove('blurred');
    const ovs = document.querySelectorAll('.overlay');
    ovs.forEach(ov => {
        ov.classList.remove('active');
        setTimeout(() => ov.style.display = 'none', 500);
    });
}

function updateClock() {
    const now = new Date();
    const timeEl = document.getElementById('clock-time');
    const dateEl = document.getElementById('clock-date');
    if(timeEl) timeEl.innerText = now.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    if(dateEl) dateEl.innerText = now.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'});
}
setInterval(updateClock, 1000);
updateClock();
