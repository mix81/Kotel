// =====================================================================
// КОНФИГУРАЦИЯ MQTT
// =====================================================================
const cfg = {
    h: 'm9.wqtt.ru', p: 13733,
    u: 'u_OCW7RS', w: 'tY9lf91e',
    id: 'PRO_' + Math.random().toString(16).substr(2, 4)
};
const mqtt = new Paho.MQTT.Client(cfg.h, cfg.p, cfg.id);

// =====================================================================
// ЭТАП 5: КЭШ DOM-ЭЛЕМЕНТОВ (один раз при загрузке)
// =====================================================================
const DOM = {};
function initDOMCache() {
    const ids = [
        't_water','t_water_left','l_sp','l_sp_dash','l_sp_left','r_sp',
        'pwr_val','st_r2_dash','st_r3_dash','sw_r2','sw_r3',
        'badge_auto','badge_manual','badge_off',
        'boiler-auto-block','boiler-manual-block','boiler-off-block',
        'm_auto','m_manual','m_off',
        'l_rt','r_rt','l_kf','r_kf','i_kp','i_ki','i_kd','t_out_big',
        'kot_pressure',
        't_street','h_street','p_street','t_street_ov','h_street_ov','p_street_ov',
        'sw_street_light','sw_street_bbq','card-street',
        't_hall','h_hall','t_hall_ov','h_hall_ov',
        'l_shtora','r_shtora','curt-label-dash','curt-l','curt-r',
        'window-status-text','card-hall','sw_sv1','sw_sv2',
        'sw_hall_vent','hall_speed_1','hall_speed_2',
        't_bed','h_bed','t_bed_ov','h_bed_ov',
        'window-status-text-bed','card-bedroom',
        'sw_svbed','m_bed_day','m_bed_night','r_bed_dim',
        'sw_svbed_rgb','cp_bed_rgb','r_bed_br','sw_wardrobe',
        't_det','h_det','t_det_ov','h_det_ov',
        'window-status-text-det','card-children',
        'sw_svdet','m_det_day','m_det_night','r_det_dim',
        'sw_svdet_rgb','cp_det_rgb','r_det_br','l_det_zad',
        't_kit','h_kit','t_kit_ov','h_kit_ov','t_chay','t_chay_ov','sw_chay_stat',
        'window-status-text-kit','door-status-text-kit','card-kitchen',
        'sw_kit_light','sw_kit_sub','sw_kit_night',
        'sw_kit_fan','fan_speed_1','fan_speed_2',
        't_vod','t_vod_ov','t_vod_zad','t_vod_zad_ov',
        'card-bathroom','sw_bath_light','sw_bath_mirror','sw_bath_dush','sw_bath_vent',
        'sw_water_stat','mode_turbo','mode_normal','mode_eco','mode_min',
        'bath-temp-container','bath-zad-container',
        'power_watts','power_watts_ov','voltage_volts','voltage_volts_ov',
        'current_amps','current_amps_ov','power_boiler','power_water_heater',
        'card_shield_svg','card-security',
        'sensor_hall_window','sensor_bed_window','sensor_kids_window',
        'sensor_kitchen_window','sensor_kitchen_door','sensor_front_door',
        'srv_cpu','srv_cpu_bar','srv_ram','srv_ram_bar','srv_ram_used','srv_ram_total',
        'srv_disk','srv_disk_bar','srv_disk_used','srv_disk_total','srv_temp','card-server',
        't_home','h_home','card-home',
        'clock-time','clock-date',
        'app-content','main-screen','rooms-screen','tech-screen',
        // Контроль
        'ctrl_mqtt_status','ctrl_pwa_status','ctrl_heartbeat','ctrl_last_msg',
        'ctrl_ov_mqtt','ctrl_host','ctrl_client_id','ctrl_version','ctrl_mode',
        'ctrl_msg_rx','ctrl_msg_tx','ctrl_msg_queued','ctrl_log_entries'
    ];
    ids.forEach(id => { DOM[id] = document.getElementById(id); });
}

// =====================================================================
// ХЕЛПЕР-ФУНКЦИИ
// =====================================================================
const setText  = (id, val) => { const el = DOM[id] || document.getElementById(id); if (el) el.innerText = val; };
const setVal   = (id, val) => { const el = DOM[id] || document.getElementById(id); if (el) el.value = val; };
const addClass = (id, cls) => { if (DOM[id]) DOM[id].classList.add(cls); };
const remClass = (id, cls) => { if (DOM[id]) DOM[id].classList.remove(cls); };
const setStyle = (id, prop, val) => { if (DOM[id]) DOM[id].style[prop] = val; };
const setCssVar = (name, val) => document.documentElement.style.setProperty(name, val);

// =====================================================================
// СОСТОЯНИЯ И НАСТРОЙКИ
// =====================================================================
let isConnected = false;

let states = {
    r2:0, r3:0, sv1:0, sv2:0,
    svbed:0, svbed_rgb:0, bednoc:0,
    svdet:0, svdet_rgb:0, detnoc:0, det_zad:0,
    kit_light:0, kit_sub:0, kit_night:0, kit_fan:0, kit_fan_speed:0, chay_stat:0,
    bath_light:0, bath_mirror:0, bath_dush:0, bath_vent:0,
    water_temp:0, water_zad:0, water_mode:2, water_stat:0,
    hall_vent:0, hall_fan_speed:0, wardrobe_light:0,
    pritok:0, pritok_speed:0,
    street_light:0, street_bbq:0, street_garland:0, street_lanterns:0, security_mode:0,
    watering_zone1:0, watering_zone2:0,
    mode: 'off'
};

const colorMap = {
    'red':     'rgba(255, 0, 0, 0.6)',     'green':   'rgba(0, 255, 0, 0.6)',
    'blue':    'rgba(0, 0, 255, 0.6)',     'yellow':  'rgba(255, 255, 0, 0.6)',
    'cyan':    'rgba(0, 255, 255, 0.6)',   'magenta': 'rgba(255, 0, 255, 0.6)',
    'orange':  'rgba(255, 165, 0, 0.6)',   'purple':  'rgba(128, 0, 128, 0.6)',
    'pink':    'rgba(255, 192, 203, 0.6)', 'white':   'rgba(255, 255, 255, 0.5)'
};

// =====================================================================
// КОНТРОЛЬ — диагностика и управление
// =====================================================================
let mqttRxCount = 0;
let mqttTxCount = 0;
let messageQueue = [];
let lastMessageTime = Date.now();
const VERSION = '1.2.0';

function updateControlPanel() {
    const statusSpan = document.getElementById('ctrl_mqtt_status');
    if (statusSpan) {
        statusSpan.innerText = isConnected ? '● ONLINE' : '● OFFLINE';
        statusSpan.style.color = isConnected ? '#238636' : '#da3633';
    }
    const ovStatus = document.getElementById('ctrl_ov_mqtt');
    if (ovStatus) {
        ovStatus.innerText = isConnected ? 'ONLINE' : 'OFFLINE';
        ovStatus.style.backgroundColor = isConnected ? '#238636' : '#da3633';
    }
    const clientIdSpan = document.getElementById('ctrl_client_id');
    if (clientIdSpan) clientIdSpan.innerText = cfg.id;
    
    const pwaSpan = document.getElementById('ctrl_pwa_status');
    const modeSpan = document.getElementById('ctrl_mode');
    if (pwaSpan && modeSpan) {
        const isPWA = window.matchMedia('(display-mode: standalone)').matches;
        pwaSpan.innerText = isPWA ? '✓ PWA' : '🌐 Браузер';
        pwaSpan.style.color = isPWA ? '#238636' : '#e3b341';
        modeSpan.innerText = isPWA ? 'PWA (установлено)' : 'Браузер';
    }
    
    const rxSpan = document.getElementById('ctrl_msg_rx');
    if (rxSpan) rxSpan.innerText = mqttRxCount;
    const txSpan = document.getElementById('ctrl_msg_tx');
    if (txSpan) txSpan.innerText = mqttTxCount;
    const queuedSpan = document.getElementById('ctrl_msg_queued');
    if (queuedSpan) queuedSpan.innerText = messageQueue.length;
    
    const sinceLastMsg = (Date.now() - lastMessageTime) / 1000;
    const heartbeatPercent = Math.max(0, Math.min(100, 100 - (sinceLastMsg / 60) * 100));
    const heartbeatBar = document.getElementById('ctrl_heartbeat');
    if (heartbeatBar) heartbeatBar.style.width = heartbeatPercent + '%';
    
    const lastMsgSpan = document.getElementById('ctrl_last_msg');
    if (lastMsgSpan) {
        if (sinceLastMsg < 60) lastMsgSpan.innerText = `${Math.floor(sinceLastMsg)} сек назад`;
        else if (sinceLastMsg < 3600) lastMsgSpan.innerText = `${Math.floor(sinceLastMsg / 60)} мин назад`;
        else lastMsgSpan.innerText = `${Math.floor(sinceLastMsg / 3600)} ч назад`;
    }
}

