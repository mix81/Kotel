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
        // Котел
        't_water','t_water_left','l_sp','l_sp_dash','l_sp_left','r_sp',
        'pwr_val','st_r2_dash','st_r3_dash','sw_r2','sw_r3',
        'badge_auto','badge_manual','badge_off',
        'boiler-auto-block','boiler-manual-block','boiler-off-block',
        'm_auto','m_manual','m_off',
        'l_rt','r_rt','l_kf','r_kf','i_kp','i_ki','i_kd','t_out_big',
        'kot_pressure',
        // Улица
        't_street','h_street','p_street','t_street_ov','h_street_ov','p_street_ov',
        'sw_street_light','sw_street_bbq','card-street',
        // Зал
        't_hall','h_hall','t_hall_ov','h_hall_ov',
        'l_shtora','r_shtora','curt-label-dash','curt-l','curt-r',
        'window-status-text','card-hall','sw_sv1','sw_sv2',
        'sw_hall_vent','hall_speed_1','hall_speed_2',
        // Спальня
        't_bed','h_bed','t_bed_ov','h_bed_ov',
        'window-status-text-bed','card-bedroom',
        'sw_svbed','m_bed_day','m_bed_night','r_bed_dim',
        'sw_svbed_rgb','cp_bed_rgb','r_bed_br',
        // Детская
        't_det','h_det','t_det_ov','h_det_ov',
        'window-status-text-det','card-children',
        'sw_svdet','m_det_day','m_det_night','r_det_dim',
        'sw_svdet_rgb','cp_det_rgb','r_det_br','l_det_zad',
        // Кухня
        't_kit','h_kit','t_kit_ov','h_kit_ov','t_chay','t_chay_ov',
        'window-status-text-kit','door-status-text-kit','card-kitchen',
        'sw_kit_light','sw_kit_sub','sw_kit_night',
        'sw_kit_fan','fan_speed_1','fan_speed_2',
        // Ванная
        't_vod','t_vod_ov','t_vod_zad','t_vod_zad_ov',
        'card-bathroom','sw_bath_light','sw_bath_mirror','sw_bath_dush','sw_bath_vent',
        'sw_water_stat','mode_turbo','mode_normal','mode_eco','mode_min',
        'bath-temp-container','bath-zad-container',
        // Энергия
        'power_watts','power_watts_ov','voltage_volts','voltage_volts_ov',
        'current_amps','current_amps_ov','power_boiler','power_water_heater',
        // Охрана
        'card_shield_svg','card-security',
        'sensor_hall_window','sensor_bed_window','sensor_kids_window',
        'sensor_kitchen_window','sensor_kitchen_door','sensor_front_door',
        // Дом-карточка
        't_home','h_home','card-home',
        // UI экранов
        'clock-time','clock-date','demo-badge',
        'auth-screen','app-content','passInput',
        'main-screen','rooms-screen','tech-screen',
    ];
    ids.forEach(id => { DOM[id] = document.getElementById(id); });
}

// =====================================================================
// ЭТАП 4: ХЕЛПЕР-ФУНКЦИИ (маленькие «черные ящики»)
// =====================================================================
const setText  = (id, val) => { const el = DOM[id] || document.getElementById(id); if (el) el.innerText = val; };
const setVal   = (id, val) => { if (DOM[id]) DOM[id].value = val; };
const addClass = (id, cls) => { if (DOM[id]) DOM[id].classList.add(cls); };
const remClass = (id, cls) => { if (DOM[id]) DOM[id].classList.remove(cls); };
const setStyle = (id, prop, val) => { if (DOM[id]) DOM[id].style[prop] = val; };
const setCssVar = (name, val) => document.documentElement.style.setProperty(name, val);

// =====================================================================
// СОСТОЯНИЯ И НАСТРОЙКИ
// =====================================================================
let isDemoMode = false;
let isConnected = false;

