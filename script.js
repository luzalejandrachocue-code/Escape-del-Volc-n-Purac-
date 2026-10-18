// CONFIGURACIÓN DEL CANVAS
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = document.getElementById('game-container').clientWidth;
    canvas.height = document.getElementById('game-container').clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ESTADO DEL JUEGO
let gameRunning = false;
let score = 0;
let timeElapsed = 0;
let itemsCollected = 0;
let level = 1; // 1: Terrestre, 2: Barco de Magma
let gameSpeed = 5;
let timerInterval = null;
let lavaOffset = 0;
let animFrame = 0;
let metaDistance = 30; // Segundos para llegar a la meta
let highscore = localStorage.getItem('purace_highscore') || 0;

// FRASES MOTIVADORAS
const WIN_PHRASES = [
    "¡Increíble agilidad! Tu valentía y reflejos superaron el erupcionado Volcán Puracé.",
    "¡Misión cumplida explorador! Has demostrado que ningún obstáculo es demasiado grande.",
    "¡Espectacular! La agilidad de tu mente fue más rápida que el magma brillante."
];

const LOSE_PHRASES = [
    "¡No te rindas! Cada intento es un paso más hacia la conquista del volcán.",
    "¡Levántate explorador! La perseverancia es la clave de los grandes campeones.",
    "¡Casi lo logras! Reajusta tus saltos y vuelve a intentarlo con más fuerza."
];

// NIVELES
const LEVELS = {
    1: { name: 'Piedra y Plataformas (A pie)', speed: 5, bgTop: '#e66000', bgBot: '#fcaa25' },
    2: { name: 'Río de Magma (Navegación)', speed: 8.5, bgTop: '#800c00', bgBot: '#d13400' }
};

// JUGADOR / BARCO
const player = {
    x: 100,
    y: 0,
    width: 38,
    height: 52,
    velocityY: 0,
    gravity: 0.55,
    jumpForce: -11.5,
    jumpsLeft: 2,
    isCrouching: false,

    reset() {
        this.y = canvas.height - 150;
        this.velocityY = 0;
        this.jumpsLeft = 2;
        this.isCrouching = false;
        this.height = level === 1 ? 52 : 35;
        this.width = level === 1 ? 38 : 65;
    },

    jump() {
        if (this.jumpsLeft > 0) {
            this.velocityY = this.jumpForce;
            this.jumpsLeft--;
        }
    },

    crouch(state) {
        if (level === 1) {
            if (state && !this.isCrouching) {
                this.isCrouching = true;
                this.height = 30;
                this.y += 22;
            } else if (!state && this.isCrouching) {
                this.isCrouching = false;
                this.height = 52;
                this.y -= 22;
            }
        }
    },

    update() {
        this.velocityY += this.gravity;
        this.y += this.velocityY;

        // Caída en lava
        if (this.y + this.height >= canvas.height - 15) {
            gameOver();
        }
    },

    draw() {
        if (level === 1) {
            this.drawExplorer();
        } else {
            this.drawBoat();
        }
    },

    drawExplorer() {
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height);

        let runAngle = Math.sin(animFrame * 0.25) * 0.6;
        let isAirborne = this.velocityY !== 0;

        // Pierna Trasera
        ctx.save();
        ctx.translate(-2, -18);
        ctx.rotate(isAirborne ? -0.8 : -runAngle);
        ctx.fillStyle = '#1c2833'; ctx.fillRect(-4, 0, 8, 14);
        ctx.fillStyle = '#a93226'; ctx.fillRect(-4, 20, 10, 5);
        ctx.restore();

        // Mochila
        ctx.fillStyle = '#5c2c16';
        ctx.beginPath(); ctx.roundRect(-22, -42, 12, 22, 4); ctx.fill();

        // Torso
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath(); ctx.roundRect(-10, -40, 20, 24, 6); ctx.fill();

        // Pierna Delantera
        ctx.save();
        ctx.translate(2, -18);
        ctx.rotate(isAirborne ? 0.8 : runAngle);
        ctx.fillStyle = '#2c3e50'; ctx.fillRect(-4, 0, 8, 14);
        ctx.fillStyle = '#c0392b'; ctx.fillRect(-3, 20, 11, 5);
        ctx.restore();

        // Cabeza y Casco
        ctx.fillStyle = '#f5cba7';
        ctx.beginPath(); ctx.arc(2, -44, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d35400';
        ctx.beginPath(); ctx.arc(2, -47, 11, Math.PI, Math.PI * 2); ctx.fill();

        ctx.restore();
    },

    drawBoat() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Casco del barco de madera reforzada
        ctx.fillStyle = '#5c2c16';
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.lineTo(15, 30);
        ctx.lineTo(50, 30);
        ctx.lineTo(65, 5);
        ctx.closePath();
        ctx.fill();

        // Borde dorado
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(5, 5, 55, 4);

        // Vela volcánica
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.moveTo(30, 5);
        ctx.lineTo(30, -25);
        ctx.lineTo(52, -10);
        ctx.closePath();
        ctx.fill();

        // Mástil
        ctx.fillStyle = '#fff';
        ctx.fillRect(28, -25, 3, 30);

        // Explorador dentro del barco
        ctx.fillStyle = '#f5cba7';
        ctx.beginPath(); ctx.arc(20, -2, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d35400';
        ctx.beginPath(); ctx.arc(20, -5, 7, Math.PI, Math.PI * 2); ctx.fill();

        ctx.restore();
    }
};

