// ========================= //
// CANVAS & DOM //
// ========================= //
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const blueText = document.getElementById("blueScore");
const redText = document.getElementById("redScore");
const timerMainText = document.getElementById("timer-main");
const timerMsText = document.getElementById("timer-ms");

const streetLogo = new Image();
streetLogo.src = "../img/MomoCancha.jpg";

// ========================= //
// CONFIGURACIÓN DE MAPAS //
// ========================= //
const MAPS = [
    { name: "Classic Arena (1v1)", width: 800, height: 400, fieldColor: "#333b42", lineColor: "#ffffff", goalHeight: 110, bg: "#121212", goalBg: "#22272b", theme: "classic" },
    { name: "Street Arena (1v1)", width: 820, height: 390, fieldColor: "#2c3e50", lineColor: "#ff9f43", goalHeight: 95, bg: "#1e293b", goalBg: "#111827", theme: "street" },
    { name: "Frozen Arena (3v3)", width: 1020, height: 510, fieldColor: "#a5d8ff", lineColor: "#ffffff", goalHeight: 140, bg: "#4dabf7", goalBg: "#74c0fc", theme: "frozen" },
    { name: "Desert Arena (3v3)", width: 1000, height: 500, fieldColor: "#f4d03f", lineColor: "#784212", goalHeight: 135, bg: "#5e35b1", goalBg: "#7e57c2", theme: "desert" },
    { name: "Champions Arena (6v6)", width: 1300, height: 640, fieldColor: "#228be6", lineColor: "#ffffff", goalHeight: 180, bg: "#1a252f", goalBg: "#2c3e50", theme: "champions" }
];

const mapIndex = parseInt(localStorage.getItem("selectedMapIndex"), 10) || 0;
const currentMap = MAPS[mapIndex];

canvas.width = currentMap.width;
canvas.height = currentMap.height;

// ========================= //
// VARIABLES GLOBALES CORE //
// ========================= //
const nickname = localStorage.getItem('jugador') || 'Jugador';
const selectedTeam = localStorage.getItem('equipoSeleccionado') || 'red';
const roomId = localStorage.getItem('roomId');
const matchTimeMinutes = parseInt(localStorage.getItem('matchTime'), 10) || 5;

let gameStarted = false;
let gameRoomId = roomId;
let localPlayerTeam = selectedTeam;
let isPaused = false;
let isTimerRunning = false;
let lastTick = 0;
let totalMatchMs = matchTimeMinutes * 60 * 1000;
let remainingMs = totalMatchMs;

// ========================= //
// LÍMITES DE CANCHA //
// ========================= //
let fieldLeft = 80;
let fieldRight = canvas.width - 80;
let fieldTop = 40;
let fieldBottom = canvas.height - 40;

const goalWidth = 45;
let goalHeight = currentMap.goalHeight;
let goalTop = (canvas.height / 2) - (goalHeight / 2);
let goalBottom = (canvas.height / 2) + (goalHeight / 2);
const postRadius = 7;
let centerCircleRadius = canvas.width * 0.085;

let posts = [];

function updatePostPositions() {
    posts = [
        { x: fieldLeft, y: goalTop, r: postRadius },
        { x: fieldLeft, y: goalBottom, r: postRadius },
        { x: fieldRight, y: goalTop, r: postRadius },
        { x: fieldRight, y: goalBottom, r: postRadius }
    ];
}

// ========================= //
// PELOTA (PHYSICS TIPO HAXBALL) //
// ========================= //
const ball = {
    x: 0, y: 0, r: 10,
    vx: 0, vy: 0,
    friccion: 0.99,      // Más lento = más arcadero
    rebotePared: -0.6,   // Rebotes más fuertes
    massa: 0.4
};

// ========================= //
// JUGADORES //
// ========================= //
const player1 = {
    x: 0, y: 0, r: 20, baseR: 20,
    vx: 0, vy: 0,
    color: "#1a46a0",
    number: "1",
    name: 'Rival',
    massa: 1.8,
    team: "blue",
    activePower: null,
    powerTimer: 0,
    trail: []
};

const player2 = {
    x: 0, y: 0, r: 20, baseR: 20,
    vx: 0, vy: 0,
    color: "#d63031",
    number: "2",
    name: 'Rival',
    massa: 1.8,
    team: "red",
    activePower: null,
    powerTimer: 0,
    trail: []
};

// ========================= //
// SISTEMA DE PODERES //
// ========================= //
const POWER_TYPES = ["SPEED", "BIG", "SUPER_KICK", "FREEZE"];
const activePowerUps = [];
let powerUpSpawnTimer = 0;
const SPAWN_INTERVAL = 420;

// Configuración mejorada de velocidades tipo HaxBall
const JUGADOR_MAX_VEL = 3.2;      // Más rápido
const JUGADOR_ACCEL = 0.18;       // Aceleración más rápida
const JUGADOR_FRICCION = 0.88;    // Menos fricción = más control
const JUGADOR_MAX_VEL_KICKOFF = 1.5;

function getPowerEmoji(type) {
    const emojis = { "SPEED": "⚡", "BIG": "🛡️", "SUPER_KICK": "💥", "FREEZE": "❄️" };
    return emojis[type] || "?";
}