function addControlLog(msg) {
    const logDiv = document.getElementById('ctrl_log_entries');
    if (!logDiv) return;
    const timestamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = document.createElement('div');
    entry.style.borderBottom = '1px solid #21262d';
    entry.style.padding = '4px 0';
    entry.style.fontSize = '10px';
    entry.innerHTML = `<span style="color:#8b949e;">[${timestamp}]</span> ${msg}`;
    logDiv.prepend(entry);
    while (logDiv.children.length > 20) logDiv.removeChild(logDiv.lastChild);
}

function manualReconnect() {
    if (mqtt && !isConnected) {
        addControlLog('🔄 Ручное переподключение MQTT...');
        connect();
    } else if (isConnected) {
        addControlLog('✅ MQTT уже подключён');
    } else {
        addControlLog('❌ Ошибка: клиент MQTT не инициализирован');
    }
}

function clearAppCache() {
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
        });
    }
    localStorage.clear();
    addControlLog('🗑 Кэш и localStorage очищены, перезагрузка...');
    setTimeout(() => { window.location.reload(); }, 500);
}

function flushMessageQueue() {
    if (isConnected && messageQueue.length > 0) {
        addControlLog(`🔄 Отправка ${messageQueue.length} отложенных сообщений`);
        const queueCopy = [...messageQueue];
        messageQueue = [];
        queueCopy.forEach(msg => {
            sendOriginal(msg.topic, msg.value);
            mqttTxCount++;
        });
        updateControlPanel();
    }
}

// =====================================================================
// ОБЪЕКТ-МАРШРУТИЗАТОР MQTT-СООБЩЕНИЙ
// =====================================================================
const topicRouter = {
    'heater/temperature':     v => { setText('t_water', v); setText('t_water_left', v); },
    'heater/setpoint/state':  v => { setText('l_sp', v); setText('l_sp_dash', v); setText('l_sp_left', v); setVal('r_sp', v); },
    'heater/mode/state':      v => updateBoilerMode(v),
    'heater/relay2/state':    v => updateItem('r2', v),
    'heater/relay3/state':    v => updateItem('r3', v),
    'heater/power_percent':   v => setText('pwr_val', v + '%'),
    'heater/room_temp/state': v => { setText('l_rt', v); setVal('r_rt', v); },
    'heater/k_factor/state':  v => { setText('l_kf', v); setVal('r_kf', v); },
    'heater/kp/state':        v => setVal('i_kp', v),
    'heater/ki/state':        v => setVal('i_ki', v),
    'heater/kd/state':        v => setVal('i_kd', v),
    'dom/tempUlica': v => { setText('t_out_big', v); setText('t_street', v); setText('t_street_ov', v); },
    'dom/vlagUlica': v => { setText('h_street', v); setText('h_street_ov', v); },
    'dom/davlUlica': v => { setText('p_street', v); setText('p_street_ov', v); },
    'dom/svUlica':   v => { states.street_light = +v; updateButtonState('sw_street_light', +v); updateStreetGlow(); },
    'dom/svMangal':  v => { states.street_bbq = +v;  updateButtonState('sw_street_bbq', +v);   updateStreetGlow(); },
    'dom/rozDom':    v => { states.street_garland = +v; updateButtonState('sw_street_garland', +v); updateStreetGlow(); },
    'dom/svFonar':   v => { states.street_lanterns = +v; updateButtonState('sw_street_lanterns', +v); updateStreetGlow(); },
    'dom/poliv1':    v => { states.watering_zone1 = +v; updateButtonState('sw_watering_zone1', +v); handleWateringToggle(); },
    'dom/poliv2':    v => { states.watering_zone2 = +v; updateButtonState('sw_watering_zone2', +v); handleWateringToggle(); },
    'dom/svGarderob':v => { states.wardrobe_light = +v; updateButtonState('sw_wardrobe', +v); },
    'dom/tempZal': v => { setText('t_hall', v); setText('t_hall_ov', v); updateHomeCardAverage(); },
    'dom/vlagZal': v => { setText('h_hall', v); setText('h_hall_ov', v); updateHomeCardAverage(); },
    'dom/svZal1':  v => { updateItem('sv1', v); updateHomeCardGlow(); },
    'dom/svZal2':  v => { updateItem('sv2', v); updateHomeCardGlow(); },
    'dom/shtoraZal/proc/state': v => {
        const p = parseInt(v);
        setText('l_shtora', p);
        if (DOM['curt-label-dash']) DOM['curt-label-dash'].innerText = 'Шторы: ' + p + '%';
        setVal('r_shtora', p);
        updateCurtainVisual(p);
    },
    'dom/oknoZal':    v => { updateWindowStatus('window-status-text', v, 't_hall'); updateSecuritySensor('sensor_hall_window', v); },
    'dom/Pritok':     v => { states.pritok = +v; updateButtonState('sw_hall_vent', +v); },
    'dom/Pritok1':    v => { states.pritok_speed = +v; updateHallFanSpeedButtons(v); },
    'dom/tempKsu1':          v => { setText('t_bed', v); setText('t_bed_ov', v); updateHomeCardAverage(); },
    'dom/vlagKsu':           v => { setText('h_bed', v); setText('h_bed_ov', v); updateHomeCardAverage(); },
    'dom/oknoSpalny':        v => { updateWindowStatus('window-status-text-bed', v, 't_bed'); updateSecuritySensor('sensor_bed_window', v); },
    'dom/svSpalnyLamp/st':   v => { updateItem('svbed', v); updateHomeCardGlow(); },
    'dom/svSpalnyLamp/dim':  v => setVal('r_bed_dim', v),
    'dom/svSpalnyLamp/noc':  v => {
        states.bednoc = +v;
        if (DOM['m_bed_day'])   DOM['m_bed_day'].className   = (states.bednoc == 0 ? 'active' : '');
        if (DOM['m_bed_night']) DOM['m_bed_night'].className = (states.bednoc == 1 ? 'active' : '');
        updateItem('svbed', states.svbed);
    },
    'dom/svSpalnyNoch/st':   v => updateItem('svbed_rgb', v),
    'dom/svSpalnyNoch/br':   v => setVal('r_bed_br', v),
    'dom/svSpalnyNoch/rgb':  v => {
        const colorVal = v.toLowerCase();
        setCssVar('--bed-rgb', colorMap[colorVal] || 'rgba(88, 166, 255, 0.6)');
        setVal('cp_bed_rgb', colorVal);
        updateItem('svbed_rgb', states.svbed_rgb);
    },
    'dom/tempMot1':       v => { setText('t_det', v); setText('t_det_ov', v); updateHomeCardAverage(); },
    'dom/vlagMot':        v => { setText('h_det', v); setText('h_det_ov', v); updateHomeCardAverage(); },
    'dom/tempMotzad':     v => { states.det_zad = parseFloat(v); setText('l_det_zad', parseFloat(v).toFixed(1)); },
    'dom/svDetLamp/st':   v => { updateItem('svdet', v); updateHomeCardGlow(); },
    'dom/svDetLamp/dim':  v => setVal('r_det_dim', v),
    'dom/svDetLamp/noc':  v => {
        states.detnoc = +v;
        if (DOM['m_det_day'])   DOM['m_det_day'].className   = (states.detnoc == 0 ? 'active' : '');
        if (DOM['m_det_night']) DOM['m_det_night'].className = (states.detnoc == 1 ? 'active' : '');
        updateItem('svdet', states.svdet);
    },
    'dom/svDetNoch/st':   v => updateItem('svdet_rgb', v),
    'dom/svDetNoch/br':   v => setVal('r_det_br', v),
    'dom/svDetNoch/rgb':  v => {
        const colorVal = v.toLowerCase();
        setCssVar('--det-rgb', colorMap[colorVal] || 'rgba(88, 166, 255, 0.6)');
        setVal('cp_det_rgb', colorVal);
        updateItem('svdet_rgb', states.svdet_rgb);
    },
    'dom/tempZal_kit': v => { setText('t_kit', v); setText('t_kit_ov', v); },
    'dom/vlagZal_kit': v => { setText('h_kit', v); setText('h_kit_ov', v); },
    'dom/tempChay':    v => { setText('t_chay', v); setText('t_chay_ov', v); },
    'dom/statChay':    v => { states.chay_stat = +v; updateChayDisplay(); },
    'dom/svKuh1':      v => { states.kit_light = +v; updateButtonState('sw_kit_light', +v); updateKitchenGlow(); updateHomeCardGlow(); },
    'dom/svKuh2':      v => { states.kit_sub   = +v; updateButtonState('sw_kit_sub',   +v); updateKitchenGlow(); updateHomeCardGlow(); },
    'dom/svKuh3':      v => { states.kit_night = +v; updateButtonState('sw_kit_night', +v); updateHomeCardGlow(); },
    'dom/Vityjka':     v => { states.kit_fan = +v; updateButtonState('sw_kit_fan', +v); },
    'dom/Vityjka1':    v => { states.kit_fan_speed = +v; updateFanSpeedButtons(v); },
    'dom/oknoKuhny':   v => { updateWindowStatus('window-status-text-kit', v, 't_kit'); updateSecuritySensor('sensor_kitchen_window', v); },
    'dom/dverKuhny':   v => { updateDoorStatus('door-status-text-kit', v, 't_kit'); updateSecuritySensor('sensor_kitchen_door', v); },
    'dom/vod/temp':  v => { setText('t_vod', v); setText('t_vod_ov', v); states.water_temp = parseFloat(v); },
    'dom/vod/zad':   v => { setText('t_vod_zad', v); setText('t_vod_zad_ov', v); states.water_zad = parseFloat(v); },
    'dom/vod/regim': v => { states.water_mode = +v; updateWaterModeButtons(v); },
    'dom/vod/stat':  v => { states.water_stat = +v; updateWaterStatDisplay(); },
    'dom/svVan':          v => { states.bath_light  = +v; updateButtonState('sw_bath_light',  +v); updateBathroomGlow(); updateHomeCardGlow(); },
    'dom/svVanZerkalo':   v => { states.bath_mirror = +v; updateButtonState('sw_bath_mirror', +v); },
    'dom/svVanDush':      v => { states.bath_dush   = +v; updateButtonState('sw_bath_dush',   +v); updateBathroomGlow(); },
    'dom/svVanVent':      v => { states.bath_vent   = +v; updateButtonState('sw_bath_vent',   +v); },
    'dom/kotD': v => setText('kot_pressure', v),
    'dom/mojnost':          v => { setText('power_watts', v);    setText('power_watts_ov', v); },
    'dom/napr':             v => { setText('voltage_volts', v);  setText('voltage_volts_ov', v); },
    'dom/tok':              v => { setText('current_amps', v);   setText('current_amps_ov', v); },
    'dom/mojnost/kot':      v => setText('power_boiler', v),
    'dom/mojnost/vodogrey': v => setText('power_water_heater', v),
    'dom/oknoDetskay': v => { updateWindowStatus('window-status-text-det', v, 't_det'); updateSecuritySensor('sensor_kids_window', v); },
    'dom/ohrana':      v => { states.security_mode = +v; updateSecurityDisplay(); },
    'home/opi4pro/cpu/temp':           v => updateServerTemp(v),
    'home/opi4pro/cpu/load_pct':       v => updateServerBar('srv_cpu',  'srv_cpu_bar',  v, '#58a6ff'),
    'home/opi4pro/ram/usage_pct':      v => { updateServerBar('srv_ram', 'srv_ram_bar', v, '#a5d6ff'); const el = DOM['srv_ram']||document.getElementById('srv_ram'); if(el) el.innerText = Math.round(v)+'%'; },
    'home/opi4pro/ram/used_gb':        v => setText('srv_ram_used',  parseFloat(v).toFixed(1)),
    'home/opi4pro/ram/total_gb':       v => setText('srv_ram_total', parseFloat(v).toFixed(1)),
    'home/opi4pro/disk/root/percent':  v => { updateServerBar('srv_disk', 'srv_disk_bar', v, '#e3b341'); const el = DOM['srv_disk']||document.getElementById('srv_disk'); if(el) el.innerText = Math.round(v)+'%'; },
    'home/opi4pro/disk/root/used_gb':  v => setText('srv_disk_used',  parseFloat(v).toFixed(0)),
    'home/opi4pro/disk/root/total_gb': v => setText('srv_disk_total', parseFloat(v).toFixed(0)),
    
    // Датчики движения
    'dom/dvijKuh':       v => updateMotionSensor('dom/dvijKuh', v),
    'dom/dvijUlica':     v => updateMotionSensor('dom/dvijUlica', v),
    'dom/dvijZal':       v => updateMotionSensor('dom/dvijZal', v),
    'dom/dvijKuh/time':  v => updateMotionTime('dom/dvijKuh/time', v),
    'dom/dvijUlica/time': v => updateMotionTime('dom/dvijUlica/time', v),
    'dom/dvijZal/time':  v => updateMotionTime('dom/dvijZal/time', v),
};