let states = {
    r2:0, r3:0, sv1:0, sv2:0,
    svbed:0, svbed_rgb:0, bednoc:0,
    svdet:0, svdet_rgb:0, detnoc:0, det_zad:0,
    kit_light:0, kit_sub:0, kit_night:0, kit_fan:0, kit_fan_speed:0,
    bath_light:0, bath_mirror:0, bath_dush:0, bath_vent:0,
    water_temp:0, water_zad:0, water_mode:2, water_stat:0,
    hall_vent:0, hall_fan_speed:0, wardrobe_light:0,
    pritok:0, pritok_speed:0,
    street_light:0, street_bbq:0, security_mode:0,
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
// ЭТАП 3: ОБЪЕКТ-МАРШРУТИЗАТОР MQTT-СООБЩЕНИЙ
// Вместо 50+ if-else — один справочник тема → функция
// =====================================================================
const topicRouter = {
    // --- КОТЕЛ ---
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

    // --- УЛИЦА ---
    'dom/tempUlica': v => { setText('t_out_big', v); setText('t_street', v); setText('t_street_ov', v); },
    'dom/vlagUlica': v => { setText('h_street', v); setText('h_street_ov', v); },
    'dom/davlUlica': v => { setText('p_street', v); setText('p_street_ov', v); },
    'dom/svUlica':   v => { states.street_light = +v; updateButtonState('sw_street_light', +v); updateStreetGlow(); },
    'dom/svMangal':  v => { states.street_bbq = +v;  updateButtonState('sw_street_bbq', +v);   updateStreetGlow(); },

    // --- ЗАЛ ---
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
    'dom/oknoZal':    v => updateWindowStatus('window-status-text', v, 't_hall'),
    'dom/Pritok':     v => { states.pritok = +v; updateButtonState('sw_hall_vent', +v); },
    'dom/Pritok1':    v => { states.pritok_speed = +v; updateHallFanSpeedButtons(v); },

    // --- СПАЛЬНЯ ---
    'dom/tempKsu1':          v => { setText('t_bed', v); setText('t_bed_ov', v); updateHomeCardAverage(); },
    'dom/vlagKsu':           v => { setText('h_bed', v); setText('h_bed_ov', v); updateHomeCardAverage(); },
    'dom/oknoSpalny':        v => updateWindowStatus('window-status-text-bed', v, 't_bed'),
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

    // --- ДЕТСКАЯ ---
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

    // --- КУХНЯ ---
    'dom/tempZal_kit': v => { setText('t_kit', v); setText('t_kit_ov', v); },
    'dom/vlagZal_kit': v => { setText('h_kit', v); setText('h_kit_ov', v); },
    'dom/tempChay':    v => { setText('t_chay', v); setText('t_chay_ov', v); },
    'dom/svKuh1':      v => { states.kit_light = +v; updateButtonState('sw_kit_light', +v); updateKitchenGlow(); updateHomeCardGlow(); },
    'dom/svKuh2':      v => { states.kit_sub   = +v; updateButtonState('sw_kit_sub',   +v); updateKitchenGlow(); updateHomeCardGlow(); },
    'dom/svKuh3':      v => { states.kit_night = +v; updateButtonState('sw_kit_night', +v); updateHomeCardGlow(); },
    'dom/Vityjka':     v => { states.kit_fan = +v; updateButtonState('sw_kit_fan', +v); },
    'dom/Vityjka1':    v => { states.kit_fan_speed = +v; updateFanSpeedButtons(v); },
    'dom/oknoKuhny':   v => { updateWindowStatus('window-status-text-kit', v, 't_kit'); updateSecuritySensor('sensor_kitchen_window', v); },
    'dom/dverKuhny':   v => { updateDoorStatus('door-status-text-kit', v, 't_kit'); updateSecuritySensor('sensor_kitchen_door', v); },

    // --- ВАННАЯ ---
    'dom/vod/temp':  v => { setText('t_vod', v); setText('t_vod_ov', v); states.water_temp = parseFloat(v); },
    'dom/vod/zad':   v => { setText('t_vod_zad', v); setText('t_vod_zad_ov', v); states.water_zad = parseFloat(v); },
    'dom/vod/regim': v => { states.water_mode = +v; updateWaterModeButtons(v); },
    'dom/vod/stat':  v => { states.water_stat = +v; updateWaterStatDisplay(); },
    'dom/svVan':          v => { states.bath_light  = +v; updateButtonState('sw_bath_light',  +v); updateBathroomGlow(); updateHomeCardGlow(); },
    'dom/svVanZerkalo':   v => { states.bath_mirror = +v; updateButtonState('sw_bath_mirror', +v); },
    'dom/svVanDush':      v => { states.bath_dush   = +v; updateButtonState('sw_bath_dush',   +v); updateBathroomGlow(); },
    'dom/svVanVent':      v => { states.bath_vent   = +v; updateButtonState('sw_bath_vent',   +v); },

    // --- ДАВЛЕНИЕ КОТЛА ---
    'dom/kotD': v => setText('kot_pressure', v),

    // --- ЭНЕРГОПОТРЕБЛЕНИЕ ---
    'dom/mojnost':          v => { setText('power_watts', v);    setText('power_watts_ov', v); },
    'dom/napr':             v => { setText('voltage_volts', v);  setText('voltage_volts_ov', v); },
    'dom/tok':              v => { setText('current_amps', v);   setText('current_amps_ov', v); },
    'dom/mojnost/kot':      v => setText('power_boiler', v),
    'dom/mojnost/vodogrey': v => setText('power_water_heater', v),

    // --- ДАТЧИКИ ОХРАНЫ + ОКНА/ДВЕРИ (объединено) ---
    'dom/oknoZal':     v => { updateWindowStatus('window-status-text', v, 't_hall'); updateSecuritySensor('sensor_hall_window', v); },
    'dom/oknoSpalny':  v => { updateWindowStatus('window-status-text-bed', v, 't_bed'); updateSecuritySensor('sensor_bed_window', v); },
    'dom/oknoDetskay': v => { updateWindowStatus('window-status-text-det', v, 't_det'); updateSecuritySensor('sensor_kids_window', v); },
    'dom/ohrana':      v => { states.security_mode = +v; updateSecurityDisplay(); },
};

// =====================================================================
// ОБРАБОТЧИК MQTT (теперь 3 строки вместо 150)
// =====================================================================
mqtt.onMessageArrived = (m) => {
    const handler = topicRouter[m.destinationName];
    if (handler) handler(m.payloadString);
};

mqtt.onConnectionLost = (resp) => {
    isConnected = false;
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
        onSuccess: () => { isConnected = true; mqtt.subscribe('heater/#'); mqtt.subscribe('dom/#'); },
        onFailure: () => setTimeout(connect, 5000)
    });
}