function applyPowerUp(player, type) {
    player.activePower = type;
    player.powerTimer = 420; // 7 segundos a 60fps

    switch(type) {
        case "BIG":
            player.r = player.baseR * 1.6;
            player.massa = 2.2;
            break;
        case "SPEED":
            player.r = player.baseR * 0.85;
            player.massa = 1.3;
            break;
        case "SUPER_KICK":
            player.r = player.baseR * 1.1;
            break;
        case "FREEZE":
            player.r = player.baseR * 1.15;
            break;
    }
}

function removePowerUp(player) {
    player.activePower = null;
    player.powerTimer = 0;
    player.r = player.baseR;
    player.massa = 1.8;
}

// ========================= //
// INPUT SYSTEM //
// ========================= //
let currentInputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    kick: false
};
let lastInputSendAt = 0;

const keys = {};

function handleKeyboardInput(key, isPressed) {
    const normalizedKey = String(key || '').toLowerCase();
    if (!normalizedKey) return;

    if (normalizedKey === 'arrowup' || normalizedKey === 'arrowdown' || normalizedKey === 'arrowleft' || normalizedKey === 'arrowright') {
        return;
    }

    keys[normalizedKey] = isPressed;
    if (normalizedKey === ' ') keys.space = isPressed;

    if (!gameStarted) return;

    if (normalizedKey === 'w') updateInputState('up', isPressed);
    if (normalizedKey === 's') updateInputState('down', isPressed);
    if (normalizedKey === 'a') updateInputState('left', isPressed);
    if (normalizedKey === 'd') updateInputState('right', isPressed);
    if (normalizedKey === ' ' || normalizedKey === 'space') updateInputState('kick', isPressed);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { togglePause(); return; }
    handleKeyboardInput(e.key, true);
});

document.addEventListener('keyup', (e) => {
    handleKeyboardInput(e.key, false);
});

function updateInputState(key, value) {
    if (!(key in currentInputState) || currentInputState[key] === value) return;
    currentInputState[key] = value;
    lastInputSendAt = 0;
    sendGameInput();
}

function sendGameInput() {
    if (!socket || !socket.connected || !gameRoomId) return;
    socket.emit('game:input', {
        roomId: gameRoomId,
        nickname: nickname,
        input: { ...currentInputState }
    });
}

function resetInputState() {
    currentInputState = { up: false, down: false, left: false, right: false, kick: false };
    lastInputSendAt = 0;
}

// ========================= //
// TIMER SYSTEM //
// ========================= //
function startTimer() {
    if (!isTimerRunning) {
        lastTick = performance.now();
        isTimerRunning = true;
    }
}

function stopTimer() {
    isTimerRunning = false;
}

function updateTimerDisplay() {
    const ms = Math.max(0, remainingMs);
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);

    const strMin = minutes < 10 ? "0" + minutes : String(minutes);
    const strSec = seconds < 10 ? "0" + seconds : String(seconds);
    const strCen = centiseconds < 10 ? "0" + centiseconds : String(centiseconds);

    if (timerMainText) timerMainText.textContent = `${strMin}:${strSec}`;
    if (timerMsText) timerMsText.textContent = `.${strCen}`;
}

// ========================= //
// CELEBRATION & KICKOFF //
// ========================= //
let isCelebration = false;
let celebrationTimer = 0;
let goalScorerColor = "";
let goalScorerName = "";
let kickOffTeam = "red";
let waitingForKickOff = true;
let restrictMidForRed = true;

let lastTouch = null;
let secondLastTouch = null;

function actualizarRanking(nombre, accion) {
    let ranking = JSON.parse(localStorage.getItem("rankingData")) || {};

    if (!ranking[nombre]) {
        ranking[nombre] = {
            nickname: nombre,
            stats: { goals: 0, assists: 0, saves: 0, matches: 0, wins: 0, points: 0 }
        };
    }

    if (accion === "gol") {
        ranking[nombre].stats.goals += 1;
        ranking[nombre].stats.points += 100;
    }

    if (accion === "victoria") {
        ranking[nombre].stats.matches += 1;
        ranking[nombre].stats.wins += 1;
        ranking[nombre].stats.points += 30;
    }

    localStorage.setItem("rankingData", JSON.stringify(ranking));
}