// =====================================================================
// ОБРАБОТЧИК MQTT с логгированием
// =====================================================================
const originalOnMessageArrived = mqtt.onMessageArrived;
mqtt.onMessageArrived = (m) => {
    mqttRxCount++;
    lastMessageTime = Date.now();
    addControlLog(`📩 ${m.destinationName} = ${m.payloadString.substring(0, 40)}`);
    const handler = topicRouter[m.destinationName];
    if (handler) handler(m.payloadString);
    updateControlPanel();
};

mqtt.onConnectionLost = (resp) => {
    isConnected = false;
    addControlLog(`⚠️ MQTT соединение потеряно (код: ${resp.errorCode})`);
    updateControlPanel();
    if (resp.errorCode !== 0) setTimeout(connect, 5000);
};

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !isConnected) connect();
});

// =====================================================================
// ПОДКЛЮЧЕНИЕ MQTT
// =====================================================================
function connect() {
    mqtt.connect({
        userName: cfg.u, password: cfg.w, useSSL: true, keepAliveInterval: 60,
        onSuccess: () => { 
            isConnected = true; 
            addControlLog('✅ MQTT подключён');
            mqtt.subscribe('heater/#'); 
            mqtt.subscribe('dom/#'); 
            mqtt.subscribe('home/opi4pro/#');
            flushMessageQueue();
            updateControlPanel();
        },
        onFailure: () => {
            addControlLog('❌ Ошибка подключения MQTT, повтор через 5 сек');
            setTimeout(connect, 5000);
        }
    });
}

// =====================================================================
// ОТПРАВКА СООБЩЕНИЯ с очередью
// =====================================================================
function sendOriginal(topic, value) {
    if (!isConnected) return;
    const msg = new Paho.MQTT.Message(String(value));
    msg.destinationName = topic;
    msg.retained = true;
    mqtt.send(msg);
}

function send(topic, value) {
    if (!isConnected) {
        messageQueue.push({ topic, value, ts: Date.now() });
        addControlLog(`⚠️ В очередь (offline): ${topic} = ${value}`);
        updateControlPanel();
        return;
    }
    mqttTxCount++;
    addControlLog(`📤 ${topic} = ${value}`);
    sendOriginal(topic, value);
    updateControlPanel();
}

// =====================================================================
// НАВИГАЦИЯ ЭКРАНОВ
// =====================================================================
function _showPanel(panelId) {
    ['rooms-screen', 'tech-screen'].forEach(id => {
        const el = DOM[id];
        if (!el) return;
        if (id !== panelId && el.style.display !== 'none') {
            el.classList.remove('panel-active');
            setTimeout(() => { el.style.display = 'none'; }, 450);
        }
    });
    const panel = DOM[panelId];
    if (!panel) return;
    panel.style.display = 'flex';
    setTimeout(() => panel.classList.add('panel-active'), 10);
}

function showRoomsScreen() { _showPanel('rooms-screen'); }
function showTechScreen()  { _showPanel('tech-screen');  }
function showMainScreen() {
    ['rooms-screen', 'tech-screen'].forEach(id => {
        const el = DOM[id];
        if (!el || el.style.display === 'none') return;
        el.classList.remove('panel-active');
        setTimeout(() => { el.style.display = 'none'; }, 450);
    });
}

// =====================================================================
// ОВЕРЛЕИ
// =====================================================================
function openOverlay(id) {
    DOM['app-content'].classList.add('blurred');
    const ov = document.getElementById(id);
    ov.style.display = 'flex';
    setTimeout(() => ov.classList.add('active'), 10);
}
function closeOverlay() {
    DOM['app-content'].classList.remove('blurred');
    document.querySelectorAll('.overlay').forEach(ov => {
        ov.classList.remove('active');
        setTimeout(() => ov.style.display = 'none', 500);
    });
}

// =====================================================================
// СВАЙП
// =====================================================================
let touchStartX = 0;
function handleTouchStart(e) { touchStartX = e.changedTouches[0].screenX; }
function handleTouchEnd(e) {
    if (touchStartX - e.changedTouches[0].screenX > 50) showTechScreen();
}