// =====================================================================
// ОТПРАВКА СООБЩЕНИЯ
// =====================================================================
function send(topic, value) {
    if (isDemoMode) {
        console.log('📱 ДЕМО:', topic, '=', value);
        // Прогоняем через роутер локально
        const handler = topicRouter[topic];
        if (handler) handler(String(value));
        return;
    }
    if (!isConnected) return;
    const msg = new Paho.MQTT.Message(String(value));
    msg.destinationName = topic;
    msg.retained = true;
    mqtt.send(msg);
}

// =====================================================================
// АВТОРИЗАЦИЯ
// =====================================================================
function checkPass() {
    const pass = DOM['passInput'] ? DOM['passInput'].value : '';
    if (pass === '1902') {
        isDemoMode = false;
        if (DOM['demo-badge'])  DOM['demo-badge'].style.display = 'none';
        if (DOM['auth-screen']) DOM['auth-screen'].style.display = 'none';
        if (DOM['app-content']) DOM['app-content'].style.display = 'flex';
        connect();
    } else if (pass.length > 0) {
        isDemoMode = true;
        if (DOM['demo-badge'])  DOM['demo-badge'].style.display = 'block';
        if (DOM['auth-screen']) DOM['auth-screen'].style.display = 'none';
        if (DOM['app-content']) DOM['app-content'].style.display = 'flex';
        startDemoSimulation();
    } else {
        alert('Введите пароль!');
    }
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
// СВАЙП (карточка ДОМ)
// =====================================================================
let touchStartX = 0;
function handleTouchStart(e) { touchStartX = e.changedTouches[0].screenX; }
function handleTouchEnd(e) {
    if (touchStartX - e.changedTouches[0].screenX > 50) showTechScreen();
}

// =====================================================================
// ЭТАП 2: ОБНОВЛЕНИЕ UI ЧЕРЕЗ CSS-КЛАССЫ И ХЕЛПЕРЫ
// =====================================================================

function updateButtonState(id, state) {
    if (!DOM[id]) return;
    DOM[id].classList.toggle('is-on', !!state);
}

// Универсальное обновление светового состояния карточки
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
    setCardGlow('card-street', '--street-glow-bottom', '--street-glow-top', states.street_light, states.street_bbq);
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

    // Свечение Зала
    if (key === 'sv1' || key === 'sv2') {
        const hallCard = DOM['card-hall'];
        if (hallCard) {
            hallCard.classList.toggle('glow-main', !!states.sv1);
            hallCard.classList.toggle('glow-extra', !!states.sv2);
        }
    }

    // Свечение Спальни
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

    // Свечение Детской
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
    if (isDemoMode) { updateBoilerModeDisplay(mode); return; }
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
    if (isDemoMode) { updateWaterModeButtons(mode); return; }
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
    // Этап 2: классы вместо inline-стилей
    DOM['bath-temp-container']?.classList.toggle('sensor-dim', !on);
    DOM['bath-temp-container']?.classList.toggle('sensor-clear', on);
    DOM['bath-zad-container']?.classList.toggle('sensor-dim', !on);
    DOM['bath-zad-container']?.classList.toggle('sensor-clear', on);
}

