const canvas = document.getElementById('tetris');
const ctx = canvas.getContext('2d');
const COLS = 10, ROWS = 20;
const BLOCK = 30;

const BOARD_X = 40;  
const BOARD_Y = 40;  
const SIDEBAR_X = 370; 

canvas.width = 530;   
canvas.height = 760; 

// ---------- STATUS DO JOGO ----------
let board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
let piece = null;
let nextPiece = null; 
let holdPiece = null; 
let canHold = true;   
let gameOver = false;
let isPaused = false; 
let score = 0;
let highScore = localStorage.getItem('tetrisHighScore') || 0; 
let level = 1; 
let dropInterval = 600; 
let animating = false;
let linesToClear = [];
let gameMode = 'normal'; 
let isGameRunning = false;
let deteriorationTimer = null;
let truckX = -80;
let blocksFlying = [];
let particles = [];
let popups = []; 
let lineClearScore = 0;

let trashStats = [0, 0, 0, 0]; 

const COLORS = ['#ff4757','#ffd93d','#2ed573','#1e90ff'];
const BIN_NAMES = ['Plástico','Metal','Vidro','Papel'];
const TRASH_ICONS = ['🥤', '🥫', '🍾', '📦'];
const CURIOSIDADES = [
  "PETRÓLEO POUPADO!", 
  "ENERGIA ECONOMIZADA!", 
  "100% RECICLADO!", 
  "ÁRVORES SALVAS!"
];

const BIN_SIZE = 46;
const BIN_X = [68, 134, 200, 266]; 
const BIN_Y = BOARD_Y + ROWS * BLOCK + 35;

const PIECES = [
  [[1,1,1,1]], 
  [[1,1],[1,1]], 
  [[0,1,0],[1,1,1]], 
  [[1,0,0],[1,1,1]], 
  [[0,0,1],[1,1,1]], 
  [[1,1,0],[0,1,1]], 
  [[0,1,1],[1,1,0]]  
];

let shapeBag = [];
let colorBag = [];
let curiosidadeAtual = ""; 

const CURIOSIDADES_GAME_OVER = [
  "A reciclagem de uma única lata de alumínio economiza energia suficiente para manter uma TV ligada por três horas!",
  "Reciclar papel consome 70% menos energia do que produzi-lo a partir da madeira.",
  "O vidro é 100% reciclável e pode ser reciclado infinitas vezes sem perder a qualidade.",
  "Para cada tonelada de papel reciclado, cerca de 22 árvores adultas são poupadas.",
  "No Modo Zen, você joga sem pressa. Ótimo para treinar e relaxar a mente!"
];

// --- FUNÇÕES DOS MENUS (INICIAL E PAUSA) ---
function showModes() {
  document.getElementById('menu-principal').classList.add('hidden');
  document.getElementById('menu-modos').classList.remove('hidden');
}

function showRules() {
  document.getElementById('menu-principal').classList.add('hidden');
  document.getElementById('menu-regras').classList.remove('hidden');
}

function backToMain() {
  document.getElementById('menu-modos').classList.add('hidden');
  document.getElementById('menu-regras').classList.add('hidden');
  document.getElementById('menu-principal').classList.remove('hidden');
}

function startGame(mode) {
  gameMode = mode;
  document.getElementById('main-menu').classList.add('hidden'); 
  restartGame(); 
  
  if (!isGameRunning) {
    isGameRunning = true;
    renderLoop();
  }
}

function restartCurrentMode() {
  togglePause();
  restartGame();
}

function goToModeSelection() {
  isPaused = true;
  document.getElementById('pause-menu').classList.add('hidden');
  document.getElementById('btn-pause-float').style.display = 'none';
  document.getElementById('main-menu').classList.remove('hidden');
  showModes();
}

function goToMainMenu() {
  isPaused = true;
  document.getElementById('pause-menu').classList.add('hidden');
  document.getElementById('btn-pause-float').style.display = 'none';
  document.getElementById('main-menu').classList.remove('hidden');
  backToMain();
}

// --- LÓGICA DO JOGO ---
function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex != 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

function getNextBagItem(bag, baseItems) {
  if (bag.length === 0) {
    bag.push(...baseItems);
    shuffle(bag);
  }
  return bag.pop();
}

