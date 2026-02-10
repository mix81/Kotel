    const cfg = { h: 'm9.wqtt.ru', p: 13733, u: 'u_OCW7RS', w: 'tY9lf91e', id: 'PRO_' + Math.random().toString(16).substr(2,4) };
    const mqtt = new Paho.MQTT.Client(cfg.h, cfg.p, cfg.id);
    let states = { r2:0, r3:0, sv1:0, sv2:0, svbed:0, svbed_rgb:0, mode:'off', bednoc: 0 };
    const colorMap = { 'red': 'rgba(255, 0, 0, 0.6)', 'green': 'rgba(0, 255, 0, 0.6)', 'blue': 'rgba(0, 0, 255, 0.6)', 'yellow': 'rgba(255, 255, 0, 0.6)', 'cyan': 'rgba(0, 255, 255, 0.6)', 'magenta': 'rgba(255, 0, 255, 0.6)', 'orange': 'rgba(255, 165, 0, 0.6)', 'purple': 'rgba(128, 0, 128, 0.6)', 'pink': 'rgba(255, 192, 203, 0.6)', 'white': 'rgba(255, 255, 255, 0.5)' };

    function checkPass() { if (document.getElementById('passInput').value === "1902") { document.getElementById('auth-screen').style.display = 'none'; document.getElementById('app-content').style.display = 'flex'; connect(); } }
    
    // ИСПРАВЛЕННАЯ ФУНКЦИЯ ПОДКЛЮЧЕНИЯ
    function connect() { 
        mqtt.connect({ 
            userName: cfg.u, 
            password: cfg.w, 
            useSSL: true, 
            reconnect: true, 
            keepAliveInterval: 30,
            onSuccess: () => { 
                console.log("MQTT Connected");
                mqtt.subscribe("heater/#"); 
                mqtt.subscribe("dom/#"); 
            }, 
            onFailure: (e) => {
                console.log("MQTT Failure", e);
                setTimeout(connect, 5000);
            }
        }); 
    }

    // Обработчик потери связи
    mqtt.onConnectionLost = (responseObject) => {
        if (responseObject.errorCode !== 0) {
            console.log("Связь потеряна, переподключение...");
            setTimeout(connect, 2000);
        }
    };

    // Проверка при активации экрана телефона
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            if (!mqtt.isConnected()) {
                console.log("Приложение активно, восстанавливаем MQTT...");
                connect();
            }
        }
    });

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
        if(t === 'dom/shtora/proc') { const p = parseInt(v); document.getElementById('l_shtora').innerText = p; document.getElementById('curt-label-dash').innerText = 'Шторы: ' + p + '%'; document.getElementById('r_shtora').value = p; updateCurtainVisual(p); }
        if(t === 'dom/oknoZal') updateWindowStatus('window-status-text', v, 't_hall');
        if(t === 'dom/tempKsu1') { document.getElementById('t_bed').innerText = v; document.getElementById('t_bed_ov').innerText = v; }
        if(t === 'dom/vlagKsu') { document.getElementById('h_bed').innerText = v; document.getElementById('h_bed_ov').innerText = v; }
        if(t === 'dom/oknoSpalny') updateWindowStatus('window-status-text-bed', v, 't_bed');
        if(t === 'dom/svSpalnyLamp/st') updateItem('svbed', v);
        if(t === 'dom/svSpalnyLamp/dim') document.getElementById('r_bed_dim').value = v;
        if(t === 'dom/svSpalnyLamp/noc') { states.bednoc = parseInt(v); document.getElementById('m_bed_day').className = states.bednoc == 0 ? 'active' : ''; document.getElementById('m_bed_night').className = states.bednoc == 1 ? 'active' : ''; updateItem('svbed', states.svbed); }
        if(t === 'dom/svSpalnyNoch/st') updateItem('svbed_rgb', v);
        if(t === 'dom/svSpalnyNoch/br') document.getElementById('r_bed_br').value = v;
        if(t === 'dom/svSpalnyNoch/rgb') { const colorVal = v.toLowerCase(); const rgba = colorMap[colorVal] || 'rgba(88, 166, 255, 0.6)'; document.documentElement.style.setProperty('--bed-rgb', rgba); document.getElementById('cp_bed_rgb').value = colorVal; updateItem('svbed_rgb', states.svbed_rgb); }
    };

    function updateCurtainVisual(val) { const p = parseInt(val); const move = (100 - p) * 0.9; document.getElementById('curt-l').style.transform = `translateX(-${move}%)`; document.getElementById('curt-r').style.transform = `translateX(${move}%)`; }
    function updateWindowStatus(textId, val, tempId) {
        const statusTxt = document.getElementById(textId);
        const tempDisplay = document.getElementById(tempId);
        const tempDisplayOv = document.getElementById(tempId + '_ov');
        if(val == "1") {
            if(statusTxt) { statusTxt.innerText = "ОКНО ОТКРЫТО"; statusTxt.style.color = "var(--accent)"; }
            if(tempDisplay) tempDisplay.classList.add('temp-pulse');
            if(tempDisplayOv) tempDisplayOv.classList.add('temp-pulse');
        } else {
            if(statusTxt) { statusTxt.innerText = "ОКНО ЗАКРЫТО"; statusTxt.style.color = "var(--text)"; }
            if(tempDisplay) tempDisplay.classList.remove('temp-pulse');
            if(tempDisplayOv) tempDisplayOv.classList.remove('temp-pulse');
        }
    }

    function updateItem(key, val) {
        states[key] = parseInt(val);
        const btnFix = (key === 'svbed_rgb') ? document.getElementById('sw_svbed_rgb') : document.getElementById('sw_' + key);
        const badge = document.getElementById('st_' + key + '_dash');
        if(btnFix) btnFix.className = states[key] ? 'toggle-btn is-on' : 'toggle-btn';
        if(badge) badge.className = states[key] ? 'badge active' : 'badge';
        const hallCard = document.getElementById('card-hall');
        if(key === 'sv1' || key === 'sv2') {
            if(states.sv1) hallCard.classList.add('glow-main'); else hallCard.classList.remove('glow-main');
            if(states.sv2) hallCard.classList.add('glow-extra'); else hallCard.classList.remove('glow-extra');
        }
        const bedCard = document.getElementById('card-bedroom');
        if(key === 'svbed' || key === 'bednoc') {
            if(states.svbed) {
                const shadow = states.bednoc === 1 ? 'inset 0 -60px 100px -20px rgba(255, 180, 50, 0.4), inset 40px 0 70px -30px rgba(255, 180, 50, 0.2), inset -40px 0 70px -30px rgba(255, 180, 50, 0.2)' : 'inset 0 -60px 100px -20px rgba(88, 166, 255, 0.5), inset 40px 0 70px -30px rgba(88, 166, 255, 0.3), inset -40px 0 70px -30px rgba(88, 166, 255, 0.3)';
                document.documentElement.style.setProperty('--bed-glow-bottom', shadow);
                bedCard.style.borderBottom = states.bednoc === 1 ? '1px solid rgba(255, 180, 50, 0.4)' : '1px solid rgba(88, 166, 255, 0.4)';
            } else { document.documentElement.style.setProperty('--bed-glow-bottom', 'inset 0 0 0 transparent'); bedCard.style.borderBottom = '1px solid transparent'; }
        }
        if(key === 'svbed_rgb') {
            if(states.svbed_rgb) {
                const rgbColor = getComputedStyle(document.documentElement).getPropertyValue('--bed-rgb');
                document.documentElement.style.setProperty('--bed-glow-top', `inset 0 70px 110px -30px ${rgbColor}`);
                bedCard.style.borderTop = `1px solid ${rgbColor}`;
            } else { document.documentElement.style.setProperty('--bed-glow-top', 'inset 0 0 0 transparent'); bedCard.style.borderTop = '1px solid transparent'; }
        }
    }

    function updateBoilerMode(m) {
        states.mode = m;
        ['auto','manual','off'].forEach(x => {
            const btn = document.getElementById('m_'+x); const bge = document.getElementById('badge_'+x);
            if(btn) btn.className = (m === x ? 'active' : ''); if(bge) bge.style.display = (m === x ? 'block' : 'none');
        });
        const cm = document.getElementById('col-manual'); const cp = document.getElementById('col-pza');
        if(m === 'auto') { cm.classList.add('locked-ui'); cp.classList.remove('locked-ui'); }
        else if(m === 'manual') { cm.classList.remove('locked-ui'); cp.classList.add('locked-ui'); }
        else { cm.classList.add('locked-ui'); cp.classList.add('locked-ui'); }
    }

    function send(t, v) { const msg = new Paho.MQTT.Message(String(v)); msg.destinationName = t; msg.retained = true; mqtt.send(msg); }
    function openOverlay(id) { document.getElementById('app-content').classList.add('blurred'); const ov = document.getElementById(id); ov.style.display = 'flex'; setTimeout(() => ov.classList.add('active'), 10); }
    function closeOverlay() { document.getElementById('app-content').classList.remove('blurred'); document.querySelectorAll('.overlay').forEach(ov => { ov.classList.remove('active'); setTimeout(() => ov.style.display = 'none', 500); }); }
    function updateClock() { const now = new Date(); document.getElementById('clock-time').innerText = now.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'}); document.getElementById('clock-date').innerText = now.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'}); }
    setInterval(updateClock, 1000); updateClock();