// ========================= //
// SOCKET IO //
// ========================= //
let socket = null;
if (typeof io !== 'undefined') {
    const serverURL = `${window.location.protocol}//${window.location.hostname}:${window.location.port || 3000}`;
    socket = io(serverURL);

    socket.on('connect', () => {
        socket.emit('player:join', { nickname });
        if (roomId) socket.emit('room:join', { roomId, nickname });
    });

    socket.on('room:joined', (data) => {
        if (data?.roomId === roomId && data.room) {
            updateRoomPlayers(data.room);
            if (data.room.matchActive) {
                gameStarted = true;
                gameRoomId = data.roomId;
            }
        }
    });

    socket.on('match:started', (data) => {
        if (!data || data.roomId !== roomId) return;
        gameStarted = true;
        gameRoomId = data.roomId;
        resetInputState();
        remainingMs = (data.matchTime || 5) * 60 * 1000;
        totalMatchMs = remainingMs;
        resetGameStateFromServer();
        
        if (data.players && Array.isArray(data.players)) {
            const local = data.players.find(p => p.nickname.trim().toLowerCase() === nickname.trim().toLowerCase());
            if (local) localPlayerTeam = local.team || localPlayerTeam;
        }
    });

    socket.on('game:state', (data) => {
        if (!data || data.roomId !== roomId || !data.players) return;

        gameStarted = true;
        gameRoomId = data.roomId;

        data.players.forEach(p => {
            if (p.team === 'blue') {
                player1.name = p.nickname;
                player1.team = 'blue';
            }
            if (p.team === 'red') {
                player2.name = p.nickname;
                player2.team = 'red';
            }
            if (p.nickname && p.nickname.trim().toLowerCase() === nickname.trim().toLowerCase()) {
                localPlayerTeam = p.team || localPlayerTeam;
            }
        });

        if (data.ball) {
            ball.x = data.ball.x;
            ball.y = data.ball.y;
            ball.vx = typeof data.ball.vx === 'number' ? data.ball.vx : ball.vx;
            ball.vy = typeof data.ball.vy === 'number' ? data.ball.vy : ball.vy;
        }

        data.players.forEach(p => {
            if (p.team === 'blue') {
                player1.x = typeof p.x === 'number' ? p.x : player1.x;
                player1.y = typeof p.y === 'number' ? p.y : player1.y;
                player1.vx = typeof p.vx === 'number' ? p.vx : player1.vx;
                player1.vy = typeof p.vy === 'number' ? p.vy : player1.vy;
                player1.activePower = p.activePower || null;
                player1.powerTimer = p.powerTimer || 0;
            }
            if (p.team === 'red') {
                player2.x = typeof p.x === 'number' ? p.x : player2.x;
                player2.y = typeof p.y === 'number' ? p.y : player2.y;
                player2.vx = typeof p.vx === 'number' ? p.vx : player2.vx;
                player2.vy = typeof p.vy === 'number' ? p.vy : player2.vy;
                player2.activePower = p.activePower || null;
                player2.powerTimer = p.powerTimer || 0;
            }
        });

        if (Array.isArray(data.activePowerUps)) {
            activePowerUps.length = 0;
            data.activePowerUps.forEach(pup => activePowerUps.push(pup));
        }

        if (typeof data.timerStarted === 'boolean' && data.timerStarted && !isTimerRunning) {
            startTimer();
        }

        if (typeof data.paused === 'boolean') {
            isPaused = data.paused;
            const overlay = document.getElementById('pauseOverlay');
            if (overlay) {
                if (isPaused) overlay.classList.remove('hidden');
                else overlay.classList.add('hidden');
            }
        }

        if (typeof data.celebrationActive === 'boolean') {
            isCelebration = data.celebrationActive;
            if (!isCelebration) celebrationTimer = 0;
        }

        if (typeof data.waitingForKickOff === 'boolean') {
            waitingForKickOff = data.waitingForKickOff;
        }

        if (typeof data.kickOffTeam === 'string') {
            kickOffTeam = data.kickOffTeam;
        }

        if (typeof data.restrictMidForRed === 'boolean') {
            restrictMidForRed = data.restrictMidForRed;
        }

        if (data.scores) {
            blueScore = data.scores.blue || 0;
            redScore = data.scores.red || 0;
            if (blueText) blueText.textContent = blueScore;
            if (redText) redText.textContent = redScore;
        }

        if (typeof data.remainingMs === 'number') {
            remainingMs = data.remainingMs;
            updateTimerDisplay();
        }
    });

    socket.on('match:ended', (data) => {
        if (!data || data.roomId !== roomId) return;
        gameStarted = false;
        if (data.scores) {
            blueScore = data.scores.blue || blueScore;
            redScore = data.scores.red || redScore;
            if (blueText) blueText.textContent = blueScore;
            if (redText) redText.textContent = redScore;
        }
        isCelebration = true;
        celebrationTimer = 180;
        goalScorerColor = '#ffffff';
        goalScorerName = '¡PARTIDO FINALIZADO!';
        
        if (data.winnerName) {
            actualizarRanking(data.winnerName, 'victoria');
        }
        
        setTimeout(() => {
            window.location.href = '../pages/lobby.html';
        }, 2500);
    });

    socket.on('game:goal', (data) => {
        if (!data || !data.scorer) return;
        const scorer = data.scorer;
        const scorerTeam = data.team || (scorer === player1.name ? 'blue' : 'red');
        
        resetInputState();
        resetPositions();
        isCelebration = true;
        celebrationTimer = 180;
        goalScorerColor = scorerTeam === 'blue' ? '#1a46a0' : '#d63031';
        goalScorerName = `¡${scorer.toUpperCase()} GOL!`;
        
        actualizarRanking(scorer, 'gol');
    });

    socket.on('room:error', (message) => {
        console.error('Room error:', message);
        alert(message || 'Error en la sala');
        window.location.href = '../pages/jugar.html';
    });
}