// ARRAYS DE OBJETOS
let platforms = [];
let obstacles = [];
let collectibles = [];

// ELEMENTOS DOM
const screens = {
    credits: document.getElementById('screen-credits'),
    instructions: document.getElementById('screen-instructions'),
    win: document.getElementById('screen-win'),
    gameover: document.getElementById('screen-gameover')
};

const hud = {
    container: document.getElementById('hud'),
    level: document.getElementById('hud-level'),
    score: document.getElementById('hud-score'),
    time: document.getElementById('hud-time'),
    items: document.getElementById('hud-items')
};

// BOTONES
document.getElementById('btn-to-instructions').onclick = () => {
    screens.credits.classList.add('hidden');
    screens.instructions.classList.remove('hidden');
    document.getElementById('menu-highscore').textContent = highscore;
};

document.getElementById('btn-start').onclick = startGame;
document.getElementById('btn-restart').onclick = startGame;
document.getElementById('btn-next-level').onclick = startLevel2;

// CONTROLES
window.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    if (e.key === 'ArrowUp' || e.key === ' ') player.jump();
    if (e.key === 'ArrowDown') player.crouch(true);
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowDown') player.crouch(false);
});

// Táctil
const btnJump = document.getElementById('btn-mobile-jump');
const btnCrouch = document.getElementById('btn-mobile-crouch');

btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); player.jump(); });
btnCrouch.addEventListener('touchstart', (e) => { e.preventDefault(); player.crouch(true); });
btnCrouch.addEventListener('touchend', (e) => { e.preventDefault(); player.crouch(false); });

// PLATAFORMAS INICIALES
function initPlatforms() {
    if (level === 1) {
        platforms = [
            { x: 50, y: canvas.height - 90, width: 280, height: 70 },
            { x: 380, y: canvas.height - 110, width: 220, height: 90 },
            { x: 660, y: canvas.height - 80, width: 250, height: 60 }
        ];
    } else {
        // En nivel 2 es un río continuo de magma con olas/rocas
        platforms = [
            { x: 0, y: canvas.height - 40, width: canvas.width * 2, height: 40 }
        ];
    }
}

// INICIAR JUEGO (NIVEL 1)
function startGame() {
    level = 1;
    score = 0;
    timeElapsed = 0;
    itemsCollected = 0;
    gameSpeed = LEVELS[1].speed;
    animFrame = 0;
    
    obstacles = [];
    collectibles = [];
    initPlatforms();
    player.reset();

    screens.instructions.classList.add('hidden');
    screens.gameover.classList.add('hidden');
    screens.win.classList.add('hidden');
    hud.container.classList.remove('hidden');

    if (isMobile()) document.getElementById('mobile-controls').classList.remove('hidden');

    gameRunning = true;
    startTimer();
    requestAnimationFrame(gameLoop);
}

// INICIAR NIVEL 2 (BARCO)
function startLevel2() {
    level = 2;
    timeElapsed = 0;
    gameSpeed = LEVELS[2].speed;
    
    obstacles = [];
    collectibles = [];
    initPlatforms();
    player.reset();

    screens.win.classList.add('hidden');
    hud.container.classList.remove('hidden');

    gameRunning = true;
    startTimer();
    requestAnimationFrame(gameLoop);
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (gameRunning) {
            timeElapsed++;
            score += 15;

            // Llegada a la meta
            if (timeElapsed >= metaDistance) {
                winLevel();
            }
        }
    }, 1000);
}

// BUCLE PRINCIPAL
function gameLoop() {
    if (!gameRunning) return;

    animFrame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();
    updateAndDrawPlatforms();
    updatePlayerPhysics();
    player.draw();
    updateAndDrawObstacles();
    updateAndDrawCollectibles();
    drawLava();
    updateHUD();

    requestAnimationFrame(gameLoop);
}

// DIBUJAR FONDO
function drawBackground() {
    let grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, LEVELS[level].bgTop);
    grad.addColorStop(1, LEVELS[level].bgBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Siluetas volcánicas
    ctx.fillStyle = 'rgba(100, 20, 0, 0.4)';
    ctx.beginPath();
    ctx.moveTo(80, canvas.height - 50); ctx.lineTo(220, canvas.height - 220); ctx.lineTo(360, canvas.height - 50);
    ctx.fill();
}

