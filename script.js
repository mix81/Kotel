        const cfg = { h: 'm9.wqtt.ru', p: 13733, u: 'u_OCW7RS', w: 'tY9lf91e', id: 'PRO_' + Math.random().toString(16).substr(2,4) };
        const mqtt = new Paho.MQTT.Client(cfg.h, cfg.p, cfg.id);
        
        // states расширен для Детской, Кухни и Ванной
        let states = { r2:0, r3:0, sv1:0, sv2:0, svbed:0, svbed_rgb:0, svdet:0, svdet_rgb:0, mode:'off', bednoc: 0, detnoc: 0, kit_light:0, kit_sub:0, kit_night:0, kit_fan:0, kit_fan_speed:0, bath_light:0, bath_mirror:0, bath_dush:0, bath_vent:0, water_temp:0, water_zad:0, water_mode:2 };
        let isConnected = false;
        const colorMap = { 'red': 'rgba(255, 0, 0, 0.6)', 'green': 'rgba(0, 255, 0, 0.6)', 'blue': 'rgba(0, 0, 255, 0.6)', 'yellow': 'rgba(255, 255, 0, 0.6)', 'cyan': 'rgba(0, 255, 255, 0.6)', 'magenta': 'rgba(255, 0, 255, 0.6)', 'orange': 'rgba(255, 165, 0, 0.6)', 'purple': 'rgba(128, 0, 128, 0.6)', 'pink': 'rgba(255, 192, 203, 0.6)', 'white': 'rgba(255, 255, 255, 0.5)' };

        function checkPass() { 
            const pass = document.getElementById('passInput').value;
            if (pass === "1902") { 
                // Реальный режим
                isDemoMode = false;
                document.getElementById('demo-badge').style.display = 'none';
                document.getElementById('auth-screen').style.display = 'none'; 
                document.getElementById('app-content').style.display = 'flex'; 
                connect(); 
            } else if (pass.length > 0) {
                // Демо-режим при неверном пароле
                isDemoMode = true;
                document.getElementById('demo-badge').style.display = 'block';
                document.getElementById('auth-screen').style.display = 'none'; 
                document.getElementById('app-content').style.display = 'flex'; 
                updateClock();
                setInterval(updateClock, 1000);
                startDemoSimulation();
            } else {
                alert('Введите пароль!');
            }
        }
        
        let isDemoMode = false;
        
        function connect() { 
            mqtt.connect({ 
                userName: cfg.u, 
                password: cfg.w, 
                useSSL: true, 
                keepAliveInterval: 60,
                onSuccess: () => { 
                    isConnected = true;
                    mqtt.subscribe("heater/#"); 
                    mqtt.subscribe("dom/#"); 
                }, 
                onFailure: () => setTimeout(connect, 5000) 
            }); 
        }

        mqtt.onConnectionLost = (responseObject) => {
            isConnected = false;
            if (responseObject.errorCode !== 0) {
                console.log("onConnectionLost:"+responseObject.errorMessage);
                setTimeout(connect, 5000);
            }
        };

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                if (!isConnected) connect();
            }
        });

        mqtt.onMessageArrived = (m) => {
            const t = m.destinationName; const v = m.payloadString;
            // КОТЕЛ
            if(t === 'heater/temperature') document.getElementById('t_water').innerText = v;
            if(t === 'heater/setpoint/state') { document.getElementById('l_sp').innerText = v; document.getElementById('l_sp_dash').innerText = v; document.getElementById('r_sp').value = v; }
            if(t === 'heater/mode/state') updateBoilerMode(v);
            if(t === 'heater/relay2/state') updateItem('r2', v);
            if(t === 'heater/relay3/state') updateItem('r3', v);
            if(t === 'heater/power_percent') document.getElementById('pwr_val').innerText = v + '%';
            
            // ОБЩЕЕ / ЗАЛ
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
            if(t === 'dom/shtoraZal/proc/state') { 
                const p = parseInt(v); 
                document.getElementById('l_shtora').innerText = p; 
                document.getElementById('curt-label-dash').innerText = 'Шторы: ' + p + '%'; 
                document.getElementById('r_shtora').value = p; 
                updateCurtainVisual(p); 
            }
            if(t === 'dom/oknoZal') updateWindowStatus('window-status-text', v, 't_hall');

            // СПАЛЬНЯ
            if(t === 'dom/tempKsu1') { document.getElementById('t_bed').innerText = v; document.getElementById('t_bed_ov').innerText = v; }
            if(t === 'dom/vlagKsu') { document.getElementById('h_bed').innerText = v; document.getElementById('h_bed_ov').innerText = v; }
            if(t === 'dom/oknoSpalny') updateWindowStatus('window-status-text-bed', v, 't_bed');
            if(t === 'dom/svSpalnyLamp/st') updateItem('svbed', v);
            if(t === 'dom/svSpalnyLamp/dim') document.getElementById('r_bed_dim').value = v;
            if(t === 'dom/svSpalnyLamp/noc') { states.bednoc = parseInt(v); document.getElementById('m_bed_day').className = states.bednoc == 0 ? 'active' : ''; document.getElementById('m_bed_night').className = states.bednoc == 1 ? 'active' : ''; updateItem('svbed', states.svbed); }
            if(t === 'dom/svSpalnyNoch/st') updateItem('svbed_rgb', v);
            if(t === 'dom/svSpalnyNoch/br') document.getElementById('r_bed_br').value = v;
            if(t === 'dom/svSpalnyNoch/rgb') { const colorVal = v.toLowerCase(); const rgba = colorMap[colorVal] || 'rgba(88, 166, 255, 0.6)'; document.documentElement.style.setProperty('--bed-rgb', rgba); document.getElementById('cp_bed_rgb').value = colorVal; updateItem('svbed_rgb', states.svbed_rgb); }

            // ДЕТСКАЯ (НОВЫЕ ТОПИКИ)
            if(t === 'dom/tempMot1') { document.getElementById('t_det').innerText = v; document.getElementById('t_det_ov').innerText = v; }
            if(t === 'dom/vlagMot') { document.getElementById('h_det').innerText = v; document.getElementById('h_det_ov').innerText = v; }
            if(t === 'dom/oknoDetskay') updateWindowStatus('window-status-text-det', v, 't_det');
            if(t === 'dom/svDetLamp/st') updateItem('svdet', v);
            if(t === 'dom/svDetLamp/dim') document.getElementById('r_det_dim').value = v;
            if(t === 'dom/svDetLamp/noc') { states.detnoc = parseInt(v); document.getElementById('m_det_day').className = states.detnoc == 0 ? 'active' : ''; document.getElementById('m_det_night').className = states.detnoc == 1 ? 'active' : ''; updateItem('svdet', states.svdet); }
            if(t === 'dom/svDetNoch/st') updateItem('svdet_rgb', v);
            if(t === 'dom/svDetNoch/br') document.getElementById('r_det_br').value = v;
            if(t === 'dom/svDetNoch/rgb') { const colorVal = v.toLowerCase(); const rgba = colorMap[colorVal] || 'rgba(88, 166, 255, 0.6)'; document.documentElement.style.setProperty('--det-rgb', rgba); document.getElementById('cp_det_rgb').value = colorVal; updateItem('svdet_rgb', states.svdet_rgb); }

            // КУХНЯ
            if(t === 'dom/tempZal') { document.getElementById('t_kit').innerText = v; document.getElementById('t_kit_ov').innerText = v; }
            if(t === 'dom/vlagZal') { document.getElementById('h_kit').innerText = v; document.getElementById('h_kit_ov').innerText = v; }
            if(t === 'dom/svKuh1') updateLocalState('dom/svKuh1', v);
            if(t === 'dom/svKuh2') updateLocalState('dom/svKuh2', v);
            if(t === 'dom/svKuh3') updateLocalState('dom/svKuh3', v);
            if(t === 'dom/Vityjka') updateLocalState('dom/Vityjka', v);
            if(t === 'dom/Vityjka1') updateLocalState('dom/Vityjka1', v);
            if(t === 'dom/oknoKuhny') updateLocalState('dom/oknoKuhny', v);
            if(t === 'dom/dverKuhny') updateLocalState('dom/dverKuhny', v);

            // ВАННАЯ
            if(t === 'dom/vod/temp') { document.getElementById('t_vod').innerText = v; document.getElementById('t_vod_ov').innerText = v; states.water_temp = parseFloat(v); }
            if(t === 'dom/vod/zad') { document.getElementById('t_vod_zad').innerText = v; document.getElementById('t_vod_zad_ov').innerText = v; states.water_zad = parseFloat(v); }
            if(t === 'dom/vod/regim') { states.water_mode = parseInt(v); updateWaterModeButtons(v); }
            if(t === 'dom/svVan') { states.bath_light = parseInt(v); updateButtonState('sw_bath_light', states.bath_light); }
            if(t === 'dom/svVanZerkalo') { states.bath_mirror = parseInt(v); updateButtonState('sw_bath_mirror', states.bath_mirror); }
            if(t === 'dom/svVanDush') { states.bath_dush = parseInt(v); updateButtonState('sw_bath_dush', states.bath_dush); }
            if(t === 'dom/svVanVent') { states.bath_vent = parseInt(v); updateButtonState('sw_bath_vent', states.bath_vent); }
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
            const btnFix = (key === 'svbed_rgb') ? document.getElementById('sw_svbed_rgb') : 
                           (key === 'svdet_rgb') ? document.getElementById('sw_svdet_rgb') : 
                           document.getElementById('sw_' + key);
            
            const badge = document.getElementById('st_' + key + '_dash');
            if(btnFix) btnFix.className = states[key] ? 'toggle-btn is-on' : 'toggle-btn';
            if(badge) badge.className = states[key] ? 'badge active' : 'badge';
            
            // ЗАЛ
            const hallCard = document.getElementById('card-hall');
            if(key === 'sv1' || key === 'sv2') {
                if(states.sv1) hallCard.classList.add('glow-main'); else hallCard.classList.remove('glow-main');
                if(states.sv2) hallCard.classList.add('glow-extra'); else hallCard.classList.remove('glow-extra');
            }
            
            // СПАЛЬНЯ
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

            // ДЕТСКАЯ
            const detCard = document.getElementById('card-children');
            if(key === 'svdet' || key === 'detnoc') {
                if(states.svdet) {
                    const shadow = states.detnoc === 1 ? 'inset 0 -60px 100px -20px rgba(255, 180, 50, 0.4), inset 40px 0 70px -30px rgba(255, 180, 50, 0.2), inset -40px 0 70px -30px rgba(255, 180, 50, 0.2)' : 'inset 0 -60px 100px -20px rgba(88, 166, 255, 0.5), inset 40px 0 70px -30px rgba(88, 166, 255, 0.3), inset -40px 0 70px -30px rgba(88, 166, 255, 0.3)';
                    document.documentElement.style.setProperty('--det-glow-bottom', shadow);
                    detCard.style.borderBottom = states.detnoc === 1 ? '1px solid rgba(255, 180, 50, 0.4)' : '1px solid rgba(88, 166, 255, 0.4)';
                } else { document.documentElement.style.setProperty('--det-glow-bottom', 'inset 0 0 0 transparent'); detCard.style.borderBottom = '1px solid transparent'; }
            }
            if(key === 'svdet_rgb') {
                if(states.svdet_rgb) {
                    const rgbColorDet = getComputedStyle(document.documentElement).getPropertyValue('--det-rgb');
                    document.documentElement.style.setProperty('--det-glow-top', `inset 0 70px 110px -30px ${rgbColorDet}`);
                    detCard.style.borderTop = `1px solid ${rgbColorDet}`;
                } else { document.documentElement.style.setProperty('--det-glow-top', 'inset 0 0 0 transparent'); detCard.style.borderTop = '1px solid transparent'; }
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

        function send(t, v) { 
            // В демо-режиме не отправляем на сервер
            if (isDemoMode) {
                console.log('📱 ДЕМО-РЕЖИМ: ' + t + ' = ' + v);
                updateLocalState(t, v);
                return;
            }
            
            // В реальном режиме отправляем на MQTT
            if(!isConnected) return;
            const msg = new Paho.MQTT.Message(String(v)); 
            msg.destinationName = t; 
            msg.retained = true; 
            mqtt.send(msg); 
        }
        
        function updateLocalState(topic, value) {
            // Для кухни
            if (topic === 'dom/svKuh1') {
                states.kit_light = parseInt(value);
                updateButtonState('sw_kit_light', states.kit_light);
                updateKitchenGlow();
            }
            if (topic === 'dom/svKuh2') {
                states.kit_sub = parseInt(value);
                updateButtonState('sw_kit_sub', states.kit_sub);
                updateKitchenGlow();
            }
            if (topic === 'dom/svKuh3') {
                states.kit_night = parseInt(value);
                updateButtonState('sw_kit_night', states.kit_night);
            }
            if (topic === 'dom/Vityjka') {
                states.kit_fan = parseInt(value);
                updateButtonState('sw_kit_fan', states.kit_fan);
            }
            if (topic === 'dom/Vityjka1') {
                states.kit_fan_speed = parseInt(value);
                updateFanSpeedButtons(value);
            }
            if (topic === 'dom/oknoKuhny') {
                updateWindowStatus('window-status-text-kit', value, 't_kit');
            }
            if (topic === 'dom/dverKuhny') {
                updateDoorStatus('door-status-text-kit', value, 't_kit');
            }
        }
        
        function updateKitchenGlow() {
            const kitCard = document.getElementById('card-kitchen');
            
            // При включении основного света - низ светится
            if (states.kit_light) {
                const shadow = 'inset 0 -60px 100px -20px rgba(88, 166, 255, 0.5), inset 40px 0 70px -30px rgba(88, 166, 255, 0.3), inset -40px 0 70px -30px rgba(88, 166, 255, 0.3)';
                document.documentElement.style.setProperty('--kit-glow-bottom', shadow);
                kitCard.style.borderBottom = '1px solid rgba(88, 166, 255, 0.4)';
            } else {
                document.documentElement.style.setProperty('--kit-glow-bottom', 'inset 0 0 0 transparent');
                kitCard.style.borderBottom = '1px solid transparent';
            }
            
            // При включении подсветки рабочей зоны - верх светится
            if (states.kit_sub) {
                const shadow = 'inset 0 70px 110px -30px rgba(88, 166, 255, 0.6)';
                document.documentElement.style.setProperty('--kit-glow-top', shadow);
                kitCard.style.borderTop = '1px solid rgba(88, 166, 255, 0.7)';
            } else {
                document.documentElement.style.setProperty('--kit-glow-top', 'inset 0 0 0 transparent');
                kitCard.style.borderTop = '1px solid transparent';
            }
        }
        
        function updateDoorStatus(textId, val, tempId) {
            const statusTxt = document.getElementById(textId);
            const tempDisplay = document.getElementById(tempId);
            const tempDisplayOv = document.getElementById(tempId + '_ov');
            if(val == "1") {
                if(statusTxt) { statusTxt.innerText = "ДВЕРИ ОТКРЫТЫ"; statusTxt.style.color = "var(--accent)"; }
                if(tempDisplay) tempDisplay.classList.add('temp-pulse');
                if(tempDisplayOv) tempDisplayOv.classList.add('temp-pulse');
            } else {
                if(statusTxt) { statusTxt.innerText = "ДВЕРИ ЗАКРЫТЫ"; statusTxt.style.color = "var(--text)"; }
                if(tempDisplay) tempDisplay.classList.remove('temp-pulse');
                if(tempDisplayOv) tempDisplayOv.classList.remove('temp-pulse');
            }
        }
        
        function updateButtonState(id, state) {
            const btn = document.getElementById(id);
            if (btn) {
                if (state) {
                    btn.classList.add('is-on');
                } else {
                    btn.classList.remove('is-on');
                }
            }
        }
        
        function updateFanSpeedButtons(speed) {
            const btn1 = document.getElementById('fan_speed_1');
            const btn2 = document.getElementById('fan_speed_2');
            
            // Убираем класс active у всех
            btn1.classList.remove('active');
            btn2.classList.remove('active');
            
            // Восстанавливаем стили
            btn1.style.background = '#30363d';
            btn1.style.color = '#c9d1d9';
            btn2.style.background = '#30363d';
            btn2.style.color = '#c9d1d9';
            
            // Устанавливаем активную кнопку
            if (speed == 1) {
                btn1.classList.add('active');
                btn1.style.background = '#58a6ff';
                btn1.style.color = '#fff';
            } else if (speed == 2) {
                btn2.classList.add('active');
                btn2.style.background = '#58a6ff';
                btn2.style.color = '#fff';
            }
        }
        
        function setFanSpeed(speed) {
            if (isDemoMode) {
                console.log('📱 ДЕМО-РЕЖИМ: Скорость вытяжки = ' + speed);
                updateFanSpeedButtons(speed);
                return;
            }
            send('dom/Vityjka1', speed);
            updateFanSpeedButtons(speed);
        }
        
        function setWaterMode(mode) {
            if (isDemoMode) {
                console.log('📱 ДЕМО-РЕЖИМ: Режим водонагревателя = ' + mode);
                updateWaterModeButtons(mode);
                return;
            }
            send('dom/vod/regim', mode);
            updateWaterModeButtons(mode);
        }
        
        function updateWaterModeButtons(mode) {
            const btn1 = document.getElementById('mode_turbo');
            const btn2 = document.getElementById('mode_normal');
            const btn3 = document.getElementById('mode_eco');
            const btn4 = document.getElementById('mode_min');
            
            [btn1, btn2, btn3, btn4].forEach(btn => {
                btn.style.background = '#30363d';
                btn.style.color = '#c9d1d9';
            });
            
            const buttons = [btn1, btn2, btn3, btn4];
            if (mode >= 1 && mode <= 4) {
                buttons[mode - 1].style.background = '#58a6ff';
                buttons[mode - 1].style.color = '#fff';
            }
        }
        
        function openOverlay(id) { document.getElementById('app-content').classList.add('blurred'); const ov = document.getElementById(id); ov.style.display = 'flex'; setTimeout(() => ov.classList.add('active'), 10); }
        function closeOverlay() { document.getElementById('app-content').classList.remove('blurred'); document.querySelectorAll('.overlay').forEach(ov => { ov.classList.remove('active'); setTimeout(() => ov.style.display = 'none', 500); }); }
        
        function startDemoSimulation() {
            // Вымышленные начальные значения
            const demoData = {
                't_water': 42.5, 'l_sp_dash': 55, 'pwr_val': '35%',
                't_hall': 22.4, 'h_hall': 45,
                't_bed': 21.8, 'h_bed': 48,
                't_det': 23.1, 'h_det': 42,
                't_kit': 24.2, 'h_kit': 52, 't_kit_ov': 24.2, 'h_kit_ov': 52,
                't_bath': 23.5, 'h_bath': 65, 't_bath_ov': 23.5, 'h_bath_ov': 65
            };
            
            // Установим начальные значения
            for (let id in demoData) {
                const el = document.getElementById(id);
                if (el) el.innerText = demoData[id];
            }
            
            // Обновляем данные каждые 3 секунды (имитируем датчики)
            setInterval(() => {
                if (!isDemoMode) return;
                
                // Случайные изменения температур (симуляция реальных датчиков)
                document.getElementById('t_water').innerText = (40 + Math.random() * 5).toFixed(1);
                document.getElementById('t_hall').innerText = (21 + Math.random() * 4).toFixed(1);
                document.getElementById('h_hall').innerText = Math.floor(40 + Math.random() * 20);
                
                document.getElementById('t_bed').innerText = (20 + Math.random() * 4).toFixed(1);
                document.getElementById('h_bed').innerText = Math.floor(45 + Math.random() * 15);
                
                document.getElementById('t_det').innerText = (22 + Math.random() * 4).toFixed(1);
                document.getElementById('h_det').innerText = Math.floor(35 + Math.random() * 20);
                
                document.getElementById('t_kit').innerText = (23 + Math.random() * 5).toFixed(1);
                document.getElementById('h_kit').innerText = Math.floor(48 + Math.random() * 20);
                document.getElementById('t_kit_ov').innerText = (23 + Math.random() * 5).toFixed(1);
                document.getElementById('h_kit_ov').innerText = Math.floor(48 + Math.random() * 20);
                
                document.getElementById('t_bath').innerText = (22 + Math.random() * 5).toFixed(1);
                document.getElementById('h_bath').innerText = Math.floor(60 + Math.random() * 25);
                document.getElementById('t_bath_ov').innerText = (22 + Math.random() * 5).toFixed(1);
                document.getElementById('h_bath_ov').innerText = Math.floor(60 + Math.random() * 25);
                
                // Случайная мощность котла
                document.getElementById('pwr_val').innerText = Math.floor(Math.random() * 100) + '%';
            }, 3000);
        }
        
        function updateClock() { 
            const now = new Date(); 
            document.getElementById('clock-time').innerText = now.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'}); 
            document.getElementById('clock-date').innerText = now.toLocaleDateString('ru-RU', {weekday:'long', day:'numeric', month:'long'}); 
        }
        setInterval(updateClock, 1000); 
        updateClock();

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW error', err));
            });
        }