// ========================= //
// POWER-UPS LOGIC //
// ========================= //
function handlePowerUpsLogic() {
    if (isCelebration || waitingForKickOff) return;

    [player1, player2].forEach(p => {
        if (p.powerTimer > 0) {
            p.powerTimer--;
            if (p.powerTimer <= 0) removePowerUp(p);
        }
    });

    powerUpSpawnTimer++;
    if (powerUpSpawnTimer >= SPAWN_INTERVAL) {
        powerUpSpawnTimer = 0;

        if (activePowerUps.length < 2) {
            const margin = 50;
            const randomX = Math.random() * ((fieldRight - margin) - (fieldLeft + margin)) + (fieldLeft + margin);
            const randomY = Math.random() * ((fieldBottom - margin) - (fieldTop + margin)) + (fieldTop + margin);
            const randomType = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];

            activePowerUps.push({ x: randomX, y: randomY, r: 15, type: randomType });
        }
    }

    for (let i = activePowerUps.length - 1; i >= 0; i--) {
        const pup = activePowerUps[i];
        
        let hitPlayer = null;
        if (checkCircleCollision(player1, pup)) hitPlayer = player1;
        else if (checkCircleCollision(player2, pup)) hitPlayer = player2;

        if (hitPlayer) {
            applyPowerUp(hitPlayer, pup.type);
            activePowerUps.splice(i, 1);
        }
    }
}

// ========================= //
// PHYSICS & COLLISIONS //
// ========================= //
function checkCircleCollision(c1, c2) {
    const dx = c1.x - c2.x;
    const dy = c1.y - c2.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < (c1.r + c2.r);
}

function resetGameStateFromServer() {
    blueScore = 0;
    redScore = 0;
    remainingMs = totalMatchMs;
    lastTick = performance.now();
    resetPositions();
    updateTimerDisplay();
}

function resetPositions() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.vx = 0;
    ball.vy = 0;
    
    player1.vx = 0; player1.vy = 0;
    player2.vx = 0; player2.vy = 0;
    waitingForKickOff = true;

    player1.x = (canvas.width / 2) - 150;
    player1.y = canvas.height / 2;
    player2.x = (canvas.width / 2) + 150;
    player2.y = canvas.height / 2;

    removePowerUp(player1);
    removePowerUp(player2);
    player1.trail = [];
    player2.trail = [];
    activePowerUps.length = 0;
    powerUpSpawnTimer = 0;
    lastTouch = null;
    secondLastTouch = null;
}

function movePlayers() {
    const localKick = keys["space"];
    const p1HasSpeed = player1.activePower === "SPEED";
    const p2HasSpeed = player2.activePower === "SPEED";
    const p1Frozen = player1.activePower === "FREEZE";
    const p2Frozen = player2.activePower === "FREEZE";

    const maxVelP1 = p1Frozen ? 0.5 : (p1HasSpeed ? JUGADOR_MAX_VEL * 1.7 : JUGADOR_MAX_VEL);
    const accelP1 = p1Frozen ? 0.04 : (p1HasSpeed ? JUGADOR_ACCEL * 1.8 : JUGADOR_ACCEL);

    const maxVelP2 = p2Frozen ? 0.5 : (p2HasSpeed ? JUGADOR_MAX_VEL * 1.7 : JUGADOR_MAX_VEL);
    const accelP2 = p2Frozen ? 0.04 : (p2HasSpeed ? JUGADOR_ACCEL * 1.8 : JUGADOR_ACCEL);

    let moveX1 = 0; let moveY1 = 0;
    if (keys["w"]) moveY1 -= 1;
    if (keys["s"]) moveY1 += 1;
    if (keys["a"]) moveX1 -= 1;
    if (keys["d"]) moveX1 += 1;

    if (moveX1 !== 0 && moveY1 !== 0) {
        moveX1 *= 0.7071; moveY1 *= 0.7071;
    }
    player1.vx += moveX1 * accelP1;
    player1.vy += moveY1 * accelP1;

    let moveX2 = 0; let moveY2 = 0;
    if (keys["arrowup"]) moveY2 -= 1;
    if (keys["arrowdown"]) moveY2 += 1;
    if (keys["arrowleft"]) moveX2 -= 1;
    if (keys["arrowright"]) moveX2 += 1;

    if (moveX2 !== 0 && moveY2 !== 0) {
        moveX2 *= 0.7071; moveY2 *= 0.7071;
    }
    player2.vx += moveX2 * accelP2;
    player2.vy += moveY2 * accelP2;

    player1.vx *= JUGADOR_FRICCION; player1.vy *= JUGADOR_FRICCION;
    player2.vx *= JUGADOR_FRICCION; player2.vy *= JUGADOR_FRICCION;

    let vel1 = Math.sqrt(player1.vx*player1.vx + player1.vy*player1.vy);
    if (vel1 > maxVelP1) {
        player1.vx = (player1.vx / vel1) * maxVelP1;
        player1.vy = (player1.vy / vel1) * maxVelP1;
    }
    let vel2 = Math.sqrt(player2.vx*player2.vx + player2.vy*player2.vy);
    if (vel2 > maxVelP2) {
        player2.vx = (player2.vx / vel2) * maxVelP2;
        player2.vy = (player2.vy / vel2) * maxVelP2;
    }

    player1.x += player1.vx; player1.y += player1.vy;
    player2.x += player2.vx; player2.y += player2.vy;
}

