const cfg = { 
    h: 'm9.wqtt.ru', p: 13733, u: 'u_OCW7RS', w: 'tY9lf91e', 
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
    
    if(t === 'dom/shtora/proc') {
        const p = parseInt(v);
        document.getElementById('l_shtora').innerText = p;
        document.getElementById('curt-label-dash').innerText = 'Шторы: ' + p + '%';
        document.getElementById('r_shtora').value = p;
        updateCurtainVisual(p);
    }

    if(t === 'dom/oknoZal') {
        const wrap = document.getElementById('curtain-container');
        const icon = document.getElementById('window-sensor');
        const statusTxt = document.getElementById('window-status-text');
        if(v == "1") {
            wrap.classList.add('is-open');
            icon.classList.add('alarm');
            if(statusTxt) { statusTxt.innerText = "ОКНО ОТКРЫТО"; statusTxt.style.color = "var(--off)"; }
        } else {
            wrap.classList.remove('is-open');
            icon.classList.remove('alarm');
            if(statusTxt) { statusTxt.innerText = "ОКНО ЗАКРЫТО"; statusTxt.style.color = "var(--text)"; }
        }
    }
};

function updateCurtainVisual(val) {
    const p = parseInt(val);
    const offset = 100 - p; 
    document.getElementById('curt-l').style.transform = `translateX(-${offset}%)`;
    document.getElementById('curt-r').style.transform = `translateX(${offset}%)`;
}

function updateItem(key, val) {
    states[key] = parseInt(val);
    const btn = document.getElementById('sw_' + key);
    const badge = document.getElementById('st_' + key + '_dash');
    if(btn) btn.className = states[key] ? 'toggle-btn is-on' : 'toggle-btn';
    if(badge) badge.className = states[key] ? 'badge active' : 'badge';
    
    if(key.includes('sv')) {
        const hallCard = document.getElementById('card-hall');
        if(states.sv1) hallCard.classList.add('glow-main'); else hallCard.classList.remove('glow-main');
        if(states.sv2) hallCard.classList.add('glow-extra'); else hallCard.classList.remove('glow-extra');
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
    const cm = document.getElementById('col-manual');
    const cp = document.getElementById('col-pza');
    if(m === 'auto') { cm.classList.add('locked-ui'); cp.classList.remove('locked-ui'); }
    else if(m === 'manual') { cm.classList.remove('locked-ui'); cp.classList.add('locked-ui'); }
    else { cm.classList.add('locked-ui'); cp.classList.add('locked-ui'); }
}

function send(t, v) {
    const msg = new Paho.MQTT.Message(String(v));
    msg.destinationName = t; msg.retained = true; mqtt.send(msg);
}

function openOverlay(id) {
    document.getElementById('app-content').classList.add('blurred');
    const ov = document.getElementById(id);
    ov.style.display = 'flex';
    setTimeout(() => ov.classList.add('active'), 10);
}

function closeOverlay() {
    document.getElementById('app-content').classList.remove('blurred');
    document.querySelectorAll('.overlay').forEach(ov => {
        ov.classList.remove('active'); setTimeout(() => ov.style.display = 'none', 500);
    });
}

function updateClock() {
    const now = new Date();
    document.getElementById('clock-time').innerText = now.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    document.getElementById('clock-date').innerText = now.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'});
}
setInterval(updateClock, 1000); updateClock();