function randomPiece() {
  const shapeIdx = getNextBagItem(shapeBag, [0, 1, 2, 3, 4, 5, 6]);
  const colorIdx = getNextBagItem(colorBag, [0, 0, 1, 1, 2, 2, 3, 3]); 
  
  return { 
    shape: PIECES[shapeIdx], 
    color: colorIdx, 
    x: Math.floor((COLS - PIECES[shapeIdx][0].length)/2), 
    y: 0 
  };
}

function isValid(shape, x, y) {
  for(let r=0; r<shape.length; r++)
    for(let c=0; c<shape[0].length; c++)
      if(shape[r][c]) {
        let nx = x+c, ny = y+r;
        if(nx<0 || nx>=COLS || ny>=ROWS || board[ny][nx]) return false;
      }
  return true;
}

function merge() {
  const { shape, color, x, y } = piece;
  for(let r=0; r<shape.length; r++)
    for(let c=0; c<shape[0].length; c++)
      if(shape[r][c]) board[y+r][x+c] = color+1;
  piece = null;
  checkLines();
}

function checkLines() {
  let lines = [];
  for(let r=0; r<ROWS; r++) {
    if(board[r].every(cell => cell !== 0)) {
      lines.push(r);
      let firstColor = board[r][0];
      let isCombo = board[r].every(cell => cell === firstColor);
      
      if (isCombo && firstColor > 0) {
        popups.push({
          x: BOARD_X + (COLS * BLOCK) / 2,
          y: BOARD_Y + r * BLOCK,
          text: `ECO-COMBO! ${CURIOSIDADES[firstColor-1]}`,
          color: COLORS[firstColor-1],
          life: 120
        });
        score += 500; 
      }
    }
  }
  
  if(lines.length === 0) { spawn(); return; }
  
  linesToClear = lines; 
  animating = true;
  truckX = -80; 
  blocksFlying = [];
  particles = [];
  lineClearScore = lines.length * 100 * lines.length; 
}

function spawn() {
  if(gameOver || isPaused) return;
  canHold = true; 

  if (!nextPiece) {
    piece = randomPiece();
    nextPiece = randomPiece();
  } else {
    piece = nextPiece;
    nextPiece = randomPiece();
  }
  if(!isValid(piece.shape, piece.x, piece.y)) {
    gameOver = true;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('tetrisHighScore', highScore);
    }
  }
}

function hold() {
  if (!canHold || animating || gameOver || isPaused || !piece) return;

  if (holdPiece === null) {
    holdPiece = { shape: piece.shape, color: piece.color };
    piece = null;
    spawn(); 
    canHold = false; 
  } else {
    let temp = { shape: piece.shape, color: piece.color };
    piece.shape = holdPiece.shape;
    piece.color = holdPiece.color;
    piece.x = Math.floor((COLS - piece.shape[0].length)/2); 
    piece.y = 0;
    
    holdPiece = temp;
    canHold = false; 
    
    if(!isValid(piece.shape, piece.x, piece.y)) {
      gameOver = true;
      if (score > highScore) {
        highScore = score;
        localStorage.setItem('tetrisHighScore', highScore);
      }
    }
  }
}

function drop(isSoftDrop = false) {
  if(!piece || animating || gameOver || isPaused) return false;
  
  if (gameMode === 'zen' && !isSoftDrop) return false;

  const ny = piece.y + 1;
  if(isValid(piece.shape, piece.x, ny)) {
    piece.y = ny;
    if (isSoftDrop) score += 1; 
    return true;
  } else {
    merge();
    return false;
  }
}

function hardDrop() {
  if(!piece || animating || gameOver || isPaused) return;
  let distance = 0;
  while(isValid(piece.shape, piece.x, piece.y + 1)) {
    piece.y++;
    distance++;
  }
  score += distance * 2; 
  merge();
}

function move(dir) {
  if(!piece || animating || gameOver || isPaused) return;
  const nx = piece.x + dir;
  if(isValid(piece.shape, nx, piece.y)) piece.x = nx;
}