function playerVsPlayer() {
    const dx = player2.x - player1.x;
    const dy = player2.y - player1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = player1.r + player2.r;

    if (dist < minDist) {
        const overlap = minDist - dist;
        const angle = Math.atan2(dy, dx);

        player1.x -= Math.cos(angle) * (overlap / 2);
        player1.y -= Math.sin(angle) * (overlap / 2);
        player2.x += Math.cos(angle) * (overlap / 2);
        player2.y += Math.sin(angle) * (overlap / 2);

        const nx = dx / dist;
        const ny = dy / dist;

        const kx = player1.vx - player2.vx;
        const ky = player1.vy - player2.vy;
        const p = 2 * (nx * kx + ny * ky) / (player1.massa + player2.massa);

        player1.vx -= p * player2.massa * nx;
        player1.vy -= p * player2.massa * ny;
        player2.vx += p * player1.massa * nx;
        player2.vy += p * player1.massa * ny;
    }
}

function handleBallCollisions() {
    const dx1 = ball.x - player1.x; const dy1 = ball.y - player1.y;
    const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    
    const dx2 = ball.x - player2.x; const dy2 = ball.y - player2.y;
    const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    const localKick = keys["space"];
    const p1Chuta = localPlayerTeam === 'blue' ? localKick : false;
    const p2Chuta = localPlayerTeam === 'red' ? localKick : false;

    const minDist1 = p1Chuta ? (player1.r + ball.r + 12) : (player1.r + ball.r);
    const minDist2 = p2Chuta ? (player2.r + ball.r + 12) : (player2.r + ball.r);

    const p1Collides = dist1 < minDist1;
    const p2Collides = dist2 < minDist2;

    if (waitingForKickOff) {
        if ((p1Collides && kickOffTeam === "blue") || (p2Collides && kickOffTeam === "red")) {
            waitingForKickOff = false;
            startTimer();
        }
    }

    if (p1Collides && p2Collides) {
        processCollision(player1, dx1, dy1, dist1, p1Chuta);
        processCollision(player2, dx2, dy2, dist2, p2Chuta);
        return;
    }

    if (p1Collides) processCollision(player1, dx1, dy1, dist1, p1Chuta);
    if (p2Collides) processCollision(player2, dx2, dy2, dist2, p2Chuta);

    posts.forEach(post => {
        const pdx = ball.x - post.x;
        const pdy = ball.y - post.y;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        const pMinDist = ball.r + post.r;

        if (pdist < pMinDist) {
            const pAngle = Math.atan2(pdy, pdx);
            const pOverlap = pMinDist - pdist;
            ball.x += Math.cos(pAngle) * pOverlap;
            ball.y += Math.sin(pAngle) * pOverlap;

            const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            ball.vx = Math.cos(pAngle) * Math.max(speed * 0.7, 2.0);
            ball.vy = Math.sin(pAngle) * Math.max(speed * 0.7, 2.0);
        }
    });
}

function processCollision(player, dx, dy, dist, isKicking) {
    const angle = Math.atan2(dy, dx);

    try {
        secondLastTouch = lastTouch || null;
        lastTouch = player.name || null;
    } catch (e) {}

    const minDistCuerpo = player.r + ball.r;
    if (dist < minDistCuerpo) {
        const overlap = minDistCuerpo - dist;
        ball.x += Math.cos(angle) * overlap;
        ball.y += Math.sin(angle) * overlap;
    }

    if (isKicking) {
        const kickDirX = Math.cos(angle);
        const kickDirY = Math.sin(angle);
        const baseImpulse = player.activePower === "SUPER_KICK" ? 18.0 : 11.5;
        const kickPowerX = kickDirX * baseImpulse + player.vx * 0.3;
        const kickPowerY = kickDirY * baseImpulse + player.vy * 0.3;
        ball.vx = kickPowerX;
        ball.vy = kickPowerY;
        player.vx *= 0.85;
        player.vy *= 0.85;
    } else {
        const nx = dx / dist;
        const ny = dy / dist;
        const kx = player.vx - ball.vx;
        const ky = player.vy - ball.vy;
        
        const p = 0.9 * (nx * kx + ny * ky) / (player.massa + ball.massa);

        ball.vx += p * player.massa * nx;
        ball.vy += p * player.massa * ny;
        player.vx -= p * ball.massa * nx * 0.4;
        player.vy -= p * ball.massa * ny * 0.4;
    }

    try {
        const nearLeft = (player.team === 'blue') && (player.x - fieldLeft < 100);
        const nearRight = (player.team === 'red') && (fieldRight - player.x < 100);
        if ((nearLeft || nearRight) && socket) {
            socket.emit('game:save', { nickname: player.name });
        }
    } catch (e) {}
}