// =====================================================================
// ОБНОВЛЕНИЕ UI
// =====================================================================

function updateButtonState(id, state) {
    const el = DOM[id] || document.getElementById(id);
    if (!el) return;
    el.classList.toggle('is-on', !!state);
}

function setCardGlow(cardId, cssVarBottom, cssVarTop, onBottom, onTop, borderBottom, borderTop) {
    const card = DOM[cardId];
    if (!card) return;
    setCssVar(cssVarBottom, onBottom ? 'inset 0 -60px 100px -20px rgba(88,166,255,0.5),inset 40px 0 70px -30px rgba(88,166,255,0.3),inset -40px 0 70px -30px rgba(88,166,255,0.3)' : 'inset 0 0 0 transparent');
    card.style.borderBottom = onBottom ? (borderBottom || '1px solid rgba(88,166,255,0.4)') : '1px solid transparent';
    if (cssVarTop !== null) {
        setCssVar(cssVarTop, onTop ? 'inset 0 70px 110px -30px rgba(88,166,255,0.6)' : 'inset 0 0 0 transparent');
        card.style.borderTop = onTop ? (borderTop || '1px solid rgba(88,166,255,0.7)') : '1px solid transparent';
    }
}

function updateStreetGlow() {
    const anyLightOn = states.street_light || states.street_bbq || states.street_garland || states.street_lanterns;
    setCardGlow('card-street', '--street-glow-bottom', '--street-glow-top', anyLightOn, false);
}
function updateKitchenGlow() {
    setCardGlow('card-kitchen', '--kit-glow-bottom', '--kit-glow-top', states.kit_light, states.kit_sub);
}
function updateBathroomGlow() {
    setCardGlow('card-bathroom', '--bath-glow-bottom', '--bath-glow-top', states.bath_light, states.bath_dush);
}
function updateHomeCardGlow() {
    const anyOn = states.sv1 || states.sv2 || states.svbed || states.svdet || states.kit_light || states.bath_light;
    setCardGlow('card-home', '--home-glow-bottom', null, anyOn, false);
}

function updateItem(key, val) {
    states[key] = parseInt(val);
    const btnId = (key === 'svbed_rgb') ? 'sw_svbed_rgb' : (key === 'svdet_rgb') ? 'sw_svdet_rgb' : 'sw_' + key;
    updateButtonState(btnId, states[key]);

    const badge = document.getElementById('st_' + key + '_dash');
    if (badge) badge.className = states[key] ? 'badge active' : 'badge';

    if (key === 'sv1' || key === 'sv2') {
        const hallCard = DOM['card-hall'];
        if (hallCard) {
            hallCard.classList.toggle('glow-main', !!states.sv1);
            hallCard.classList.toggle('glow-extra', !!states.sv2);
        }
    }

    if (key === 'svbed' || key === 'bednoc') {
        const bedCard = DOM['card-bedroom'];
        if (bedCard && states.svbed) {
            const nightColor = 'rgba(255,180,50,0.4)';
            const dayColor   = 'rgba(88,166,255,0.5)';
            const isNight    = states.bednoc === 1;
            const shadow = isNight
                ? `inset 0 -60px 100px -20px ${nightColor},inset 40px 0 70px -30px rgba(255,180,50,0.2),inset -40px 0 70px -30px rgba(255,180,50,0.2)`
                : `inset 0 -60px 100px -20px ${dayColor},inset 40px 0 70px -30px rgba(88,166,255,0.3),inset -40px 0 70px -30px rgba(88,166,255,0.3)`;
            setCssVar('--bed-glow-bottom', shadow);
            bedCard.style.borderBottom = isNight ? `1px solid ${nightColor}` : '1px solid rgba(88,166,255,0.4)';
        } else if (bedCard) {
            setCssVar('--bed-glow-bottom', 'inset 0 0 0 transparent');
            bedCard.style.borderBottom = '1px solid transparent';
        }
    }
    if (key === 'svbed_rgb') {
        const bedCard = DOM['card-bedroom'];
        if (bedCard && states.svbed_rgb) {
            const rgb = getComputedStyle(document.documentElement).getPropertyValue('--bed-rgb');
            setCssVar('--bed-glow-top', `inset 0 70px 110px -30px ${rgb}`);
            bedCard.style.borderTop = `1px solid ${rgb}`;
        } else if (bedCard) {
            setCssVar('--bed-glow-top', 'inset 0 0 0 transparent');
            bedCard.style.borderTop = '1px solid transparent';
        }
    }

    if (key === 'svdet' || key === 'detnoc') {
        const detCard = DOM['card-children'];
        if (detCard && states.svdet) {
            const isNight = states.detnoc === 1;
            const shadow = isNight
                ? 'inset 0 -60px 100px -20px rgba(255,180,50,0.4),inset 40px 0 70px -30px rgba(255,180,50,0.2),inset -40px 0 70px -30px rgba(255,180,50,0.2)'
                : 'inset 0 -60px 100px -20px rgba(88,166,255,0.5),inset 40px 0 70px -30px rgba(88,166,255,0.3),inset -40px 0 70px -30px rgba(88,166,255,0.3)';
            setCssVar('--det-glow-bottom', shadow);
            detCard.style.borderBottom = isNight ? '1px solid rgba(255,180,50,0.4)' : '1px solid rgba(88,166,255,0.4)';
        } else if (detCard) {
            setCssVar('--det-glow-bottom', 'inset 0 0 0 transparent');
            detCard.style.borderBottom = '1px solid transparent';
        }
    }
    if (key === 'svdet_rgb') {
        const detCard = DOM['card-children'];
        if (detCard && states.svdet_rgb) {
            const rgb = getComputedStyle(document.documentElement).getPropertyValue('--det-rgb');
            setCssVar('--det-glow-top', `inset 0 70px 110px -30px ${rgb}`);
            detCard.style.borderTop = `1px solid ${rgb}`;
        } else if (detCard) {
            setCssVar('--det-glow-top', 'inset 0 0 0 transparent');
            detCard.style.borderTop = '1px solid transparent';
        }
    }
}

// =====================================================================
// КОТЕЛ
// =====================================================================
function setBoilerMode(mode) {
    send('heater/mode/set', mode);
    updateBoilerModeDisplay(mode);
}

function updateBoilerMode(m) {
    states.mode = m;
    updateBoilerModeDisplay(m);
    ['auto', 'manual', 'off'].forEach(x => {
        const el = DOM['badge_' + x];
        if (el) el.style.display = (m === x ? 'block' : 'none');
    });
}

function updateBoilerModeDisplay(mode) {
    ['boiler-auto-block', 'boiler-manual-block', 'boiler-off-block'].forEach(id => {
        if (DOM[id]) DOM[id].style.display = 'none';
    });
    ['m_auto', 'm_manual', 'm_off'].forEach(id => {
        if (DOM[id]) { DOM[id].style.background = '#30363d'; DOM[id].style.color = '#c9d1d9'; }
    });
    const map = { auto: ['boiler-auto-block', 'm_auto'], manual: ['boiler-manual-block', 'm_manual'], off: ['boiler-off-block', 'm_off'] };
    if (map[mode]) {
        const [blockId, btnId] = map[mode];
        if (DOM[blockId]) DOM[blockId].style.display = 'block';
        if (DOM[btnId]) { DOM[btnId].style.background = '#58a6ff'; DOM[btnId].style.color = '#fff'; }
    }
}

// =====================================================================
// ВОДА
// =====================================================================
function setWaterMode(mode) {
    send('dom/vod/regim', mode);
    updateWaterModeButtons(mode);
}

function updateWaterModeButtons(mode) {
    ['mode_turbo', 'mode_normal', 'mode_eco', 'mode_min'].forEach(id => {
        if (DOM[id]) { DOM[id].style.background = '#30363d'; DOM[id].style.color = '#c9d1d9'; }
    });
    const ids = ['mode_turbo', 'mode_normal', 'mode_eco', 'mode_min'];
    const idx = parseInt(mode) - 1;
    if (ids[idx] && DOM[ids[idx]]) { DOM[ids[idx]].style.background = '#58a6ff'; DOM[ids[idx]].style.color = '#fff'; }
}

function updateWaterStatDisplay() {
    const btn = DOM['sw_water_stat'];
    const on = !!states.water_stat;
    if (btn) {
        btn.innerText = on ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО';
        btn.classList.toggle('water-on', on);
        btn.classList.toggle('water-off', !on);
    }
    DOM['bath-temp-container']?.classList.toggle('sensor-dim', !on);
    DOM['bath-temp-container']?.classList.toggle('sensor-clear', on);
    DOM['bath-zad-container']?.classList.toggle('sensor-dim', !on);
    DOM['bath-zad-container']?.classList.toggle('sensor-clear', on);
}