// PLATAFORMAS
function updateAndDrawPlatforms() {
    for (let i = platforms.length - 1; i >= 0; i--) {
        let p = platforms[i];
        p.x -= gameSpeed;

        if (level === 1) {
            ctx.fillStyle = '#7a3b2e';
            ctx.fillRect(p.x, p.y, p.width, p.height);
            ctx.fillStyle = '#542419';
            ctx.fillRect(p.x, p.y, p.width, 10);
        }

        if (p.x + p.width < 0 && level === 1) {
            platforms.splice(i, 1);
        }
    }

    if (level === 1) {
        let lastPlat = platforms[platforms.length - 1];
        if (lastPlat && lastPlat.x + lastPlat.width < canvas.width + 100) {
            let gap = 80 + Math.random() * 90;
            let newWidth = 180 + Math.random() * 150;
            let newY = canvas.height - 70 - Math.random() * 80;

            platforms.push({
                x: lastPlat.x + lastPlat.width + gap,
                y: newY,
                width: newWidth,
                height: canvas.height - newY
            });
        }
    } else {
        // En nivel 2 mantiene el agua/magma infinito
        if (platforms[0].x < -canvas.width) platforms[0].x = 0;
    }
}

// FÍSICAS DE SOPORTE
function updatePlayerPhysics() {
    player.update();

    for (let p of platforms) {
        if (
            player.x + player.width > p.x &&
            player.x < p.x + p.width &&
            player.y + player.height >= p.y &&
            player.y + player.height <= p.y + 15 &&
            player.velocityY >= 0
        ) {
            player.y = p.y - player.height;
            player.velocityY = 0;
            player.jumpsLeft = 2;
        }
    }
}

// OBSTÁCULOS
function updateAndDrawObstacles() {
    if (Math.random() < (level === 1 ? 0.015 : 0.025)) {
        obstacles.push({
            x: canvas.width,
            y: level === 1 ? canvas.height - 95 : canvas.height - 65,
            width: 30,
            height: 30
        });
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.x -= gameSpeed;

        ctx.fillStyle = '#3a251e';
        ctx.beginPath();
        ctx.arc(obs.x + 15, obs.y + 15, 15, 0, Math.PI * 2);
        ctx.fill();

        if (
            player.x < obs.x + obs.width &&
            player.x + player.width > obs.x &&
            player.y < obs.y + obs.height &&
            player.y + player.height > obs.y
        ) {
            gameOver();
        }

        if (obs.x + obs.width < 0) obstacles.splice(i, 1);
    }
}

// COLECCIONABLES
function updateAndDrawCollectibles() {
    if (Math.random() < 0.02) {
        collectibles.push({
            x: canvas.width,
            y: canvas.height - 100 - Math.random() * 80,
            width: 16,
            height: 20
        });
    }

    for (let i = collectibles.length - 1; i >= 0; i--) {
        let c = collectibles[i];
        c.x -= gameSpeed;

        ctx.fillStyle = '#ff007f';
        ctx.beginPath();
        ctx.moveTo(c.x + 8, c.y);
        ctx.lineTo(c.x + 16, c.y + 10);
        ctx.lineTo(c.x + 8, c.y + 20);
        ctx.lineTo(c.x, c.y + 10);
        ctx.closePath(); ctx.fill();

        if (
            player.x < c.x + c.width &&
            player.x + player.width > c.x &&
            player.y < c.y + c.height &&
            player.y + player.height > c.y
        ) {
            score += 50;
            itemsCollected++;
            collectibles.splice(i, 1);
        } else if (c.x + c.width < 0) {
            collectibles.splice(i, 1);
        }
    }
}

// LAVA
function drawLava() {
    lavaOffset += 0.1;
    ctx.fillStyle = '#ff2200';
    ctx.fillRect(0, canvas.height - 25, canvas.width, 25);

    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 30) {
        let y = canvas.height - 25 + Math.sin(x * 0.05 + lavaOffset) * 4;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(canvas.width, canvas.height); ctx.lineTo(0, canvas.height); ctx.fill();
}

// INTERFAZ
function updateHUD() {
    hud.level.textContent = `${level}: ${LEVELS[level].name}`;
    hud.score.textContent = score;
    hud.time.textContent = `${timeElapsed}/${metaDistance}`;
    hud.items.textContent = itemsCollected;
}

// GANAR NIVEL
function winLevel() {
    gameRunning = false;
    clearInterval(timerInterval);

    const randomWinPhrase = WIN_PHRASES[Math.floor(Math.random() * WIN_PHRASES.length)];
    document.getElementById('win-phrase').textContent = `"${randomWinPhrase}"`;
    document.getElementById('win-score').textContent = score;
    document.getElementById('win-time').textContent = `${timeElapsed}s`;

    hud.container.classList.add('hidden');
    screens.win.classList.remove('hidden');
}

// GAME OVER
function gameOver() {
    gameRunning = false;
    clearInterval(timerInterval);

    if (score > highscore) {
        highscore = score;
        localStorage.setItem('purace_highscore', highscore);
    }

    const randomLosePhrase = LOSE_PHRASES[Math.floor(Math.random() * LOSE_PHRASES.length)];
    document.getElementById('lose-phrase').textContent = `"${randomLosePhrase}"`;
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-time').textContent = `${timeElapsed}s`;
    document.getElementById('final-items').textContent = itemsCollected;
    document.getElementById('final-highscore').textContent = highscore;

    hud.container.classList.add('hidden');
    document.getElementById('mobile-controls').classList.add('hidden');
    screens.gameover.classList.remove('hidden');
}

function isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 700;
}