function updatePositionsAndLimits() {
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= ball.friccion;
    ball.vy *= ball.friccion;

    handleBallCollisions();

    if (ball.y - ball.r < fieldTop) { ball.y = fieldTop + ball.r; ball.vy *= ball.rebotePared; }
    if (ball.y + ball.r > fieldBottom) { ball.y = fieldBottom - ball.r; ball.vy *= ball.rebotePared; }

    const insideLeftGoal = ball.x - ball.r < fieldLeft && ball.y - ball.r >= goalTop && ball.y + ball.r <= goalBottom;
    const insideRightGoal = ball.x + ball.r > fieldRight && ball.y - ball.r >= goalTop && ball.y + ball.r <= goalBottom;

    if (insideLeftGoal || insideRightGoal) {
        // Servidor maneja el gol
    } else {
        if (ball.x - ball.r < fieldLeft) { ball.x = fieldLeft + ball.r; ball.vx *= ball.rebotePared; }
        if (ball.x + ball.r > fieldRight) { ball.x = fieldRight - ball.r; ball.vx *= ball.rebotePared; }
    }

    [player1, player2].forEach(p => {
        posts.forEach(post => {
            const pdx = p.x - post.x;
            const pdy = p.y - post.y;
            const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
            const pMinDist = p.r + post.r;

            if (pdist < pMinDist) {
                const pAngle = Math.atan2(pdy, pdx);
                const pOverlap = pMinDist - pdist;
                p.x += Math.cos(pAngle) * pOverlap;
                p.y += Math.sin(pAngle) * pOverlap;

                const dot = p.vx * Math.cos(pAngle) + p.vy * Math.sin(pAngle);
                if (dot < 0) {
                    p.vx -= Math.cos(pAngle) * dot * 1.2;
                    p.vy -= Math.sin(pAngle) * dot * 1.2;
                }
            }
        });

        p.x = Math.max(p.r, Math.min(canvas.width - p.r, p.x));
        p.y = Math.max(p.r, Math.min(canvas.height - p.r, p.y));
    });

    if (!isCelebration) {
        if (ball.x < fieldLeft - ball.r) { triggerGoal("red"); }
        if (ball.x > fieldRight + ball.r) { triggerGoal("blue"); }
    }
}

function triggerGoal(team) {
    if (window.__matchEnded) return;

    isCelebration = true;
    celebrationTimer = 120;
    stopTimer();

    const scorerName = team === 'red' ? player2.name : player1.name;
    const scorer = lastTouch || scorerName;
    const assister = (secondLastTouch && secondLastTouch !== scorer) ? secondLastTouch : null;

    if (team === "red") {
        redScore++;
        redText.textContent = redScore;
        actualizarRanking(player2.name, "gol");
        goalScorerColor = "#d63031";
        goalScorerName = `¡GOL DE ${player2.name.toUpperCase()}!`;
        kickOffTeam = "blue";
    } else {
        blueScore++;
        blueText.textContent = blueScore;
        actualizarRanking(player1.name, "gol");
        goalScorerColor = "#1a46a0";
        goalScorerName = `¡GOL DE ${player1.name.toUpperCase()}!`;
        kickOffTeam = "red";
    }

    if (socket) {
        socket.emit('game:goal', { scorer, assister, team });
    }

    try {
        const limit = parseInt(localStorage.getItem('goalLimit'), 10) || 0;
        if (limit > 0 && (redScore >= limit || blueScore >= limit)) {
            window.__matchEnded = true;
            isPaused = true;
            stopTimer();

            const winnerTeam = redScore > blueScore ? 'red' : (blueScore > redScore ? 'blue' : 'draw');
            const winnerName = winnerTeam === 'red' ? player2.name : (winnerTeam === 'blue' ? player1.name : null);

            if (socket) {
                if (winnerName) actualizarRanking(winnerName, "victoria");
                socket.emit('match:ended', {
                    winnerTeam, winnerName,
                    finalScore: { red: redScore, blue: blueScore }
                });
            }

            setTimeout(() => {
                window.location.href = "../pages/lobby.html";
            }, 2500);
        }
    } catch (e) {}
}

// ========================= //
// RENDERING //
// ========================= //
function drawCircle(x, y, r, color, strokeColor = "#000000", strokeWidth = 1.5) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
    ctx.closePath();
}

function drawPlayer(player, isKicking) {
    // Trail efecto SPEED
    if (player.trail && player.trail.length > 0) {
        player.trail.forEach((pos, index) => {
            let alpha = (index + 1) / player.trail.length * 0.25;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, pos.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
            ctx.fill();
            ctx.closePath();
        });
    }

    // Aura del poder
    if (player.activePower) {
        let auraColor = "#ffd700";
        if (player.activePower === "BIG") auraColor = "#ff9f43";
        if (player.activePower === "SUPER_KICK") auraColor = "#ff0055";
        if (player.activePower === "FREEZE") auraColor = "#00d4ff";

        ctx.beginPath();
        ctx.arc(player.x, player.y, player.r + 6, 0, Math.PI * 2);
        ctx.strokeStyle = auraColor;
        ctx.lineWidth = 4.0;
        ctx.stroke();
        ctx.closePath();
    }

    // Cuerpo
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = isKicking ? 5.0 : 2.0;
    ctx.stroke();
    
    // Número
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${player.r * 0.9}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(player.number, player.x, player.y);
    ctx.closePath();

    // Nombre + poder
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    
    let textoNombre = player.name;
    if (player.activePower) {
        textoNombre += " " + getPowerEmoji(player.activePower);
    }
    ctx.fillText(textoNombre, player.x, player.y + player.r + 7);
}