// =====================================================================
// ЧАЙНИК
// =====================================================================
function updateChayDisplay() {
    const on = !!states.chay_stat;
    const btn = document.getElementById('sw_chay_stat');
    if (btn) {
        btn.innerText      = on ? 'ВКЛЮЧЁН'    : 'ВЫКЛЮЧЕН';
        btn.style.background  = on ? 'var(--off)' : '#30363d';
        btn.style.borderColor = on ? 'var(--off)' : 'var(--border)';
        btn.style.color       = on ? '#fff'        : '#c9d1d9';
        btn.style.boxShadow   = on ? '0 0 15px rgba(218,54,51,0.5)' : 'none';
    }
    const cardIcon = document.getElementById('chay_icon_card');
    if (cardIcon) {
        cardIcon.style.filter = on ? 'drop-shadow(0 0 8px rgba(218,54,51,0.9))' : 'none';
        cardIcon.classList.toggle('chay-on', on);
    }
    const ovIcon = document.getElementById('chay_icon_ov');
    if (ovIcon) {
        ovIcon.style.filter = on ? 'drop-shadow(0 0 8px rgba(218,54,51,0.9))' : 'none';
        ovIcon.classList.toggle('chay-on', on);
    }
    const setChayColor = (svg, color) => {
        if (!svg) return;
        svg.querySelectorAll('path, rect').forEach(el => {
            if (el.getAttribute('stroke') && el.getAttribute('stroke') !== 'none')
                el.style.stroke = color;
            if (el.getAttribute('fill') && el.getAttribute('fill') !== 'none' && el.getAttribute('fill') !== 'rgba(88,166,255,0)')
                el.style.fill = on ? 'rgba(218,54,51,0.08)' : '';
        });
    };
    setChayColor(cardIcon, on ? '#da3633' : '#58a6ff');
    setChayColor(ovIcon,   on ? '#da3633' : '#58a6ff');
}

// =====================================================================
// КАМЕРА
// =====================================================================
function openCameraOverlay() {
    const ov     = document.getElementById('camera-overlay');
    const iframe = document.getElementById('camera_iframe');
    if (iframe) iframe.src = 'http://192.168.1.74:5000/review';
    if (ov) ov.style.display = 'flex';
}
function closeCameraOverlay() {
    const ov     = document.getElementById('camera-overlay');
    const iframe = document.getElementById('camera_iframe');
    if (iframe) iframe.src = '';
    if (ov) ov.style.display = 'none';
}

function openWebApp(url) {
    closeOverlay();
    window.open(url, '_blank');
}

// =====================================================================
// ГРАФИКИ ТЕМПЕРАТУР
// =====================================================================
const HA_URL    = 'http://192.168.1.90:8123';
const HA_TOKEN  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI5ZjE1MDRkMDM1YWU0NTgwYTcxMzFkNmIwZGRhYmJhMyIsImlhdCI6MTc3NDQ1MjMwNywiZXhwIjoyMDg5ODEyMzA3fQ.3M7k5Q-MS65PFTQxRWWf4ThGwEwRQ9tC6cb5UFc0qdg';

const CHART_CFG = {
    street: {
        entity:      'sensor.temperature_158d00052dc128',
        canvasId:    'streetTempChart',
        loadingId:   'chart_loading',
        errorId:     'chart_error',
        lastValId:   'chart_last_val',
        overlayId:   'chart-overlay',
        color:       '#58a6ff',
        colorBg:     'rgba(88,166,255,0.08)',
        maxHours:    168,
        defaultHours:6,
    },
    boiler: {
        entity:      'sensor.kontroller_kotla_temperatura_kotla',
        canvasId:    'boilerTempChart',
        loadingId:   'boiler_chart_loading',
        errorId:     'boiler_chart_error',
        lastValId:   'boiler_chart_last_val',
        overlayId:   'boiler-chart-overlay',
        color:       '#e3b341',
        colorBg:     'rgba(227,179,65,0.08)',
        maxHours:    168,
        defaultHours:6,
    }
};

const CHART_MIN_VIEW = 10;

const chartState = {
    street: { chart: null, allTs: [], allVals: [], viewStart: 0, viewSize: 0,
              loadedFrom: null, loadedTo: null, loading: false, currentHours: 6 },
    boiler: { chart: null, allTs: [], allVals: [], viewStart: 0, viewSize: 0,
              loadedFrom: null, loadedTo: null, loading: false, currentHours: 6 }
};
let _activeTouchKey = null;
let _touchState     = null;

function openChartOverlay() {
    _openChart('street');
}
function openBoilerChartOverlay() {
    _openChart('boiler');
}
function _openChart(key) {
    const cfg = CHART_CFG[key];
    const ov  = document.getElementById(cfg.overlayId);
    if (!ov) return;
    ov.style.display = 'flex';
    setTimeout(() => ov.classList.add('active'), 10);
    chartSetPeriod(key, cfg.defaultHours,
        ov.querySelector('.chart-period-active') ||
        ov.querySelectorAll('.chart-period-btn')[2]);
}

function closeChartOverlay(key) {
    const cfg = CHART_CFG[key];
    const ov  = document.getElementById(cfg.overlayId);
    if (!ov) return;
    ov.classList.remove('active');
    setTimeout(() => { ov.style.display = 'none'; }, 500);
    const s = chartState[key];
    if (s.chart) { s.chart.destroy(); s.chart = null; }
    _chartDetachTouch(key);
    s.allTs = []; s.allVals = [];
    s.loadedFrom = null; s.loadedTo = null;
}

function chartSetPeriod(key, hours, btn) {
    const ov = document.getElementById(CHART_CFG[key].overlayId);
    ov.querySelectorAll('.chart-period-btn').forEach(b => b.classList.remove('chart-period-active'));
    if (btn) btn.classList.add('chart-period-active');
    chartState[key].currentHours = hours;
    const s = chartState[key];
    s.allTs = []; s.allVals = [];
    s.loadedFrom = null; s.loadedTo = null;
    _chartLoad(key, Date.now() - hours * 3600000, Date.now(), true);
}

async function _chartLoad(key, fromMs, toMs, resetView) {
    const cfg = CHART_CFG[key];
    const s   = chartState[key];
    if (s.loading) return;
    s.loading = true;

    const loadEl = document.getElementById(cfg.loadingId);
    const errEl  = document.getElementById(cfg.errorId);
    if (loadEl) loadEl.style.display = 'block';
    if (errEl)  errEl.style.display  = 'none';

    const startISO = new Date(fromMs).toISOString();
    const endISO   = new Date(toMs).toISOString();

    try {
        const resp = await fetch(
            `${HA_URL}/api/history/period/${startISO}?end_time=${endISO}&filter_entity_id=${cfg.entity}&minimal_response=true`,
            { headers: { 'Authorization': `Bearer ${HA_TOKEN}`, 'Content-Type': 'application/json' } }
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data    = await resp.json();
        const history = data[0];
        if (!history || history.length === 0) throw new Error('Нет данных');

        const newTs   = history.map(e => new Date(e.last_changed).getTime());
        const newVals = history.map(e => { const v = parseFloat(e.state); return isNaN(v) ? null : v; });

        if (resetView || s.allTs.length === 0) {
            s.allTs   = newTs;
            s.allVals = newVals;
            s.loadedFrom = fromMs;
            s.loadedTo   = toMs;
            s.viewStart  = 0;
            s.viewSize   = s.allTs.length;
        } else {
            if (fromMs < s.loadedFrom) {
                const cutIdx = newTs.findIndex(t => t >= s.loadedFrom);
                const prependTs   = cutIdx > 0 ? newTs.slice(0, cutIdx)   : newTs;
                const prependVals = cutIdx > 0 ? newVals.slice(0, cutIdx) : newVals;
                const prevLen = s.allTs.length;
                s.allTs   = [...prependTs,   ...s.allTs];
                s.allVals = [...prependVals, ...s.allVals];
                s.loadedFrom  = fromMs;
                s.viewStart += (s.allTs.length - prevLen);
            }
        }

        const lastVal = [...s.allVals].reverse().find(v => v !== null);
        const lastEl  = document.getElementById(cfg.lastValId);
        if (lastEl && lastVal !== undefined) lastEl.innerText = lastVal.toFixed(1) + '°C';

        _chartRender(key);
        if (resetView) _chartAttachTouch(key);

    } catch (err) {
        console.error(`Chart [${key}] error:`, err);
        if (errEl) { errEl.style.display = 'block'; errEl.innerText = 'Ошибка загрузки\n' + err.message; }
    } finally {
        s.loading = false;
        if (loadEl) loadEl.style.display = 'none';
    }
}

function _chartCheckLazyLoad(key) {
    const s   = chartState[key];
    const cfg = CHART_CFG[key];
    if (s.loading || !s.loadedFrom) return;

    const EDGE = Math.max(10, Math.round(s.viewSize * 0.15));

    if (s.viewStart <= EDGE) {
        const canGoBack = s.loadedFrom > Date.now() - cfg.maxHours * 3600000;
        if (canGoBack) {
            const chunkMs = s.currentHours * 3600000;
            const newFrom = Math.max(s.loadedFrom - chunkMs, Date.now() - cfg.maxHours * 3600000);
            if (newFrom < s.loadedFrom) {
                _chartLoad(key, newFrom, s.loadedFrom, false);
            }
        }
    }
}

function _chartRender(key) {
    const cfg = CHART_CFG[key];
    const s   = chartState[key];
    const ctx = document.getElementById(cfg.canvasId);
    if (!ctx) return;

    const end    = Math.min(s.viewStart + s.viewSize, s.allTs.length);
    const tsSlice = s.allTs.slice(s.viewStart, end);
    const labels  = tsSlice.map(ts => {
        const d = new Date(ts);
        return d.getDate() !== new Date(s.allTs[s.allTs.length - 1]).getDate()
            ? `${d.getDate()}.${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`
            : `${d.getHours()}:${d.getMinutes().toString().padStart(2,'0')}`;
    });
    const values  = s.allVals.slice(s.viewStart, end);

    if (s.chart) { s.chart.destroy(); s.chart = null; }

    s.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: values,
                borderColor: cfg.color,
                backgroundColor: cfg.colorBg,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: labels.length > 80 ? 0 : 2,
                spanGaps: true,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 120 },
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: '#21262d' }, ticks: { color: '#8b949e', font: { size: 11 } } },
                x: { grid: { display: false },
                     ticks: { color: '#8b949e', maxRotation: 0, autoSkip: true, maxTicksLimit: 6, font: { size: 10 } } }
            }
        }
    });
}