// =====================================================================
// ВЕНТИЛЯЦИЯ
// =====================================================================
function setFanSpeed(speed) {
    if (isDemoMode) { updateFanSpeedButtons(speed); return; }
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
    if (isDemoMode) { updateHallFanSpeedButtons(speed); return; }
    send('dom/Pritok1', speed);
    updateHallFanSpeedButtons(speed);
}

function updateHallFanSpeedButtons(speed) {
    ['hall_speed_1', 'hall_speed_2'].forEach((id, i) => {
        const on = (parseInt(speed) === i + 1);
        if (DOM[id]) { DOM[id].style.background = on ? '#58a6ff' : '#30363d'; DOM[id].style.color = on ? '#fff' : '#c9d1d9'; }
    });
}

// =====================================================================
// ДЕТСКАЯ — ЦЕЛЕВАЯ ТЕМПЕРАТУРА
// =====================================================================
function changeDetTargetTemp(delta) {
    let newTemp = Math.min(30, Math.max(15, parseFloat(states.det_zad) + delta));
    if (isDemoMode) { states.det_zad = newTemp; setText('l_det_zad', newTemp.toFixed(1)); return; }
    send('dom/tempMotzad', newTemp.toFixed(1));
    states.det_zad = newTemp;
    setText('l_det_zad', newTemp.toFixed(1));
}

// =====================================================================
// ШТОРЫ
// =====================================================================
function updateCurtainVisual(val) {
    const move = (100 - parseInt(val)) * 0.9;
    if (DOM['curt-l']) DOM['curt-l'].style.transform = `translateX(-${move}%)`;
    if (DOM['curt-r']) DOM['curt-r'].style.transform = `translateX(${move}%)`;
}

// =====================================================================
// ОКНА / ДВЕРИ
// =====================================================================
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

// =====================================================================
// ОХРАНА
// =====================================================================

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

    // Щит на карточке охраны
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
        // Галочка
        const check = document.getElementById('shield_check');
        if (check) {
            check.style.stroke  = color;
            check.style.opacity = armed ? '1' : '0';
        }
        shieldSvg.style.filter = glow;
    }

    // Кнопка в оверлее
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

// =====================================================================
// КАРТОЧКА ДОМ — СРЕДНИЕ ЗНАЧЕНИЯ
// =====================================================================
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

// =====================================================================
// ЧАСЫ
// =====================================================================
function updateClock() {
    const now = new Date();
    setText('clock-time', now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
    setText('clock-date', now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }));
}
setInterval(updateClock, 1000);

// =====================================================================
// ДЕМО-РЕЖИМ
// =====================================================================
function startDemoSimulation() {
    const seed = {
        't_water':'42.5','l_sp_dash':'55','pwr_val':'35%',
        't_hall':'22.4','h_hall':'45','t_bed':'21.8','h_bed':'48',
        't_det':'23.1','h_det':'42','t_kit':'24.2','h_kit':'52',
        't_kit_ov':'24.2','h_kit_ov':'52','t_bath':'23.5','h_bath':'65',
        't_bath_ov':'23.5','h_bath_ov':'65'
    };
    for (const [id, val] of Object.entries(seed)) { if (DOM[id]) DOM[id].innerText = val; }

    setInterval(() => {
        if (!isDemoMode) return;
        const r = (base, range) => (base + Math.random() * range).toFixed(1);
        const ri = (base, range) => Math.floor(base + Math.random() * range);
        setText('t_water', r(40, 5)); setText('t_hall', r(21, 4)); setText('h_hall', ri(40, 20));
        setText('t_bed',   r(20, 4)); setText('h_bed',  ri(45, 15));
        setText('t_det',   r(22, 4)); setText('h_det',  ri(35, 20));
        setText('t_kit',   r(23, 5)); setText('h_kit',  ri(48, 20));
        setText('t_kit_ov',r(23, 5)); setText('h_kit_ov', ri(48, 20));
        setText('t_vod',   r(22, 5)); setText('h_bath', ri(60, 25));
        setText('pwr_val', ri(0, 100) + '%');
        updateHomeCardAverage();
    }, 3000);
}

// =====================================================================
// ИНИЦИАЛИЗАЦИЯ
// =====================================================================
window.addEventListener('DOMContentLoaded', () => {
    initDOMCache();
    updateClock();

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(e => console.log('SW error', e));
        });
    }
});