function drawField() {
    // Fondo exterior
    ctx.fillStyle = currentMap.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Terreno de juego
    ctx.fillStyle = currentMap.fieldColor;
    ctx.fillRect(fieldLeft, fieldTop, fieldRight - fieldLeft, fieldBottom - fieldTop);

    // Detalles estéticos
    ctx.font = "16px Arial";
    ctx.textBaseline = "middle";

    if (currentMap.theme === "frozen") {
        ctx.textAlign = "center";
        for (let x = fieldLeft + 30; x < fieldRight; x += 60) {
            ctx.fillText("🐧", x, fieldTop - 20);
            ctx.fillText("☃️", x, fieldBottom + 20);
        }
    } else if (currentMap.theme === "desert") {
        ctx.textAlign = "center";
        for (let x = fieldLeft + 45; x < fieldRight; x += 90) {
            ctx.fillText("🌵", x, fieldTop - 20);
            ctx.fillText("🦂", x, fieldBottom + 20);
        }
    } else if (currentMap.theme === "street") {
        ctx.textAlign = "center";
        for (let x = fieldLeft + 60; x < fieldRight; x += 120) {
            ctx.fillText("🗑️", x, fieldTop - 20);
            ctx.fillText("🧱", x, fieldBottom + 20);
        }
    } else if (currentMap.theme === "champions") {
        ctx.textAlign = "center";
        for (let x = fieldLeft + 20; x < fieldRight; x += 40) {
            ctx.fillText("🙋‍♂️", x, fieldTop - 20);
            ctx.fillText("🚩", x, fieldBottom + 20);
        }
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        let stripeWidth = (fieldRight - fieldLeft) / 10;
        for (let i = 0; i < 10; i += 2) {
            ctx.fillRect(fieldLeft + (i * stripeWidth), fieldTop, stripeWidth, fieldBottom - fieldTop);
        }
    }

    // Arcos
    ctx.fillStyle = currentMap.goalBg;
    ctx.fillRect(fieldLeft - goalWidth, goalTop, goalWidth, goalHeight);
    ctx.strokeStyle = currentMap.lineColor;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(fieldLeft - goalWidth, goalTop, goalWidth, goalHeight);

    ctx.fillRect(fieldRight, goalTop, goalWidth, goalHeight);
    ctx.strokeRect(fieldRight, goalTop, goalWidth, goalHeight);

    // Redes
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    for (let y = goalTop + 10; y < goalBottom; y += 10) {
        ctx.beginPath(); ctx.moveTo(fieldLeft - goalWidth, y); ctx.lineTo(fieldLeft, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(fieldRight, y); ctx.lineTo(fieldRight + goalWidth, y); ctx.stroke();
    }

    // Líneas
    ctx.strokeStyle = currentMap.lineColor;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(fieldLeft, fieldTop, fieldRight - fieldLeft, fieldBottom - fieldTop);
    
    ctx.beginPath(); ctx.moveTo(canvas.width / 2, fieldTop); ctx.lineTo(canvas.width / 2, fieldBottom); ctx.stroke();
    ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, centerCircleRadius, 0, Math.PI * 2); ctx.stroke();

    // Logo Momo en círculo central (Street Arena)
    if (currentMap.theme === "street" && typeof streetLogo !== "undefined" && streetLogo.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, centerCircleRadius, 0, Math.PI * 2);
        ctx.clip();

        let size = centerCircleRadius * 2;
        ctx.drawImage(
            streetLogo,
            (canvas.width / 2) - centerCircleRadius,
            (canvas.height / 2) - centerCircleRadius,
            size,
            size
        );

        ctx.restore();
    }

    // Líneas de arcos
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.beginPath(); ctx.moveTo(fieldLeft, goalTop); ctx.lineTo(fieldLeft, goalBottom); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fieldRight, goalTop); ctx.lineTo(fieldRight, goalBottom); ctx.stroke();

    // Áreas grandes
    if (currentMap.theme === "champions" || currentMap.theme === "desert") {
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.strokeRect(fieldLeft, canvas.height/2 - goalHeight, goalWidth * 2.5, goalHeight * 2);
        ctx.strokeRect(fieldRight - (goalWidth * 2.5), canvas.height/2 - goalHeight, goalWidth * 2.5, goalHeight * 2);
    }

    // Nombre del mapa
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = "italic bold 13px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`🏟️  ${currentMap.name}`, fieldLeft + 15, fieldTop + 25);
}

function drawPowerUps() {
    activePowerUps.forEach(pup => {
        let color = "#ffd700";
        if (pup.type === "BIG") color = "#ff9f43";
        if (pup.type === "SUPER_KICK") color = "#ff0055";
        if (pup.type === "FREEZE") color = "#00d4ff";

        drawCircle(pup.x, pup.y, pup.r, color, "#ffffff", 2.5);

        ctx.font = "18px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(getPowerEmoji(pup.type), pup.x, pup.y);
    });
}

function drawCelebrationOverlay() {
    if (!isCelebration) return;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "rgba(20, 20, 20, 0.9)";
    ctx.fillRect(0, canvas.height / 2 - 70, canvas.width, 140);

    ctx.fillStyle = goalScorerColor;
    ctx.font = "italic bold 60px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.fillText(goalScorerName, canvas.width / 2, canvas.height / 2);
    
    ctx.shadowBlur = 0;
}

// ========================= //
// PAUSE SYSTEM //
// ========================= //
let timerWasRunningBeforePause = false;

function setPaused(p) {
    const overlay = document.getElementById('pauseOverlay');
    const shouldPause = !!p;
    isPaused = shouldPause;
    if (overlay) {
        if (isPaused) overlay.classList.remove('hidden');
        else overlay.classList.add('hidden');
    }

    if (gameStarted && gameRoomId && socket && socket.connected) {
        if (shouldPause) {
            socket.emit('game:pause', { roomId: gameRoomId });
        } else {
            socket.emit('game:resume', { roomId: gameRoomId });
        }
    }

    if (isPaused) {
        timerWasRunningBeforePause = isTimerRunning;
        if (isTimerRunning) stopTimer();
    } else {
        if (timerWasRunningBeforePause) startTimer();
    }
}