function _chartAttachTouch(key) {
    _chartDetachTouch(key);
    const canvas = document.getElementById(CHART_CFG[key].canvasId);
    if (!canvas) return;
    _activeTouchKey = key;
    canvas.addEventListener('touchstart', _onTouchStart, { passive: false });
    canvas.addEventListener('touchmove',  _onTouchMove,  { passive: false });
    canvas.addEventListener('touchend',   _onTouchEnd,   { passive: false });
}
function _chartDetachTouch(key) {
    const id = key ? CHART_CFG[key]?.canvasId : null;
    ['streetTempChart','boilerTempChart'].forEach(cid => {
        if (!id || cid === id) {
            const c = document.getElementById(cid);
            if (c) {
                c.removeEventListener('touchstart', _onTouchStart);
                c.removeEventListener('touchmove',  _onTouchMove);
                c.removeEventListener('touchend',   _onTouchEnd);
            }
        }
    });
    if (!id) _activeTouchKey = null;
    _touchState = null;
}

function _getTouchDist(t) {
    const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx*dx + dy*dy);
}

function _onTouchStart(e) {
    e.preventDefault();
    const key = _activeTouchKey;
    if (!key) return;
    const s = chartState[key];
    if (e.touches.length === 1) {
        _touchState = { mode: 'pan', startX: e.touches[0].clientX, startView: s.viewStart };
    } else if (e.touches.length === 2) {
        _touchState = {
            mode: 'zoom', startDist: _getTouchDist(e.touches),
            startSize: s.viewSize,
            startX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
            startView: s.viewStart
        };
    }
}

function _onTouchMove(e) {
    e.preventDefault();
    const key = _activeTouchKey;
    if (!key || !_touchState) return;
    const s     = chartState[key];
    const total = s.allTs.length;

    if (_touchState.mode === 'pan' && e.touches.length === 1) {
        const canvas  = e.target;
        const pxPerPt = canvas.offsetWidth / s.viewSize;
        const dIdx    = Math.round(-(e.touches[0].clientX - _touchState.startX) / pxPerPt);
        let newStart  = Math.max(0, Math.min(_touchState.startView + dIdx, total - s.viewSize));
        if (newStart !== s.viewStart) {
            s.viewStart = newStart;
            _chartRender(key);
            _chartCheckLazyLoad(key);
        }
    } else if (_touchState.mode === 'zoom' && e.touches.length === 2) {
        const ratio   = _touchState.startDist / _getTouchDist(e.touches);
        let newSize   = Math.round(_touchState.startSize * ratio);
        newSize       = Math.max(CHART_MIN_VIEW, Math.min(newSize, total));
        const canvas  = e.target;
        const midX    = (_touchState.startX - canvas.getBoundingClientRect().left) / canvas.offsetWidth;
        const midIdx  = Math.round(_touchState.startView + midX * _touchState.startSize);
        let newStart  = Math.max(0, Math.min(Math.round(midIdx - midX * newSize), total - newSize));
        if (newSize !== s.viewSize || newStart !== s.viewStart) {
            s.viewSize  = newSize;
            s.viewStart = newStart;
            _chartRender(key);
            _chartCheckLazyLoad(key);
        }
    }
}

function _onTouchEnd(e) {
    e.preventDefault();
    if (e.touches.length === 0) _touchState = null;
    else if (e.touches.length === 1 && _touchState?.mode === 'zoom') {
        const key = _activeTouchKey;
        if (key) _touchState = { mode: 'pan', startX: e.touches[0].clientX, startView: chartState[key].viewStart };
    }
}

function setFanSpeed(speed) {
    send('dom/Vityjka1', speed);
    updateFanSpeedButtons(speed);
}

function updateFanSpeedButtons(speed) {
    ['fan_speed_1', 'fan_speed_2'].forEach((id, i) => {
        const on = (parseInt(speed) === i + 1);
        if (DOM[id]) { DOM[id].style.background = on ? '#58a6ff' : '#30363d'; DOM[id].style.color = on ? '#fff' : '#c9d1d9'; }
    });
}

function setHallFanSpeed(speed) {
    send('dom/Pritok1', speed);
    updateHallFanSpeedButtons(speed);
}

function updateHallFanSpeedButtons(speed) {
    ['hall_speed_1', 'hall_speed_2'].forEach((id, i) => {
        const on = (parseInt(speed) === i + 1);
        if (DOM[id]) { DOM[id].style.background = on ? '#58a6ff' : '#30363d'; DOM[id].style.color = on ? '#fff' : '#c9d1d9'; }
    });
}

function changeDetTargetTemp(delta) {
    let newTemp = Math.min(30, Math.max(15, parseFloat(states.det_zad) + delta));
    send('dom/tempMotzad', newTemp.toFixed(1));
    states.det_zad = newTemp;
    setText('l_det_zad', newTemp.toFixed(1));
}

function updateCurtainVisual(val) {
    const move = (100 - parseInt(val)) * 0.9;
    if (DOM['curt-l']) DOM['curt-l'].style.transform = `translateX(-${move}%)`;
    if (DOM['curt-r']) DOM['curt-r'].style.transform = `translateX(${move}%)`;
}

function updateWindowStatus(textId, val, tempId) {
    const statusTxt = document.getElementById(textId);
    const open = val == '1';
    if (statusTxt) { statusTxt.innerText = open ? 'ОКНО ОТКРЫТО' : 'ОКНО ЗАКРЫТО'; statusTxt.style.color = open ? 'var(--accent)' : 'var(--text)'; }
    DOM[tempId]?.classList.toggle('temp-pulse', open);
    const ov = document.getElementById(tempId + '_ov');
    if (ov) ov.classList.toggle('temp-pulse', open);
}

function updateDoorStatus(textId, val, tempId) {
    const statusTxt = document.getElementById(textId);
    const open = val == '1';
    if (statusTxt) { statusTxt.innerText = open ? 'ДВЕРИ ОТКРЫТЫ' : 'ДВЕРИ ЗАКРЫТЫ'; statusTxt.style.color = open ? 'var(--accent)' : 'var(--text)'; }
    DOM[tempId]?.classList.toggle('temp-pulse', open);
    const ov = document.getElementById(tempId + '_ov');
    if (ov) ov.classList.toggle('temp-pulse', open);
}

const sensorBlockMap = {
    'sensor_hall_window':    'sensor_block_hall',
    'sensor_bed_window':     'sensor_block_bed',
    'sensor_kids_window':    'sensor_block_kids',
    'sensor_kitchen_window': 'sensor_block_kitchen_win',
    'sensor_kitchen_door':   'sensor_block_kitchen_door',
    'sensor_front_door':     'sensor_block_front',
};