function rotate() {
  if(!piece || animating || gameOver || isPaused) return;
  const shape = piece.shape;
  const rotated = shape[0].map((_, idx) => shape.map(row => row[idx]).reverse());
  
  if(isValid(rotated, piece.x, piece.y)) {
    piece.shape = rotated;
  } else if(isValid(rotated, piece.x - 1, piece.y)) {
    piece.x -= 1;
    piece.shape = rotated;
  } else if(isValid(rotated, piece.x + 1, piece.y)) {
    piece.x += 1;
    piece.shape = rotated;
  }
}

function updateDifficulty() {
  let newLevel = Math.floor(score / 1000) + 1; 
  
  if (gameMode === 'dificil') {
    newLevel = Math.floor(score / 500) + 1; 
  }

  if (newLevel > level) {
    level = newLevel;
    let limitador = gameMode === 'dificil' ? 60 : 50; 
    dropInterval = Math.max(80, 600 - (level - 1) * limitador); 
    clearInterval(window.gameTimer);
    window.gameTimer = setInterval(() => { drop(false); }, dropInterval);
  }
}

function togglePause() {
  if (gameOver) return;
  isPaused = !isPaused;
  
  const pauseMenu = document.getElementById('pause-menu');
  const btnPauseFloat = document.getElementById('btn-pause-float');

  if (isPaused) {
    pauseMenu.classList.remove('hidden');
    btnPauseFloat.style.display = 'none'; 
    clearInterval(window.gameTimer);      
  } else {
    pauseMenu.classList.add('hidden');
    btnPauseFloat.style.display = 'flex';
    clearInterval(window.gameTimer);
    window.gameTimer = setInterval(() => { drop(false); }, dropInterval); 
  }
}

// ----------------------------------------------------
// MOTOR DE GRAVIDADE E ANIMAÇÕES
// ----------------------------------------------------
if (window.gameTimer) clearInterval(window.gameTimer);
window.gameTimer = setInterval(() => { drop(false); }, dropInterval);

function addParticles(x, y, colorIdx, count=4) {
  for(let i=0; i<count; i++) {
    particles.push({
      x, y,
      vx: (Math.random()-0.5)*4,
      vy: (Math.random()-0.5)*4 - 1.5,
      life: 1, colorIdx: colorIdx, size: Math.random()*3+3,
      angle: Math.random() * Math.PI * 2, spin: (Math.random()-0.5)*0.2
    });
  }
}

function updateParticles() {
  for(let i=particles.length-1; i>=0; i--) {
    let p = particles[i];
    p.x += p.vx; 
    p.y += p.vy; 
    
    if (p.colorIdx === 3) {
      p.vy += 0.02; 
    } else {
      p.vy += 0.08; 
    }
    
    p.angle += p.spin; 
    p.life -= 0.04;
    
    if(p.life <= 0) particles.splice(i,1);
  }
}

function updateAnimation() {
  if(!animating) return;
  
  truckX += 6.5; 
  for (let row of linesToClear) {
    for(let c = 0; c < COLS; c++) {
      let blockCanvasX = BOARD_X + c * BLOCK + BLOCK/2;
      if (truckX + 20 > blockCanvasX) {
        if(!blocksFlying.some(b => b.c === c && b.r === row)) {
          let colorIdx = board[row][c] - 1;
          if(colorIdx >= 0) {
            trashStats[colorIdx]++;
            blocksFlying.push({
              c: c, 
              r: row, 
              x: blockCanvasX, 
              y: BOARD_Y + row * BLOCK + BLOCK/2,
              colorIdx: colorIdx, 
              targetX: BIN_X[colorIdx] + BIN_SIZE/2, 
              targetY: BIN_Y + BIN_SIZE/2, 
              progress: 0
            });
          }
        }
      }
    }
  }
  
  let allDone = (truckX > BOARD_X + COLS * BLOCK + 60);
  for(let b of blocksFlying) {
    if(b.progress < 1) {
      b.progress += 0.06; 
      if(b.progress > 1) b.progress = 1;
      if(b.progress < 1) allDone = false;
      if(Math.random() < 0.2) {
        addParticles(b.x + (b.targetX - b.x) * b.progress, b.y + (b.targetY - b.y) * b.progress - 40 * Math.sin(b.progress * Math.PI), b.colorIdx, 1);
      }
    }
  }
  
  if(allDone) {
    linesToClear.sort((a,b)=>b-a);
    for(let row of linesToClear) { 
      board.splice(row, 1); 
    }
    for(let i = 0; i < linesToClear.length; i++) { 
      board.unshift(Array(COLS).fill(0)); 
    }
    
    score += lineClearScore;
    updateDifficulty(); 
    
    animating = false; 
    linesToClear = []; 
    blocksFlying = [];
    spawn();
  }
}