function togglePause() {
    setPaused(!isPaused);
}

function resetMatch() {
    blueScore = 0; redScore = 0;
    blueText.textContent = blueScore;
    redText.textContent = redScore;
    remainingMs = totalMatchMs;
    updateTimerDisplay();
    resetPositions();
}

document.addEventListener('DOMContentLoaded', () => {
    const resumeBtn = document.getElementById('resumeButton');
    const restartBtn = document.getElementById('restartButton');
    const exitBtn = document.getElementById('exitButton');
    const openPause = document.getElementById('openPauseButton');
    
    if (resumeBtn) resumeBtn.addEventListener('click', () => setPaused(false));
    if (restartBtn) restartBtn.addEventListener('click', () => { setPaused(false); resetMatch(); });
    if (exitBtn) exitBtn.addEventListener('click', () => { window.location.href = '../pages/menu.html'; });
    if (openPause) openPause.addEventListener('click', () => togglePause());
});

// ========================= //
// CHAT SYSTEM //
// ========================= //
const chatInput = document.getElementById("chatInput");
const sendChat = document.getElementById("sendChat");
const chatMessages = document.getElementById("chatMessages");

function enviarMensaje() {
    const mensaje = chatInput.value.trim();
    if (!mensaje) return;

    socket.emit("chat:message", { jugador: nickname, mensaje });
    chatInput.value = "";
}

sendChat.addEventListener("click", enviarMensaje);
chatInput.addEventListener("keydown", e => {
    if (e.key === "Enter") enviarMensaje();
});

socket.on("chat:message", data => {
    const div = document.createElement("div");
    div.className = "chatMessage";
    div.textContent = `${data.jugador}: ${data.mensaje}`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// ========================= //
// GAME LOOP //
// ========================= //
function gameLoop() {
    if (!isPaused && gameRoomId) {
        const now = Date.now();
        const shouldSendInput = now - lastInputSendAt >= 30 || Object.values(currentInputState).some(Boolean);
        if (shouldSendInput) {
            sendGameInput();
            lastInputSendAt = now;
        }
    }

    if (!isPaused) {
        updateTimerDisplay();
        movePlayers();
        playerVsPlayer();
        updatePositionsAndLimits();
        handlePowerUpsLogic();
    }

    // Trail animation
    [player1, player2].forEach(p => {
        if (p.activePower === "SPEED") {
            p.trail.push({ x: p.x, y: p.y, r: p.r });
            if (p.trail.length > 18) p.trail.shift();
        } else {
            if (p.trail.length > 0) p.trail.shift();
        }
    });

    // Dibujo
    drawField();
    drawPowerUps();

    const localKick = currentInputState.kick || keys["space"];
    const p1Chutando = localPlayerTeam === 'blue' ? localKick : false;
    const p2Chutando = localPlayerTeam === 'red' ? localKick : false;

    drawPlayer(player1, p1Chutando);
    drawPlayer(player2, p2Chutando);

    drawCircle(ball.x, ball.y, ball.r, "#ffffff", "#000000", 1.5);

    posts.forEach(post => {
        drawCircle(post.x, post.y, post.r, "#ffffff", "#000000", 1.5);
    });

    // Celebración
    if (isCelebration) {
        drawCelebrationOverlay();
        celebrationTimer--;
        if (celebrationTimer <= 0) {
            isCelebration = false;
            if (socket && gameStarted && gameRoomId) {
                socket.emit('game:resume', { roomId: gameRoomId });
            }
        }
    }

    requestAnimationFrame(gameLoop);
}

// ========================= //
// INICIALIZACIÓN //
// ========================= //
function updateRoomPlayers(room) {
    const bluePlayers = room.players.filter(p => p.team === 'blue');
    const redPlayers = room.players.filter(p => p.team === 'red');

    if (bluePlayers[0]) {
        player1.name = bluePlayers[0].nickname;
        player1.team = 'blue';
    }
    if (redPlayers[0]) {
        player2.name = redPlayers[0].nickname;
        player2.team = 'red';
    }

    const lowerNickname = nickname.trim().toLowerCase();
    const localPlayer = room.players.find(p => p.nickname && p.nickname.trim().toLowerCase() === lowerNickname);
    
    if (localPlayer) {
        if (localPlayer.team === 'blue') {
            player1.name = localPlayer.nickname;
            player1.team = 'blue';
            localPlayerTeam = 'blue';
        } else if (localPlayer.team === 'red') {
            player2.name = localPlayer.nickname;
            player2.team = 'red';
            localPlayerTeam = 'red';
        }
    }

    if (!localPlayer || localPlayer.team === 'blue') {
        const enemy = redPlayers.find(p => !localPlayer || p.nickname.trim().toLowerCase() !== lowerNickname) || { nickname: 'Rival' };
        player2.name = enemy.nickname;
    } else {
        const enemy = bluePlayers.find(p => !localPlayer || p.nickname.trim().toLowerCase() !== lowerNickname) || { nickname: 'Rival' };
        player1.name = enemy.nickname;
    }
}

updatePostPositions();
resetPositions();
gameLoop();