function toggleSecurityMode() {
    const newMode = states.security_mode ? 0 : 1;
    states.security_mode = newMode;
    send('dom/ohrana', newMode);
    updateSecurityDisplay();
}

function updateSecurityDisplay() {
    const armed = !!states.security_mode;
    const shieldSvg = document.getElementById('card_shield_svg');
    if (shieldSvg) {
        const paths = shieldSvg.querySelectorAll('path');
        const color = armed ? '#238636' : '#58a6ff';
        const glow  = armed
            ? 'drop-shadow(0 0 20px rgba(35,134,54,0.8)) drop-shadow(0 0 40px rgba(35,134,54,0.4))'
            : 'drop-shadow(0 0 18px rgba(88,166,255,0.5))';
        paths.forEach(p => {
            p.style.stroke = color;
            if (p.getAttribute('fill') && p.getAttribute('fill') !== 'none') {
                p.style.fill = armed ? 'rgba(35,134,54,0.12)' : 'rgba(88,166,255,0.08)';
            }
        });
        const check = document.getElementById('shield_check');
        if (check) {
            check.style.stroke  = color;
            check.style.opacity = armed ? '1' : '0';
        }
        shieldSvg.style.filter = glow;
    }
    const btn = document.getElementById('sw_security');
    if (btn) {
        btn.innerText      = armed ? 'НА ОХРАНЕ' : 'СНЯТА С ОХРАНЫ';
        btn.style.background  = armed ? 'var(--on)'    : '#30363d';
        btn.style.borderColor = armed ? 'var(--on)'    : 'var(--border)';
        btn.style.color       = armed ? '#fff'          : '#c9d1d9';
        btn.style.boxShadow   = armed ? '0 0 15px rgba(35,134,54,0.5)' : 'none';
    }
}

function updateSecuritySensor(statusElemId, value) {
    const statusEl = document.getElementById(statusElemId);
    const open = parseInt(value) === 1;
    if (statusEl) {
        statusEl.innerText   = open ? 'ОТКРЫТО' : 'ЗАКРЫТО';
        statusEl.className   = 'sensor-status ' + (open ? 'open-st' : 'closed');
    }
    const blockId = sensorBlockMap[statusElemId];
    const block   = document.getElementById(blockId);
    if (block) block.classList.toggle('open', open);
}

function updateServerBar(valId, barId, value, color) {
    const pct = Math.min(100, Math.max(0, parseFloat(value) || 0));
    setText(valId, Math.round(pct));
    const bar = DOM[barId] || document.getElementById(barId);
    if (bar) {
        bar.style.width = pct + '%';
        if (pct > 85)      bar.style.background = 'var(--off)';
        else if (pct > 65) bar.style.background = '#e3b341';
        else               bar.style.background = color;
    }
}
function updateServerTemp(value) {
    const t = parseFloat(value) || 0;
    const el = DOM['srv_temp'] || document.getElementById('srv_temp');
    if (el) {
        el.innerText = Math.round(t);
        el.style.color = t > 80 ? 'var(--off)' : t > 60 ? '#e3b341' : 'var(--accent)';
    }
}

function updateHomeCardAverage() {
    const tHall = parseFloat(DOM['t_hall']?.innerText || 0);
    const tBed  = parseFloat(DOM['t_bed']?.innerText  || 0);
    const tDet  = parseFloat(DOM['t_det']?.innerText  || 0);
    setText('t_home', ((tHall + tBed + tDet) / 3).toFixed(1));
    const hHall = parseFloat(DOM['h_hall']?.innerText || 0);
    const hBed  = parseFloat(DOM['h_bed']?.innerText  || 0);
    const hDet  = parseFloat(DOM['h_det']?.innerText  || 0);
    setText('h_home', Math.round((hHall + hBed + hDet) / 3));
}

function updateClock() {
    const now = new Date();
    setText('clock-time', now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
    setText('clock-date', now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }));
}
setInterval(updateClock, 1000);

// ===== ФУНКЦИИ ЗАЩИТЫ ПАРОЛЕМ =====

function checkPassword() {
    const input = document.getElementById('password-input');
    const correctPassword = '1902';
    
    if (input.value === correctPassword) {
        const lockScreen = document.getElementById('lock-screen');
        const appContent = document.getElementById('app-content');
        
        // Плавное исчезновение экрана блокировки
        lockScreen.style.opacity = '0';
        lockScreen.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => {
            lockScreen.style.display = 'none';
            if (appContent) appContent.style.filter = 'blur(0px)';
        }, 300);
        
        input.value = '';
    } else {
        input.value = '';
        input.placeholder = '❌ НЕВЕРНО';
        setTimeout(() => {
            input.placeholder = '••••';
        }, 1500);
    }
}

// ===== ФУНКЦИИ ДАТЧИКОВ ДВИЖЕНИЯ =====

const motionSensors = {
    'dom/dvijKuh': { id: 'sensor_motion_kuh', iconId: 'sensor_motion_icon_kuh', timeId: 'dom/dvijKuh/time', state: 0, lastTime: '--' },
    'dom/dvijUlica': { id: 'sensor_motion_ulica', iconId: 'sensor_motion_icon_ulica', timeId: 'dom/dvijUlica/time', state: 0, lastTime: '--' },
    'dom/dvijZal': { id: 'sensor_motion_zal', iconId: 'sensor_motion_icon_zal', timeId: 'dom/dvijZal/time', state: 0, lastTime: '--' }
};

function updateMotionSensor(topic, value) {
    if (motionSensors[topic]) {
        motionSensors[topic].state = +value;
        updateMotionUI(topic);
    }
}

function formatMotionTime(timestamp) {
    // Принимаем Unix timestamp (секунды) — вычисляем сколько прошло
    const ts = parseInt(timestamp);
    if (!ts || ts <= 0) return '--';

    const nowSec = Math.floor(Date.now() / 1000);
    const elapsed = nowSec - ts;

    if (elapsed < 0) return '--';
    if (elapsed < 60) return elapsed + ' с назад';
    if (elapsed < 3600) {
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        return mins + ' мин' + (secs > 0 ? ' ' + secs + ' с' : '') + ' назад';
    }
    if (elapsed < 86400) {
        const hours = Math.floor(elapsed / 3600);
        const mins  = Math.floor((elapsed % 3600) / 60);
        return hours + ' ч' + (mins > 0 ? ' ' + mins + ' мин' : '') + ' назад';
    }
    const days = Math.floor(elapsed / 86400);
    return days + ' д назад';
}

function updateMotionTime(topic, timeStr) {
    if (topic.includes('/time')) {
        const baseTopic = topic.replace('/time', '');
        if (motionSensors[baseTopic]) {
            motionSensors[baseTopic].lastTime = timeStr;

            // Вычисляем прошедшее время в секундах для порога 2 минут
            const ts = parseInt(timeStr);
            let elapsedSeconds = 0;
            if (ts > 0) {
                elapsedSeconds = Math.floor(Date.now() / 1000) - ts;
            }

            updateMotionUI(baseTopic, elapsedSeconds > 0 ? elapsedSeconds : 0);
        }
    }
}

function updateMotionUI(topic, timeSeconds = 0) {
    const sensor = motionSensors[topic];
    if (!sensor) return;
    
    const element = document.getElementById(sensor.id);
    const iconElement = document.getElementById(sensor.iconId);
    if (!element) return;
    
    // Показываем время вместо НЕТ/ОБНАРУЖЕНО
    const displayTime = formatMotionTime(sensor.lastTime);
    element.textContent = displayTime;
    
    // Красная иконка если движение было < 2 минут назад (120 секунд)
    const isRecent = timeSeconds > 0 && timeSeconds < 120;
    
    if (iconElement) {
        if (isRecent) {
            iconElement.style.stroke = '#da3633'; // красный цвет как открытая дверь
            iconElement.style.color = '#da3633';
        } else {
            iconElement.style.stroke = 'currentColor';
            iconElement.style.color = 'currentColor';
        }
    }
    
    if (isRecent) {
        element.classList.add('open');
        element.classList.remove('closed');
    } else {
        element.classList.remove('open');
        element.classList.add('closed');
    }
}

let rainDrops = [];
let rainAnimationActive = false;