function drawParticles() {
  for(let p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = COLORS[p.colorIdx];
    ctx.strokeStyle = COLORS[p.colorIdx];
    ctx.lineWidth = 2;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.beginPath();
    
    if (p.colorIdx === 0) { 
      ctx.arc(0, 0, p.size, 0, Math.PI*2); 
      ctx.stroke(); 
    } else if (p.colorIdx === 1) { 
      ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size); 
    } else if (p.colorIdx === 2) { 
      ctx.moveTo(0, -p.size); 
      ctx.lineTo(p.size, p.size); 
      ctx.lineTo(-p.size, p.size); 
      ctx.fill(); 
    } else { 
      ctx.fillRect(-p.size, -p.size/2, p.size*2, p.size); 
    }
    
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawPopups() {
  for(let i = popups.length - 1; i >= 0; i--) {
    let p = popups[i];
    ctx.globalAlpha = Math.min(1, p.life / 30); 
    ctx.fillStyle = p.color;
    ctx.font = 'bold 16px "Orbitron", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillText(p.text, p.x, p.y);

    if(!isPaused) { 
      p.y -= 0.5; 
      p.life--;
      if(p.life <= 0) popups.splice(i, 1);
    }
  }
  ctx.globalAlpha = 1;
}

function drawBlock(x, y, colorIdx, isGhost=false) {
  let px = BOARD_X + x*BLOCK;
  let py = BOARD_Y + y*BLOCK;
  
  if(isGhost) {
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = COLORS[colorIdx];
    ctx.fillRect(px+2, py+2, BLOCK-4, BLOCK-4);
    ctx.globalAlpha = 1;
    return;
  }

  ctx.fillStyle = '#fff';
  ctx.font = '26px "Segoe UI Emoji", sans-serif'; 
  ctx.textAlign = 'center'; 
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; 
  ctx.shadowBlur = 4; 
  ctx.fillText(TRASH_ICONS[colorIdx], px + BLOCK/2, py + BLOCK/2 + 2);
  ctx.shadowBlur = 0; 
}

function drawBoard() {
  ctx.fillStyle = 'rgba(15, 20, 30, 0.7)'; 
  ctx.fillRect(BOARD_X, BOARD_Y, COLS*BLOCK, ROWS*BLOCK);
  
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'; 
  ctx.lineWidth = 1; 
  ctx.beginPath();
  
  for(let c=1; c<COLS; c++) { 
    let lx = BOARD_X + c*BLOCK + 0.5; 
    ctx.moveTo(lx, BOARD_Y); 
    ctx.lineTo(lx, BOARD_Y + ROWS*BLOCK); 
  }
  for(let r=1; r<ROWS; r++) { 
    let ly = BOARD_Y + r*BLOCK + 0.5; 
    ctx.moveTo(BOARD_X, ly); 
    ctx.lineTo(BOARD_X + COLS*BLOCK, ly); 
  }
  ctx.stroke();

  for(let r=0; r<ROWS; r++) {
    for(let c=0; c<COLS; c++) {
      if(board[r][c]) {
        let isCollected = false;
        if (animating && linesToClear.includes(r)) { 
          if (truckX + 20 > BOARD_X + c * BLOCK + BLOCK/2) isCollected = true; 
        }
        if(!isCollected) drawBlock(c, r, board[r][c]-1, false);
      }
    }
  }
  ctx.strokeStyle = '#3d4c70'; 
  ctx.lineWidth = 2; 
  ctx.strokeRect(BOARD_X, BOARD_Y, COLS*BLOCK, ROWS*BLOCK);
}

function drawPiece() {
  if(!piece || animating) return;
  const { shape, color, x, y } = piece;
  
  let ghostY = y;
  while(isValid(shape, x, ghostY + 1)) ghostY++;
  
  for(let r=0; r<shape.length; r++)
    for(let c=0; c<shape[0].length; c++)
      if(shape[r][c]) drawBlock(x+c, ghostY+r, color, true);

  for(let r=0; r<shape.length; r++)
    for(let c=0; c<shape[0].length; c++)
      if(shape[r][c]) drawBlock(x+c, y+r, color, false);
}

function drawSidebar() {
  ctx.fillStyle = '#111724'; 
  ctx.beginPath(); 
  ctx.roundRect(SIDEBAR_X, BOARD_Y, 120, 130, 8); 
  ctx.fill();
  ctx.strokeStyle = '#2a3553'; 
  ctx.lineWidth = 2; 
  ctx.stroke();
  ctx.textAlign = 'center';
  
  ctx.fillStyle = '#8f9bb3'; 
  ctx.font = '800 12px "Orbitron", sans-serif'; 
  ctx.fillText('RECORDE', SIDEBAR_X + 60, BOARD_Y + 20);
  
  ctx.fillStyle = '#f39c12'; 
  ctx.font = 'bold 18px "Rajdhani", sans-serif'; 
  ctx.fillText(highScore, SIDEBAR_X + 60, BOARD_Y + 38);
  
  ctx.fillStyle = '#8f9bb3'; 
  ctx.font = '800 12px "Orbitron", sans-serif'; 
  ctx.fillText('PONTOS', SIDEBAR_X + 60, BOARD_Y + 65);
  
  ctx.fillStyle = '#fff'; 
  ctx.font = 'bold 22px "Rajdhani", sans-serif'; 
  ctx.fillText(score, SIDEBAR_X + 60, BOARD_Y + 85);
  
  ctx.fillStyle = '#8f9bb3'; 
  ctx.font = '800 12px "Orbitron", sans-serif'; 
  ctx.fillText('NÍVEL', SIDEBAR_X + 60, BOARD_Y + 110);
  
  ctx.fillStyle = '#2ed573'; 
  ctx.font = 'bold 16px "Rajdhani", sans-serif'; 
  ctx.fillText(level, SIDEBAR_X + 60, BOARD_Y + 125);

  const NEXT_Y = BOARD_Y + 145;
  ctx.fillStyle = '#111724'; 
  ctx.beginPath(); 
  ctx.roundRect(SIDEBAR_X, NEXT_Y, 120, 110, 8); 
  ctx.fill();
  ctx.strokeStyle = '#2a3553'; 
  ctx.lineWidth = 2; 
  ctx.stroke();
  ctx.fillStyle = '#8f9bb3'; 
  ctx.font = '800 12px "Orbitron", sans-serif'; 
  ctx.fillText('PRÓXIMO', SIDEBAR_X + 60, NEXT_Y + 25);

  if (nextPiece) {
    const shape = nextPiece.shape; 
    const pSize = 22; 
    const startX = SIDEBAR_X + (120 - shape[0].length * pSize) / 2;
    const startY = NEXT_Y + 35 + (75 - shape.length * pSize) / 2;
    
    for(let r=0; r<shape.length; r++) {
      for(let c=0; c<shape[0].length; c++) {
        if(shape[r][c]) {
          ctx.fillStyle = '#fff'; 
          ctx.font = '18px "Segoe UI Emoji", sans-serif';
          ctx.textAlign = 'center'; 
          ctx.textBaseline = 'middle';
          ctx.fillText(TRASH_ICONS[nextPiece.color], startX + c*pSize + pSize/2, startY + r*pSize + pSize/2 + 2);
        }
      }
    }
  }

  const HOLD_Y = NEXT_Y + 125;
  ctx.fillStyle = '#111724'; 
  ctx.beginPath(); 
  ctx.roundRect(SIDEBAR_X, HOLD_Y, 120, 110, 8); 
  ctx.fill();
  ctx.strokeStyle = '#2a3553'; 
  ctx.lineWidth = 2; 
  ctx.stroke();
  ctx.fillStyle = '#8f9bb3'; 
  ctx.font = '800 12px "Orbitron", sans-serif'; 
  ctx.fillText('GUARDAR', SIDEBAR_X + 60, HOLD_Y + 25);

  if (holdPiece) {
    const shape = holdPiece.shape; 
    const pSize = 22; 
    const startX = SIDEBAR_X + (120 - shape[0].length * pSize) / 2;
    const startY = HOLD_Y + 35 + (75 - shape.length * pSize) / 2;
    
    ctx.globalAlpha = canHold ? 1 : 0.3; 
    
    for(let r=0; r<shape.length; r++) {
      for(let c=0; c<shape[0].length; c++) {
        if(shape[r][c]) {
          ctx.fillStyle = '#fff'; 
          ctx.font = '18px "Segoe UI Emoji", sans-serif';
          ctx.textAlign = 'center'; 
          ctx.textBaseline = 'middle';
          ctx.fillText(TRASH_ICONS[holdPiece.color], startX + c*pSize + pSize/2, startY + r*pSize + pSize/2 + 2);
        }
      }
    }
    ctx.globalAlpha = 1; 
  }
}

function drawBins() {
  for(let i=0; i<4; i++) {
    let bx = BIN_X[i]; 
    let by = BIN_Y;
    
    ctx.fillStyle = COLORS[i]; 
    ctx.beginPath(); 
    ctx.moveTo(bx + 4, by + 8); 
    ctx.lineTo(bx + BIN_SIZE - 4, by + 8); 
    ctx.lineTo(bx + BIN_SIZE - 8, by + BIN_SIZE); 
    ctx.lineTo(bx + 8, by + BIN_SIZE); 
    ctx.fill();
    
    ctx.beginPath(); 
    ctx.roundRect(bx, by, BIN_SIZE, 6, 2); 
    ctx.fill(); 
    ctx.fillRect(bx + BIN_SIZE/2 - 6, by - 4, 12, 4);
    
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; 
    ctx.fillRect(bx + 14, by + 12, 2, BIN_SIZE - 16); 
    ctx.fillRect(bx + 22, by + 12, 2, BIN_SIZE - 16); 
    ctx.fillRect(bx + 30, by + 12, 2, BIN_SIZE - 16);
    
    ctx.fillStyle = '#8f9bb3'; 
    ctx.font = '800 11px "Orbitron", sans-serif'; 
    ctx.textAlign = 'center'; 
    ctx.textBaseline = 'bottom'; 
    ctx.fillText(BIN_NAMES[i].toUpperCase(), bx+BIN_SIZE/2, by-8);
    
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; 
    ctx.font = '18px sans-serif'; 
    ctx.textBaseline = 'middle'; 
    ctx.fillText('♻', bx+BIN_SIZE/2, by+BIN_SIZE/2 + 6);

    let panelY = by + BIN_SIZE + 8;
    ctx.fillStyle = '#0a0e14'; 
    ctx.beginPath(); 
    ctx.roundRect(bx - 5, panelY, BIN_SIZE + 10, 20, 4); 
    ctx.fill();
    
    ctx.strokeStyle = COLORS[i]; 
    ctx.lineWidth = 1; 
    ctx.stroke();
    
    ctx.fillStyle = COLORS[i]; 
    ctx.font = 'bold 14px "Orbitron", monospace'; 
    ctx.fillText(trashStats[i].toString().padStart(3, '0'), bx+BIN_SIZE/2, panelY + 11);
  }
  ctx.textBaseline = 'alphabetic'; 
}

function drawTrucks() {
  if (!animating) return;
  for (let row of linesToClear) {
    const ty = BOARD_Y + row * BLOCK + 3;
    ctx.save(); 
    ctx.fillStyle = '#ecf0f1'; 
    ctx.fillRect(truckX - 22, ty, 44, 18); 
    ctx.fillStyle = '#bdc3c7'; 
    ctx.fillRect(truckX + 12, ty - 2, 12, 20); 
    ctx.fillStyle = '#3498db'; 
    ctx.fillRect(truckX + 15, ty + 1, 7, 7); 
    ctx.fillStyle = '#2ecc71'; 
    ctx.fillRect(truckX - 20, ty + 2, 16, 14); 
    ctx.fillStyle = '#2c3e50'; 
    ctx.beginPath(); 
    ctx.arc(truckX - 12, ty + 18, 4, 0, Math.PI*2); 
    ctx.arc(truckX + 6, ty + 18, 4, 0, Math.PI*2); 
    ctx.fill(); 
    ctx.restore();
  }
}

function drawFlyingBlocks() {
  for(let b of blocksFlying) {
    let t = b.progress; 
    if(t <= 0) continue;
    
    let cx = b.x + (b.targetX - b.x) * t; 
    let cy = b.y + (b.targetY - b.y) * t - 45 * Math.sin(t * Math.PI);
    
    ctx.fillStyle = '#fff'; 
    ctx.font = '20px "Segoe UI Emoji", sans-serif'; 
    ctx.textAlign = 'center'; 
    ctx.textBaseline = 'middle'; 
    ctx.fillText(TRASH_ICONS[b.colorIdx], cx, cy);
  }
}

// ----------------------------------------------------
// GERENCIADOR DE INPUTS (BOTÕES)
// ----------------------------------------------------
function bindUniversalButton(id, action, continuous = false) {
  const btn = document.getElementById(id);
  let interval, timeout;

  const startAction = (e) => {
    if(e.type === 'touchstart') e.preventDefault(); 
    clearTimeout(timeout); 
    clearInterval(interval);
    
    action();
    if (continuous) { 
      timeout = setTimeout(() => { interval = setInterval(action, 70); }, 150); 
    }
  };

  const stopAction = (e) => {
    if(e && e.type === 'touchend') e.preventDefault();
    clearTimeout(timeout); 
    clearInterval(interval);
  };

  btn.addEventListener('touchstart', startAction, {passive: false}); 
  btn.addEventListener('touchend', stopAction, {passive: false}); 
  btn.addEventListener('touchcancel', stopAction, {passive: false});
  btn.addEventListener('mousedown', startAction); 
  btn.addEventListener('mouseup', stopAction); 
  btn.addEventListener('mouseleave', stopAction);
}

bindUniversalButton('btn-left', () => move(-1), true);
bindUniversalButton('btn-right', () => move(1), true);
bindUniversalButton('btn-down', () => drop(true), true); 
bindUniversalButton('btn-up', rotate, false);
bindUniversalButton('btn-rotate', rotate, false);
bindUniversalButton('btn-drop', hardDrop, false);
bindUniversalButton('btn-hold', hold, false); 
bindUniversalButton('btn-pause-float', togglePause, false);

document.addEventListener('keydown', e => {
  if(e.key === 'ArrowLeft') move(-1);
  if(e.key === 'ArrowRight') move(1);
  if(e.key === 'ArrowDown') drop(true);
  if(e.key === 'ArrowUp') rotate();
  if(e.key === ' ') { e.preventDefault(); hardDrop(); }
  if(e.key === 'Shift' || e.key.toLowerCase() === 'c') hold();
  if(e.key.toLowerCase() === 'p' || e.key === 'Escape') togglePause(); 
});

// ----------------------------------------------------
// GERENCIADOR DE INPUTS (TOQUE NA TELA / SWIPE)
// ----------------------------------------------------
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
const SWIPE_THRESHOLD = 50; 

// Garante que o Game Over feche clicando ou tocando em qualquer lugar do canvas
canvas.addEventListener('pointerdown', (e) => {
  if (gameOver) {
    restartGame();
  }
});

canvas.addEventListener('touchstart', (e) => {
  if (gameOver) return;
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, {passive: true});

canvas.addEventListener('touchend', (e) => {
  if (gameOver) return;
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipe();
}, {passive: true});

function handleSwipe() {
  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;

  if (Math.abs(diffX) < SWIPE_THRESHOLD && Math.abs(diffY) < SWIPE_THRESHOLD) {
    rotate();
    return;
  }

  if (Math.abs(diffX) > Math.abs(diffY)) {
    if (diffX > 0) {
      move(1); 
    } else {
      move(-1); 
    }
  } else {
    if (diffY > 0) {
      hardDrop(); 
    } else {
      hold(); 
    }
  }
}

// ----------------------------------------------------
// FUNÇÃO DE REINÍCIO
// ----------------------------------------------------
function restartGame() {
  board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
  piece = null; nextPiece = null; holdPiece = null; 
  gameOver = false;
  trashStats = [0, 0, 0, 0];
  shapeBag = []; colorBag = []; 
  canHold = true;
  animating = false; linesToClear = []; blocksFlying = []; 
  particles = []; popups = [];
  isPaused = false;
  
  document.getElementById('pause-menu').classList.add('hidden');
  document.getElementById('btn-pause-float').style.display = 'flex';

  curiosidadeAtual = CURIOSIDADES_GAME_OVER[Math.floor(Math.random() * CURIOSIDADES_GAME_OVER.length)];

  if (gameMode === 'rapido') {
    score = 0;
    level = 8;
    dropInterval = 250;
  } else if (gameMode === 'zen') {
    score = 0;
    level = 1;
    dropInterval = 999999; 
  } else {
    score = 0; 
    level = 1; 
    dropInterval = 600;
  }

  if (deteriorationTimer) clearInterval(deteriorationTimer);
  if (gameMode === 'deteriorar') {
    deteriorationTimer = setInterval(() => {
      if (isPaused || gameOver || animating) return;
      let occupied = [];
      for (let r=0; r<ROWS; r++) {
         for (let c=0; c<COLS; c++) {
            if (board[r][c] !== 0) occupied.push({r, c});
         }
      }
      if (occupied.length > 0) {
         let target = occupied[Math.floor(Math.random() * occupied.length)];
         board[target.r][target.c] = 0; 
         addParticles(BOARD_X + target.c*BLOCK + BLOCK/2, BOARD_Y + target.r*BLOCK + BLOCK/2, 0, 6);
      }
    }, 5000); 
  }

  clearInterval(window.gameTimer);
  window.gameTimer = setInterval(() => { drop(false); }, dropInterval);
  spawn();
}

// ----------------------------------------------------
// RENDERIZAÇÃO
// ----------------------------------------------------
function renderLoop() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  
  if (!isPaused) {
    updateAnimation();
    updateParticles();
  }
  
  drawBoard();
  drawPiece();
  drawSidebar();
  drawBins();
  drawTrucks(); 
  drawFlyingBlocks();
  drawParticles();
  drawPopups();
  
  if(gameOver) {
    ctx.fillStyle = 'rgba(10, 15, 25, 0.98)'; 
    ctx.fillRect(0,0,canvas.width,canvas.height);
    
    ctx.fillStyle = '#ff4757'; 
    ctx.font = 'bold 36px "Orbitron", sans-serif'; 
    ctx.textAlign = 'center'; 
    ctx.fillText('DIAGNÓSTICO', canvas.width/2, 120);
    
    ctx.fillStyle = '#fff'; 
    ctx.font = '18px "Rajdhani", sans-serif'; 
    ctx.fillText('Seu impacto ambiental final:', canvas.width/2, 160);
    
    const statsY = 220;
    ctx.font = '18px "Rajdhani", sans-serif'; 
    
    ctx.fillStyle = COLORS[0]; 
    ctx.fillText(`🥤 Plástico: ${trashStats[0]} un`, canvas.width/2, statsY);
    
    ctx.fillStyle = COLORS[1]; 
    ctx.fillText(`🥫 Metal: ${trashStats[1]} un`, canvas.width/2, statsY + 40);
    
    ctx.fillStyle = COLORS[2]; 
    ctx.fillText(`🍾 Vidro: ${trashStats[2]} un`, canvas.width/2, statsY + 80);
    
    ctx.fillStyle = COLORS[3]; 
    ctx.fillText(`📦 Papel: ${trashStats[3]} un`, canvas.width/2, statsY + 120);

    ctx.fillStyle = '#f39c12'; 
    ctx.font = 'bold 26px "Orbitron", sans-serif'; 
    ctx.fillText(`PONTOS TOTAIS: ${score}`, canvas.width/2, statsY + 190);
    
    const curiosidadeY = statsY + 240;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.roundRect(canvas.width/2 - 220, curiosidadeY, 440, 110, 10);
    ctx.fill();

    ctx.fillStyle = '#eee';
    ctx.font = 'italic 16px "Rajdhani", sans-serif';
    
    wrapText(ctx, curiosidadeAtual, canvas.width/2, curiosidadeY + 30, 400, 22);

    ctx.fillStyle = '#2ed573'; 
    ctx.font = 'bold 20px "Rajdhani", sans-serif'; 
    ctx.fillText('Toque AQUI na tela para reiniciar!', canvas.width/2, canvas.height - 80);
  }
  
  requestAnimationFrame(renderLoop);
}

// ----------------------------------------------------
// FUNÇÃO AUXILIAR DE TEXTO
// ----------------------------------------------------
function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  context.textAlign = 'center';

  for(let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = context.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  context.fillText(line, x, y);
}

// --- INICIALIZAÇÃO DO JOGO ---
spawn();
renderLoop();