function createRaindrop() {
    const container = document.getElementById('card-street');
    if (!container) return;
    
    const drop = document.createElement('div');
    drop.style.position = 'absolute';
    drop.style.width = '2px';
    drop.style.height = '2px';
    drop.style.backgroundColor = '#58a6ff';
    drop.style.borderRadius = '50%';
    drop.style.top = '-5px';
    drop.style.left = Math.random() * 100 + '%';
    drop.style.opacity = '0.8';
    drop.style.boxShadow = '0 0 3px rgba(88, 166, 255, 0.8)';
    drop.style.pointerEvents = 'none';
    drop.style.zIndex = '10';
    
    container.appendChild(drop);
    
    const dropObj = {
        element: drop,
        x: parseFloat(drop.style.left),
        y: 0,
        vx: (Math.random() - 0.5) * 0.5,
        vy: Math.random() * 0.8 + 0.5
    };
    
    rainDrops.push(dropObj);
}

function updateRaindrops() {
    rainDrops = rainDrops.filter(drop => {
        drop.y += drop.vy;
        drop.x += drop.vx;
        drop.vx += (Math.random() - 0.5) * 0.1;
        
        drop.element.style.top = drop.y + 'px';
        drop.element.style.left = drop.x + '%';
        
        if (drop.y > 150) {
            drop.element.remove();
            return false;
        }
        return true;
    });
}

function animateRain() {
    if (!rainAnimationActive) return;
    if (Math.random() > 0.4) createRaindrop();
    updateRaindrops();
    requestAnimationFrame(animateRain);
}

function startRainAnimation() {
    if (rainAnimationActive) return;
    rainAnimationActive = true;
    for (let i = 0; i < 50; i++) createRaindrop();
    animateRain();
}

function stopRainAnimation() {
    rainAnimationActive = false;
    rainDrops.forEach(drop => drop.element.remove());
    rainDrops = [];
}

function handleWateringToggle() {
    const isWateringOn = states.watering_zone1 || states.watering_zone2;
    if (isWateringOn && !rainAnimationActive) {
        startRainAnimation();
    } else if (!isWateringOn && rainAnimationActive) {
        stopRainAnimation();
    }
}

// ===== ФУНКЦИИ ДЛЯ ПРОГНОЗА ПОГОДЫ =====

function getWeatherIcon(code, isDay) {
    const iconMap = {
        0: '☀️', // ясно
        1: '🌤️', 2: '⛅', 3: '☁️', // облачно
        45: '🌫️', 48: '🌫️', // туман
        51: '🌧️', 53: '🌧️', 55: '🌧️', // морось
        61: '🌧️', 63: '⛈️', 65: '⛈️', // дождь
        71: '❄️', 73: '❄️', 75: '❄️', 77: '❄️', // снег
        80: '🌧️', 81: '⛈️', 82: '⛈️', // ливни
        85: '❄️', 86: '❄️', // ливневый снег
        95: '⛈️', 96: '⛈️', 99: '⛈️' // гроза
    };
    return iconMap[code] || '🌡️';
}

function getWeatherDesc(code) {
    const descMap = {
        0: 'Ясно',
        1: 'Облачно', 2: 'Облачно', 3: 'Облачно',
        45: 'Туман', 48: 'Туман',
        51: 'Морось', 53: 'Морось', 55: 'Морось',
        61: 'Дождь', 63: 'Дождь', 65: 'Сильный дождь',
        71: 'Снег', 73: 'Снег', 75: 'Снег', 77: 'Снег',
        80: 'Ливни', 81: 'Ливни', 82: 'Сильный ливень',
        85: 'Ливневый снег', 86: 'Ливневый снег',
        95: 'Гроза', 96: 'Гроза с градом', 99: 'Гроза с градом'
    };
    return descMap[code] || 'Неизвестно';
}

async function openWeatherForecast() {
    const overlay = document.getElementById('weather-overlay');
    if (!overlay) return;
    
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);
    
    try {
        // Асбест координаты: 60.39°N 63.45°E
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=60.39&longitude=63.45&current=temperature_2m,weather_code,wind_speed_10m,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=Asia/Yekaterinburg&forecast_days=4');
        
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        
        // Текущая погода
        const current = data.current;
        
        const tempEl = document.getElementById('weather_temp');
        const iconEl = document.getElementById('weather_icon');
        const descEl = document.getElementById('weather_desc');
        const windEl = document.getElementById('weather_wind');
        const rainEl = document.getElementById('weather_rain');
        
        if (tempEl) tempEl.textContent = Math.round(current.temperature_2m);
        if (iconEl) iconEl.textContent = getWeatherIcon(current.weather_code, true);
        const desc = getWeatherDesc(current.weather_code);
        if (descEl) descEl.textContent = desc;
        if (windEl) windEl.textContent = (current.wind_speed_10m / 3.6).toFixed(1);
        if (rainEl) rainEl.textContent = Math.round(current.precipitation || 0);
        
        // Прогноз на 3 следующих дня (дни 1, 2, 3)
        const forecastEl = document.getElementById('weather_forecast');
        if (forecastEl) {
            forecastEl.innerHTML = '';
            
            // Показываем дни 1, 2, 3 (следующие три дня после сегодня)
            for (let i = 1; i <= 3; i++) {
                const dayDate = data.daily.time[i];
                const date = new Date(dayDate + 'T00:00:00');
                
                // День недели на русском
                const daysRu = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
                const dayName = daysRu[date.getDay()];
                const dayNum = date.getDate();
                
                const tempMax = Math.round(data.daily.temperature_2m_max[i]);
                const tempMin = Math.round(data.daily.temperature_2m_min[i]);
                const wind = (data.daily.wind_speed_10m_max[i] / 3.6).toFixed(1);
                const rain = Math.round(data.daily.precipitation_probability_max[i]);
                const icon = getWeatherIcon(data.daily.weather_code[i], true);
                const desc = getWeatherDesc(data.daily.weather_code[i]);
                
                const forecastDiv = document.createElement('div');
                forecastDiv.style.cssText = 'background: rgba(0,0,0,0.2); border-radius: 12px; padding: 12px; border: 1px solid var(--border); display: flex; gap: 12px; align-items: flex-start;';
                
                forecastDiv.innerHTML = `
                    <div style="font-size: 36px; line-height: 1; flex-shrink: 0;">${icon}</div>
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                            <div>
                                <div style="font-size: 11px; color: #8b949e; font-weight: bold; letter-spacing: 0.5px;">${dayName} ${dayNum}</div>
                                <div style="font-size: 12px; color: #c9d1d9; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500; margin-top: 2px;">${desc}</div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 24px; font-weight: bold; color: #58a6ff; line-height: 1;">${tempMax}°/${tempMin}°</div>
                            </div>
                        </div>
                        <div style="font-size: 11px; color: #c9d1d9; border-top: 1px solid rgba(0,0,0,0.3); padding-top: 6px; margin-top: 6px;">
                            Ветер: <span style="color: #a5d6ff; font-weight: bold;">${wind}</span> м/с | Осадки: <span style="color: #a5d6ff; font-weight: bold;">${rain}%</span>
                        </div>
                    </div>
                `;
                
                forecastEl.appendChild(forecastDiv);
            }
        }
    } catch (error) {
        console.error('Weather error:', error);
        const forecastEl = document.getElementById('weather_forecast');
        if (forecastEl) {
            forecastEl.innerHTML = '<div style="color:#da3633;text-align:center;padding:20px;font-size:12px;">Ошибка при загрузке прогноза</div>';
        }
    }
}

function closeWeatherForecast() {
    const overlay = document.getElementById('weather-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.style.display = 'none', 500);
    }
}

// Периодическая проверка полива
setInterval(() => {
    const isWateringOn = states.watering_zone1 || states.watering_zone2;
    if (isWateringOn && !rainAnimationActive) startRainAnimation();
    else if (!isWateringOn && rainAnimationActive) stopRainAnimation();
}, 500);

// Периодическое обновление панели контроля
setInterval(() => {
    updateControlPanel();
}, 2000);

// Периодическое обновление времени датчиков движения (раз в 30 секунд)
setInterval(() => {
    Object.keys(motionSensors).forEach(topic => {
        const sensor = motionSensors[topic];
        if (sensor.lastTime && sensor.lastTime !== '--') {
            const ts = parseInt(sensor.lastTime);
            if (ts > 0) {
                const elapsed = Math.floor(Date.now() / 1000) - ts;
                updateMotionUI(topic, elapsed > 0 ? elapsed : 0);
            }
        }
    });
}, 30000);

// ИНИЦИАЛИЗАЦИЯ
window.addEventListener('DOMContentLoaded', () => {
    initDOMCache();
    updateClock();
    connect();
    updateControlPanel();
    addControlLog(`🚀 Приложение запущено, версия ${VERSION}`);
    setText('ctrl_version', VERSION);
    setText('ctrl_host', `${cfg.h}:${cfg.p}`);

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(e => console.log('SW error', e));
        });
    }
});