// ================= إعدادات الصوت والموسيقى =================
const bgMusic = document.getElementById('bgMusic');
const musicBtn = document.getElementById('musicToggleBtn');
bgMusic.volume = 0.3;

function initApp() {
    showScreen('hub');
    playSfx('thwip');
    bgMusic.play().catch(error => {
        console.log("المتصفح منع التشغيل التلقائي، اضغط على زر التشغيل بالأسفل.");
    });
}

function toggleMusic() {
    if (bgMusic.paused) { bgMusic.play(); musicBtn.innerText = '⏸️'; } 
    else { bgMusic.pause(); musicBtn.innerText = '▶️'; }
}

function updateVolume() { bgMusic.volume = document.getElementById('volumeSlider').value; }

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSfx(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    
    if(type === 'thwip') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    } 
    else if (type === 'error') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime); gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    }
    else if (type === 'bounce') {
        osc.type = 'square'; osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    }
}

// ================= منع سحب الشاشة في الجوال (بدون تعطيل الأزرار) =================
// المشكلة سابقاً: كان يتم استدعاء preventDefault() على أي touchstart داخل حاوية اللعبة،
// وهذا يشمل أزرار "أعد المرحلة" و"القائمة" الموجودة فوق الشاشة، فيمنع المتصفح (خصوصاً آيفون)
// من إطلاق حدث click بعدها فتظل الأزرار ميتة باللمس. الحل: نتجاهل preventDefault إذا كان
// اللمس على زر أو أي عنصر تفاعلي داخل شاشة النتيجة (overlay-screen).
const preventScroll = (e) => {
    if (e.target.closest('button, a, .overlay-screen, input')) return;
    e.preventDefault();
};
document.querySelectorAll('canvas, .game-canvas-container').forEach(el => {
    el.addEventListener('touchstart', preventScroll, { passive: false });
});

// ================= صور احتياطية عند فشل تحميل أي صورة (لتفادي ظهور أيقونة/كلمة مكسورة) =================
const FALLBACK_LOGO_SVG = "data:image/svg+xml;utf8," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>" +
    "<circle cx='60' cy='60' r='56' fill='#E23636' stroke='#000' stroke-width='4'/>" +
    "<g fill='none' stroke='#fff' stroke-width='3'>" +
    "<path d='M60 10 V110 M10 60 H110 M22 22 L98 98 M98 22 L22 98'/>" +
    "<circle cx='60' cy='60' r='20'/><circle cx='60' cy='60' r='36'/>" +
    "</g><circle cx='60' cy='60' r='9' fill='#000'/>" +
    "</svg>"
);
function attachImageFallbacks() {
    document.querySelectorAll('img').forEach(img => {
        img.addEventListener('error', function onErr() {
            if (this.dataset.fallbackApplied) return;
            this.dataset.fallbackApplied = '1';
            this.src = FALLBACK_LOGO_SVG;
            this.removeEventListener('error', onErr);
        });
        // إن كانت الصورة قد فشلت بالفعل قبل ربط المستمع
        if (img.complete && img.naturalWidth === 0) img.dispatchEvent(new Event('error'));
    });
}
document.addEventListener('DOMContentLoaded', attachImageFallbacks);

// الصور الأساسية المشتركة
const spideyImg = new Image();
spideyImg.src = "https://cdn-icons-png.flaticon.com/512/1090/1090806.png";

// متغيرات عامة
let arcadeFrame, breakerFrame, quizInterval;
let isGoblinGameActive = false, goblinFrame;

// ================= التنقل بين الشاشات =================
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('mainHeader').style.display = (id === 'splash') ? 'none' : 'flex';
    
    clearInterval(quizInterval); 
    cancelAnimationFrame(arcadeFrame); 
    cancelAnimationFrame(breakerFrame);

    isGoblinGameActive = false;
    cancelAnimationFrame(goblinFrame);
    if(typeof goblinSpawnTimer !== 'undefined') clearTimeout(goblinSpawnTimer);
}

// ================= اللعبة الأولى: سجلات سبايدرمان (بنك أسئلة دسم) =================
const questionBank = [
    { q: "ما هو الاسم الحقيقي لسبايدرمان؟", options: ["بيتر باركر", "هاري أوزبورن", "إدي بروك", "فلاش طومسون"], correct: 0 },
    { q: "متى ظهر سبايدرمان لأول مرة بالكوميكس؟", options: ["1952", "1962", "1972", "1982"], correct: 1 },
    { q: "من هم مبتكرو شخصية سبايدرمان؟", options: ["ستان لي وستيف ديتكو", "جاك كيربي", "تود ماكفارلين", "جون روميتا"], correct: 0 },
    { q: "من أدى دور سبايدرمان في ثلاثية سام رايمي (2002)؟", options: ["أندرو جارفيلد", "توم هولاند", "توبي ماجواير", "كريستيان بيل"], correct: 2 },
    { q: "ما هو اسم الصحيفة التي يعمل بها بيتر باركر كمصور؟", options: ["نيويورك تايمز", "ديلي بيوجل", "ديلي بلانيت", "ذا جلوب"], correct: 1 },
    { q: "من هو مدير بيتر باركر الغاضب دائماً في الصحيفة؟", options: ["نورمان أوزبورن", "جي جونا جيمسون", "بن يوريك", "روبي روبرتسون"], correct: 1 },
    { q: "ما هي المقولة الشهيرة للعم بن؟", options: ["لا تستسلم أبداً", "مع القوة العظيمة تأتي مسؤولية عظيمة", "العدالة فوق الجميع", "الخوف هو عدوك الأول"], correct: 1 },
    { q: "ما هو الاسم الحقيقي للشرير (Green Goblin)؟", options: ["أوتو أوكتافيوس", "إدي بروك", "نورمان أوزبورن", "كليتوس كاسادي"], correct: 2 },
    { q: "من كان أول مضيف لـ (السمبيوت) الأسود قبل إدي بروك؟", options: ["هاري أوزبورن", "فلاش طومسون", "بيتر باركر", "ماك جارجان"], correct: 2 },
    { q: "ما هو اسم شخصية سبايدرمان في عالم (Spider-Verse) الموازي؟", options: ["بيتر بوركر", "مايلز موراليس", "ميغيل أوهارا", "بن رايلي"], correct: 1 },
    { q: "أين وقعت الحادثة المأساوية لوفاة جوين ستيسي بالكوميكس؟", options: ["برج إمباير ستيت", "جسر جورج واشنطن", "تمثال الحرية", "مقر الأوزكورب"], correct: 1 },
    { q: "من هو الشرير الذي يمتلك أذرع آلية معدنية؟", options: ["فولتشور", "ميستيريو", "دكتور أكتوبوس", "ساندامان"], correct: 2 },
    { q: "ما اسم عمة بيتر باركر التي ربته؟", options: ["العمة ماري", "العمة ماي", "العمة آنا", "العمة هيلين"], correct: 1 },
    { q: "من أسس فريق الأشرار (الستة الأشرار - Sinister Six)؟", options: ["جرين غوبلين", "دكتور أكتوبوس", "ميستيريو", "كينج بن"], correct: 1 },
    { q: "ما هو هدف الشرير (كرافن الصياد) الأساسي؟", options: ["سرقة البنوك", "ح حكم نيويورك", "اصطياد سبايدرمان", "تدمير الأفينجرز"], correct: 2 },
    { q: "ما هو اسم اللصة الماهرة التي تتقاطع طرقها دائماً مع سبايدرمان؟", options: ["القطة السوداء", "سيلفر سابل", "إليكترا", "ماري جين"], correct: 0 },
    { q: "من هو سبايدرمان المستقبلي في عام 2099؟", options: ["مايلز موراليس", "ميغيل أوهارا", "بيتر باركر", "بين رايلي"], correct: 1 },
    { q: "ما هي المهنة الأساسية لـ بيتر باركر في معظم القصص؟", options: ["محامي", "مصور علمي/صحفي", "طبيب", "مهندس معماري"], correct: 1 },
    { q: "كيف حصل بيتر باركر على قواه الخارقة؟", options: ["تجربة علمية", "لدغة عنكبوت مشع", "طفرة جينية", "بدلة تكنولوجية"], correct: 1 },
    { q: "من هو أقرب أصدقاء بيتر باركر في الجامعة والذي أصبح عدوه لاحقاً؟", options: ["فلاش طومسون", "هاري أوزبورن", "إدي بروك", "جون جيمسون"], correct: 1 },
    { q: "ما اسم شركة نورمان أوزبورن الصناعية الشهيرة؟", options: ["ستارك إندستريز", "أوزكورب", "هاموند إندستريز", "روكسون"], correct: 1 },
    { q: "من هو (فينوم) قبل أن يصبح شريراً منفصلاً؟", options: ["سمبيوت لاصق ببيتر باركر", "روبوت آلي", "متحور جيني", "شقيق بيتر"], correct: 0 },
    { q: "ما هو اسم عمود الأخبار الذي يظهر فيه سبايدرمان كمصور غالباً؟", options: ["الصفحة الأولى", "الشائعات اليومية", "أخبار الجريمة", "الرأي العام"], correct: 0 },
    { q: "من هو الشرير الذي يتحكم بالرمال ويستطيع تغيير شكل جسده؟", options: ["رينو", "ساندمان", "شوكر", "فيتشر"], correct: 1 },
    { q: "ما اسم أول فيلم متحرك حصل على أوسكار لسبايدرمان؟", options: ["Into the Spider-Verse", "Homecoming", "Far From Home", "No Way Home"], correct: 0 },
    { q: "من هي أول حبيبة رسمية لبيتر باركر بالكوميكس؟", options: ["ماري جين", "جوين ستيسي", "القطة السوداء", "ليز آلان"], correct: 1 },
    { q: "ما هو لقب أوتو أوكتافيوس الشرير؟", options: ["دكتور أوكتوبوس", "الوحش الأخضر", "الصقر", "الظل"], correct: 0 },
    { q: "أي مدينة يقطنها سبايدرمان بشكل أساسي؟", options: ["شيكاغو", "نيويورك", "لوس أنجلوس", "بوسطن"], correct: 1 },
    { q: "من هو الممثل الذي أدى دور سبايدرمان في أفلام مارفل السينمائية الحديثة (MCU)؟", options: ["توم هولاند", "توبي ماجواير", "أندرو جارفيلد", "زاك إفرون"], correct: 0 }
];

let qIndex = 0, quizScore = 0, quizTime = 15, activeQ = [];
const QUESTIONS_PER_ROUND = 10;

function startTrivia() {
    const pool = [...questionBank].sort(() => Math.random() - 0.5);
    activeQ = pool.slice(0, Math.min(QUESTIONS_PER_ROUND, pool.length));
    qIndex = 0; quizScore = 0; document.getElementById('quizScore').innerText = quizScore;
    document.getElementById('timerTrackUI').style.display = 'block'; 
    showScreen('trivia'); loadNextQuestion();
}

function loadNextQuestion() {
    clearInterval(quizInterval);
    
    if(qIndex >= activeQ.length) {
        document.getElementById('timerTrackUI').style.display = 'none';
        const maxScore = activeQ.length * 10;
        let rank = quizScore >= maxScore * 0.7 ? "خبير كوميكس! 🕷️🌟" : "تحتاج قراءة المزيد! 📚";
        document.getElementById('qText').innerHTML = `انتهى التحدي!<br><br><span style="font-size:3rem; color:var(--marvel-red);">${quizScore}</span><br><div style="color:var(--marvel-gold); margin-top:10px;">${rank}</div>`;
        document.getElementById('qOptions').innerHTML = `<button class="btn-comic" style="width:100%" onclick="playSfx('thwip'); showScreen('hub')">العودة للرئيسية</button>`;
        return;
    }

    const q = activeQ[qIndex];
    document.getElementById('qText').innerHTML = `<span style="color:#aaa; font-size:1rem; display:block; margin-bottom:10px;">السؤال ${qIndex + 1} / ${activeQ.length}</span>${q.q}`;
    
    const opts = document.getElementById('qOptions'); opts.innerHTML = '';
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button'); btn.className = 'opt-btn'; btn.innerText = opt;
        btn.onclick = () => handleAnswer(btn, i, q.correct); opts.appendChild(btn);
    });

    quizTime = 15; 
    document.getElementById('timerFill').style.width = '100%';

    quizInterval = setInterval(() => {
        quizTime--; document.getElementById('timerFill').style.width = (quizTime / 15 * 100) + '%';
        if(quizTime <= 0) handleAnswer(null, -1, q.correct);
    }, 1000);
}

function handleAnswer(btn, selected, correct) {
    clearInterval(quizInterval);
    if(btn) playSfx('thwip');
    
    document.querySelectorAll('.opt-btn').forEach((b, i) => {
        b.disabled = true;
        if(i === correct) b.classList.add('correct-web');
        else if(i === selected) b.classList.add('wrong-strike'); // شطب بدون اهتزاز
    });

    if(selected === correct) { 
        quizScore += 10; document.getElementById('quizScore').innerText = quizScore; 
    } else { 
        playSfx('error');
    }
    setTimeout(() => { qIndex++; loadNextQuestion(); }, 1800);
}

// ================= اللعبة الثانية: تأرجح العناكب (الغروب الأسطوري وإصلاح الأنوار) =================
const cvs1 = document.getElementById('gameCanvas'); const ctx1 = cvs1.getContext('2d');
let p1, isP1, isPull, obs1, coins1, hasWon = false, finishPadY = 0, arcadeLevel = 1, winDistance = 300;
let towerX = 400, isTowerSpawned = false, towerW = 110;

cvs1.onpointerdown = (e) => { e.preventDefault(); if(hasWon) return; if(!isP1) { isP1 = true; document.getElementById('startHint1').style.display='none'; } isPull = true; playSfx('thwip'); };
cvs1.onpointerup = (e) => { e.preventDefault(); if(!hasWon) isPull = false; };

function startArcade(level = 1) {
    arcadeLevel = level; winDistance = 200 + (arcadeLevel * 100); 
    document.getElementById('arcadeLvlText').innerText = arcadeLevel;
    showScreen('arcade'); 
    p1 = { x: 80, y: cvs1.height/2, vy: 0, d: 0, s: 0, webFired: false, webProg: 0, winAnimDone: false };
    isP1 = false; isPull = false; hasWon = false; isTowerSpawned = false; towerX = cvs1.width;
    obs1 = []; coins1 = []; finishPadY = cvs1.height - 120;
    document.getElementById('gameOverScreen1').style.display = 'none'; 
    document.getElementById('gameWinScreen1').style.display = 'none'; 
    document.getElementById('startHint1').style.display = 'block';
    document.getElementById('arcadeProgressFill').style.width = '0%';
    arcadeLoop();
}

function drawCityBackground(cameraX) {
    const sky = ctx1.createLinearGradient(0, 0, 0, cvs1.height);
    if (arcadeLevel === 1) {
        sky.addColorStop(0, '#2b1055'); sky.addColorStop(0.45, '#6a2c70'); sky.addColorStop(0.75, '#c0392b'); sky.addColorStop(1, '#0a0a0a');
    } else if (arcadeLevel === 2) {
        sky.addColorStop(0, '#1a0510'); sky.addColorStop(0.5, '#5c1020'); sky.addColorStop(0.8, '#8b1c24'); sky.addColorStop(1, '#0a0a0a');
    } else {
        sky.addColorStop(0, '#050a1f'); sky.addColorStop(0.5, '#0a1535'); sky.addColorStop(0.8, '#102040'); sky.addColorStop(1, '#000000');
    }
    
    ctx1.fillStyle = sky; ctx1.fillRect(0, 0, cvs1.width, cvs1.height);

    ctx1.fillStyle = 'rgba(255, 250, 230, 0.9)';
    ctx1.beginPath(); ctx1.arc(cvs1.width - 70, 70, 26, 0, Math.PI * 2); ctx1.fill();

    drawSkylineLayer(cameraX * 0.15, (arcadeLevel>2)?'rgba(10,15,25,0.7)':'rgba(15,20,35,0.55)', 90, 220, 100, false);
    drawSkylineLayer(cameraX * 0.3, (arcadeLevel>2)?'#080d17':'#101c2b', 150, 300, 80, true);
}

function drawSkylineLayer(offsetRaw, color, minH, maxH, spacing, withDetails) {
    let offset = offsetRaw % 1000;
    for(let i = 0; i < 16; i++) {
        let bx = (i * spacing) - offset; if(bx < -100) bx += spacing * 16;
        let bw = spacing - 12;
        let bh = minH + ((i * 37) % (maxH - minH));
        let by = cvs1.height - bh;

        ctx1.fillStyle = color;
        ctx1.fillRect(bx, by, bw, bh);

        if(withDetails) {
            if(i % 3 === 0) {
                ctx1.fillRect(bx + bw*0.25, by - 40, bw*0.5, 40);
                ctx1.fillRect(bx + bw*0.42, by - 65, bw*0.16, 25);
                ctx1.strokeStyle = color; ctx1.lineWidth = 2;
                ctx1.beginPath(); ctx1.moveTo(bx + bw/2, by - 65); ctx1.lineTo(bx + bw/2, by - 90); ctx1.stroke();
            }
            // إضاءة النوافذ مبنية بإحداثيات محلية مستقرة تماماً
            ctx1.fillStyle = 'rgba(255, 215, 0, 0.45)';
            for(let wy = by + 15; wy < cvs1.height - 15; wy += 22) {
                for(let wx = bx + 8; wx < bx + bw - 8; wx += 18) {
                    let localWX = Math.round(wx - bx);
                    if((i + wy + localWX) % 3 === 0) ctx1.fillRect(wx, wy, 9, 13);
                }
            }
        }
    }
}

function arcadeLoop() {
    if(p1.winAnimDone) return;
    ctx1.clearRect(0, 0, cvs1.width, cvs1.height); 
    drawCityBackground(p1.d);
    
    let currentDist = Math.floor(p1.d / 10);
    let gameSpeed = 1.8 + (arcadeLevel * 0.2); 

    let progress = Math.min((currentDist / winDistance) * 100, 100);
    document.getElementById('arcadeProgressFill').style.width = progress + '%';

    if (currentDist >= winDistance && !isTowerSpawned) {
        isTowerSpawned = true; towerX = cvs1.width;
    }

    if(isP1 && !hasWon) {
        if(isPull) { 
            let pivotX = p1.x + 80; let pivotY = 0;
            ctx1.strokeStyle='rgba(255,255,255,0.7)'; ctx1.lineWidth=2;
            ctx1.beginPath(); ctx1.moveTo(p1.x+20, p1.y); ctx1.lineTo(pivotX, pivotY); ctx1.stroke();
            p1.vy -= 0.4; p1.d += gameSpeed * 1.5; 
        } else { 
            p1.vy += 0.25; p1.d += gameSpeed;
        }
        p1.vy = Math.max(-5, Math.min(p1.vy, 5)); p1.y += p1.vy; 
        
        if(!isTowerSpawned) {
            let spawnRate = 0.008 + (arcadeLevel * 0.002);
            if(Math.random() < spawnRate) {
                let gap = 280 - (arcadeLevel * 15);
                gap = Math.max(gap, 130);
                let topH = Math.random() * (cvs1.height - gap - 60) + 30;
                obs1.push({x: cvs1.width, topH: topH, gap: gap});
            }
            if(Math.random() < 0.02) coins1.push({x: cvs1.width, y: Math.random()*(cvs1.height-100)+50});
        }
    } else if (!hasWon && !isP1) { p1.y = cvs1.height/2 + Math.sin(Date.now()/200)*10; }

    if(spideyImg.complete) {
        ctx1.save();
        ctx1.translate(p1.x, p1.y);
        if(isP1 && !isPull && !hasWon) ctx1.rotate(p1.vy * 0.1); 
        ctx1.drawImage(spideyImg, -20, -20, 40, 40);
        ctx1.restore();
    }

    document.getElementById('distCount').innerText = currentDist; document.getElementById('coinsCount').innerText = p1.s;

    if (isTowerSpawned) {
        if (!hasWon) towerX -= gameSpeed;
        if (towerX <= cvs1.width/2 - 55 && !hasWon) { towerX = cvs1.width/2 - 55; hasWon = true; isPull = false; }

        ctx1.fillStyle = '#1c2833'; ctx1.fillRect(towerX, finishPadY, towerW, cvs1.height);
        ctx1.fillRect(towerX + 20, finishPadY - 40, 70, 40);
        ctx1.strokeStyle = '#FFD700'; ctx1.lineWidth = 3; ctx1.strokeRect(towerX, finishPadY, towerW, cvs1.height);
        let antX = towerX + towerW/2, antY = finishPadY - 100;
        ctx1.beginPath(); ctx1.moveTo(antX, finishPadY - 40); ctx1.lineTo(antX, antY); ctx1.stroke();

        if(hasWon) {
            p1.vy += 0.5; p1.y += p1.vy;
            if(p1.x < antX - 10) p1.x += 2; else if (p1.x > antX + 10) p1.x -= 2;

            if(p1.y >= finishPadY - 20) {
                p1.y = finishPadY - 20; p1.vy = 0;
                if(!p1.webFired) { p1.webFired = true; playSfx('thwip'); }
                if(p1.webProg < 1) p1.webProg += 0.08;
                
                ctx1.strokeStyle = 'rgba(255,255,255,0.9)'; ctx1.lineWidth = 3;
                ctx1.beginPath(); ctx1.moveTo(p1.x, p1.y - 10);
                ctx1.lineTo(p1.x + (antX - p1.x) * p1.webProg, (p1.y - 10) + (antY - (p1.y - 10)) * p1.webProg);
                ctx1.stroke();

                if(p1.webProg >= 1 && !p1.winAnimDone) {
                    p1.winAnimDone = true;
                    setTimeout(() => {
                        document.getElementById('winCoinsCount').innerText = p1.s;
                        document.getElementById('gameWinScreen1').style.display='flex';
                    }, 600);
                }
            }
        }
    }

    if(!hasWon) {
        ctx1.fillStyle='#222'; ctx1.strokeStyle='#fff'; ctx1.lineWidth=2;
        for(let i=obs1.length-1; i>=0; i--) {
            let o = obs1[i]; if(isP1) o.x -= gameSpeed; 
            ctx1.fillRect(o.x, 0, 40, o.topH); ctx1.strokeRect(o.x, 0, 40, o.topH);
            let bottomY = o.topH + o.gap;
            ctx1.fillRect(o.x, bottomY, 40, cvs1.height - bottomY); ctx1.strokeRect(o.x, bottomY, 40, cvs1.height - bottomY);
            
            if(p1.x+15 > o.x && p1.x-15 < o.x+40 && (p1.y-15 < o.topH || p1.y+15 > bottomY)) return goArcade();
        }
        ctx1.fillStyle='#FFD700';
        for(let i=coins1.length-1; i>=0; i--) {
            let c = coins1[i]; if(isP1) c.x -= gameSpeed;
            ctx1.beginPath(); ctx1.arc(c.x, c.y, 10, 0, Math.PI*2); ctx1.fill(); ctx1.stroke();
            if(Math.hypot(p1.x-c.x, p1.y-c.y) < 25) { p1.s++; coins1.splice(i,1); playSfx('thwip'); }
        }
        if(p1.y>cvs1.height || p1.y<0) { if(isP1) return goArcade(); }
    }
    arcadeFrame = requestAnimationFrame(arcadeLoop);
}
// بدون اهتزاز شاشة عند الخسارة
function goArcade() { p1.winAnimDone = true; cancelAnimationFrame(arcadeFrame); playSfx('error'); document.getElementById('gameOverScreen1').style.display='flex'; }


// ================= اللعبة الثالثة: كاسر البلوكات =================
const cvs2 = document.getElementById('breakerCanvas'); const ctx2 = cvs2.getContext('2d');
let bBall, bPad, bBricks, bScore, bLvl, isBOn, bLevelWon = false;
cvs2.onpointerdown = (e) => { e.preventDefault(); if(bLevelWon) { bLvl++; initBreakerLevel(); return; } if(!isBOn) { isBOn=true; document.getElementById('startHint2').style.display='none'; } };
cvs2.addEventListener('touchmove', (e) => { e.preventDefault(); let r = cvs2.getBoundingClientRect(); bPad.x = e.touches[0].clientX - r.left - bPad.w/2; }, {passive:false});
cvs2.addEventListener('mousemove', (e) => { let r = cvs2.getBoundingClientRect(); bPad.x = e.clientX - r.left - bPad.w/2; });
function startBreaker() { showScreen('breaker'); bScore = 0; bLvl = 1; initBreakerLevel(); document.getElementById('gameOverScreen2').style.display = 'none'; breakerLoop(); }
function initBreakerLevel() {
    isBOn = false; bLevelWon = false; bPad = { w: Math.max(50, 100 - (bLvl * 5)), h: 15, x: cvs2.width/2 - 50, y: cvs2.height - 30 }; 
    let speedMult = 1 + (bLvl * 0.15); bBall = { r: 12, x: cvs2.width/2, y: cvs2.height - 50, dx: 4 * speedMult, dy: -4 * speedMult }; bBricks = []; 
    let rows = Math.min(3 + bLvl, 7), cols = 5, bWidth = 60, bHeight = 25, padding = 10, startX = (cvs2.width - (cols * (bWidth + padding))) / 2 + padding/2;
    for(let r=0; r<rows; r++) { for(let c=0; c<cols; c++) { let addBrick = true; if(bLvl % 2 === 0 && (r+c)%2 === 0) addBrick = false; if(bLvl % 3 === 0 && r === c) addBrick = false; 
    if(addBrick) bBricks.push({x: startX + c*(bWidth + padding), y: r*(bHeight + padding) + 60, w: bWidth, h: bHeight, status: (r === 0 && bLvl > 1) ? 2 : 1}); } }
    document.getElementById('lvlCount').innerText = bLvl; document.getElementById('brkScore').innerText = bScore; document.getElementById('startHint2').style.display = 'flex';
}
function breakerLoop() {
    ctx2.clearRect(0,0,cvs2.width,cvs2.height); bPad.x = Math.max(0, Math.min(cvs2.width - bPad.w, bPad.x));
    ctx2.fillStyle = '#003A70'; ctx2.fillRect(bPad.x, bPad.y, bPad.w, bPad.h); ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 2; ctx2.strokeRect(bPad.x, bPad.y, bPad.w, bPad.h);
    let allCleared = true;
    for(let i=0; i<bBricks.length; i++) { let b = bBricks[i]; if(b.status > 0) { allCleared = false; ctx2.fillStyle = b.status === 2 ? '#8e44ad' : ((i%2===0)? '#E23636' : '#2ecc71'); ctx2.fillRect(b.x, b.y, b.w, b.h); ctx2.strokeRect(b.x, b.y, b.w, b.h);
    if(bBall.x > b.x && bBall.x < b.x+b.w && bBall.y-bBall.r < b.y+b.h && bBall.y+bBall.r > b.y) { bBall.dy = -bBall.dy; b.status--; bScore += (b.status === 0) ? 10 : 5; document.getElementById('brkScore').innerText = bScore; playSfx('bounce'); } } }
    if(allCleared && isBOn && !bLevelWon) { bLevelWon = true; isBOn = false; document.getElementById('startHint2').innerHTML = `نجحت!<br><span style="font-size:1.2rem; color:var(--marvel-gold);">انتقال للمرحلة ${bLvl+1}</span>`; document.getElementById('startHint2').style.display = 'flex'; }
    if(isBOn) { bBall.x += bBall.dx; bBall.y += bBall.dy; if(bBall.x+bBall.r > cvs2.width || bBall.x-bBall.r < 0) bBall.dx = -bBall.dx; if(bBall.y-bBall.r < 0) bBall.dy = -bBall.dy;
    if(bBall.y+bBall.r > bPad.y && bBall.y-bBall.r < bPad.y+bPad.h && bBall.x > bPad.x && bBall.x < bPad.x+bPad.w) { bBall.dy = -Math.abs(bBall.dy); bBall.y = bPad.y - bBall.r; bBall.dx = 6 * ((bBall.x - (bPad.x + bPad.w/2)) / (bPad.w/2)); }
    if(bBall.y > cvs2.height) { cancelAnimationFrame(breakerFrame); playSfx('error'); document.getElementById('gameOverScreen2').style.display='flex'; return; } } else if (!bLevelWon) { bBall.x = bPad.x + bPad.w/2; }
    if(spideyImg.complete) { ctx2.drawImage(spideyImg, bBall.x-bBall.r, bBall.y-bBall.r, bBall.r*2, bBall.r*2); } else { ctx2.beginPath(); ctx2.arc(bBall.x, bBall.y, bBall.r, 0, Math.PI*2); ctx2.fillStyle = 'red'; ctx2.fill(); }
    breakerFrame = requestAnimationFrame(breakerLoop);
}

// ================= اللعبة الرابعة: مطاردة الغوبلين (النسخة الأصلية الرهيبة بدون اهتزاز) =================
const GOBLIN_HP_BASE = 100, HP_INCREASE_PER_LEVEL = 25, SPIDEY_LIVES_MAX = 3, SPIDEY_LIVES_CAP = 6, DIFFICULTY_RAMP_MS = 25000;
const BOMB_SPAWN_INTERVAL_MAX = 2100, BOMB_SPAWN_INTERVAL_MIN = 750, BOMB_SPEED_MIN = 2.4, BOMB_SPEED_MAX = 5.2;
const TELEGRAPH_DURATION_MS = 600, COUNTER_SPEED = 8, GOBLIN_MOVE_SPEED_MIN = 1.3, GOBLIN_MOVE_SPEED_MAX = 2.8;
const BOMB_DAMAGE_MIN = 12, BOMB_DAMAGE_MAX = 22, TAP_HIT_RADIUS = 34, SPIDEY_Y_MIN = 70, SPIDEY_Y_MAX = 430;

function levelBaseline(level) { return Math.min((level - 1) * 0.12, 0.55); }

const goblinCanvas = document.getElementById('goblinCanvas'); const gctx = goblinCanvas.getContext('2d');
let spidey5, goblin5, bombs5, goblinHP, goblinHPMax, spideyLives, goblinScore, goblinLevel;
let goblinStartTime = 0, goblinSpawnTimer = null, spideyInvuln = false, isDraggingSpidey5 = false, spideyTrail = [];

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function difficultyT5() { const base = levelBaseline(goblinLevel); return Math.min(base + ((performance.now() - goblinStartTime) / DIFFICULTY_RAMP_MS) * (1 - base), 1); }

function initGoblinGame() { goblinLevel = 1; spideyLives = SPIDEY_LIVES_MAX; goblinScore = 0; startGoblinLevel(); }

function startGoblinLevel() {
    document.getElementById('startHint5').style.display = 'none';
    document.getElementById('gameOverScreen5').style.display = 'none';
    document.getElementById('gameWinScreen5').style.display = 'none';
    isGoblinGameActive = true;
    goblinHPMax = GOBLIN_HP_BASE + (goblinLevel - 1) * HP_INCREASE_PER_LEVEL;
    goblinHP = goblinHPMax; spideyInvuln = false; goblinStartTime = performance.now();
    bombs5 = []; spideyTrail = [];
    spidey5 = { x: 65, y: goblinCanvas.height / 2 }; goblin5 = { x: goblinCanvas.width - 70, y: goblinCanvas.height / 2, dir: 1 };
    updateGoblinHUD(); clearTimeout(goblinSpawnTimer); scheduleNextBomb();
    cancelAnimationFrame(goblinFrame); goblinFrame = requestAnimationFrame(goblinLoop);
}

function nextGoblinLevel() { goblinLevel++; spideyLives = Math.min(spideyLives + 1, SPIDEY_LIVES_CAP); startGoblinLevel(); }

function updateGoblinHUD() {
    document.getElementById('spideyLives').innerText = spideyLives;
    document.getElementById('goblinHP').innerText = Math.max(0, Math.round((goblinHP / goblinHPMax) * 100));
    document.getElementById('goblinScore').innerText = goblinScore;
    document.getElementById('goblinLevel').innerText = goblinLevel;
}

function scheduleNextBomb() {
    if (!isGoblinGameActive) return;
    const delay = lerp(BOMB_SPAWN_INTERVAL_MAX, BOMB_SPAWN_INTERVAL_MIN, difficultyT5());
    goblinSpawnTimer = setTimeout(() => {
        if (!isGoblinGameActive) return;
        bombs5.push({ state: 'telegraph', x: goblin5.x, y: goblin5.y, telegraphStart: performance.now(), vx: 0, vy: 0 });
        if (goblinLevel >= 3 && Math.random() < 0.35) { setTimeout(() => { if (isGoblinGameActive) bombs5.push({ state: 'telegraph', x: goblin5.x, y: goblin5.y, telegraphStart: performance.now(), vx: 0, vy: 0 }); }, 220); }
        scheduleNextBomb();
    }, delay);
}

function updateGoblin5() {
    const speed = lerp(GOBLIN_MOVE_SPEED_MIN, GOBLIN_MOVE_SPEED_MAX, difficultyT5());
    goblin5.y += goblin5.dir * speed;
    if (goblin5.y < 70 || goblin5.y > goblinCanvas.height - 70) goblin5.dir *= -1;
    if (Math.random() < 0.01) goblin5.dir *= -1; 
}

function updateBombs5() {
    const bombSpeed = lerp(BOMB_SPEED_MIN, BOMB_SPEED_MAX, difficultyT5());
    for (let i = bombs5.length - 1; i >= 0; i--) {
        const b = bombs5[i];
        if (b.state === 'telegraph') {
            if (performance.now() - b.telegraphStart >= TELEGRAPH_DURATION_MS) {
                b.x = goblin5.x; b.y = goblin5.y;
                const dx = spidey5.x - b.x, dy = spidey5.y - b.y; const norm = Math.hypot(dx, dy) || 1;
                b.vx = (dx / norm) * bombSpeed; b.vy = (dy / norm) * bombSpeed; b.state = 'flying';
            } continue;
        }
        if (b.state === 'flying') {
            b.x += b.vx; b.y += b.vy;
            if (Math.hypot(b.x - spidey5.x, b.y - spidey5.y) < 24) { hitSpidey(); bombs5.splice(i, 1); continue; }
            if (b.x < -30) { bombs5.splice(i, 1); continue; }
        } else if (b.state === 'countered') {
            b.x += b.vx; b.y += b.vy;
            if (Math.hypot(b.x - goblin5.x, b.y - goblin5.y) < 30) { hitGoblin(); bombs5.splice(i, 1); continue; }
            if (b.x > goblinCanvas.width + 30) { bombs5.splice(i, 1); continue; }
        }
    }
}

function hitSpidey() {
    if (spideyInvuln) return;
    spideyLives--; updateGoblinHUD(); playSfx('error');
    spideyInvuln = true; setTimeout(() => spideyInvuln = false, 900);
    if (spideyLives <= 0) endGoblinGame();
}

function hitGoblin() {
    const dmg = BOMB_DAMAGE_MIN + Math.random() * (BOMB_DAMAGE_MAX - BOMB_DAMAGE_MIN);
    goblinHP -= dmg; goblinScore += 10 * goblinLevel; updateGoblinHUD(); playSfx('thwip');
    if (goblinHP <= 0) levelComplete();
}

function levelComplete() { isGoblinGameActive = false; cancelAnimationFrame(goblinFrame); clearTimeout(goblinSpawnTimer); document.getElementById('clearedLevelNum').innerText = goblinLevel; document.getElementById('finalGoblinScoreWin').innerText = goblinScore; document.getElementById('gameWinScreen5').style.display = 'flex'; }
function endGoblinGame() { isGoblinGameActive = false; cancelAnimationFrame(goblinFrame); clearTimeout(goblinSpawnTimer); document.getElementById('finalGoblinLevel').innerText = goblinLevel; document.getElementById('finalGoblinScore').innerText = goblinScore; document.getElementById('gameOverScreen5').style.display = 'flex'; playSfx('error'); }

function toCanvasCoords5(clientX, clientY) { const rect = goblinCanvas.getBoundingClientRect(); const scaleX = goblinCanvas.width / rect.width, scaleY = goblinCanvas.height / rect.height; return { mx: (clientX - rect.left) * scaleX, my: (clientY - rect.top) * scaleY }; }
function findTappableBomb(mx, my) { for (const b of bombs5) { if (b.state === 'flying' && Math.hypot(b.x - mx, b.y - my) < TAP_HIT_RADIUS) return b; } return null; }
function counterBomb(b) {
    const dx = goblin5.x - b.x, dy = goblin5.y - b.y; const norm = Math.hypot(dx, dy) || 1;
    b.vx = (dx / norm) * COUNTER_SPEED; b.vy = (dy / norm) * COUNTER_SPEED; b.state = 'countered';
    b.webFlashUntil = performance.now() + 220; b.webFrom = { x: spidey5.x, y: spidey5.y }; playSfx('thwip');
}

goblinCanvas.onpointerdown = (e) => {
    e.preventDefault();
    if (!isGoblinGameActive) return;
    const { mx, my } = toCanvasCoords5(e.clientX, e.clientY);
    const bomb = findTappableBomb(mx, my);
    if (bomb) { counterBomb(bomb); } else { isDraggingSpidey5 = true; spidey5.y = clamp(my, SPIDEY_Y_MIN, SPIDEY_Y_MAX); }
};
goblinCanvas.onpointermove = (e) => {
    e.preventDefault();
    if (!isDraggingSpidey5) return;
    const { my } = toCanvasCoords5(e.clientX, e.clientY); spidey5.y = clamp(my, SPIDEY_Y_MIN, SPIDEY_Y_MAX);
};
goblinCanvas.onpointerup = () => isDraggingSpidey5 = false; goblinCanvas.onpointerleave = () => isDraggingSpidey5 = false;

function drawWebLine(x1, y1, x2, y2, alpha, seed) {
    const segments = 7; const angle = Math.atan2(y2 - y1, x2 - x1), perp = angle + Math.PI / 2;
    gctx.save(); gctx.globalAlpha = alpha; gctx.strokeStyle = '#fff'; gctx.lineWidth = 2.5; gctx.lineCap = 'round'; gctx.shadowColor = 'rgba(255,255,255,0.6)'; gctx.shadowBlur = 4;
    gctx.beginPath(); gctx.moveTo(x1, y1);
    for (let i = 1; i <= segments; i++) { const t = i / segments; const px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t; const jitter = Math.sin(t * Math.PI * 3 + seed) * 5 * (1 - t * 0.7); gctx.lineTo(px + Math.cos(perp) * jitter, py + Math.sin(perp) * jitter); }
    gctx.stroke(); gctx.globalAlpha = alpha * 0.4; gctx.lineWidth = 1;
    gctx.beginPath(); gctx.moveTo(x1 + Math.cos(perp) * 4, y1 + Math.sin(perp) * 4); gctx.lineTo(x2 + Math.cos(perp) * 4, y2 + Math.sin(perp) * 4); gctx.stroke(); gctx.restore();
}
function drawWebBurst(x, y, alpha) {
    gctx.save(); gctx.globalAlpha = alpha; gctx.strokeStyle = '#fff'; gctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; gctx.beginPath(); gctx.moveTo(x, y); gctx.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); gctx.stroke(); } gctx.restore();
}

function drawNYStreet() {
    const w = goblinCanvas.width, h = goblinCanvas.height;
    const sky = gctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2b1055'); sky.addColorStop(0.5, '#4a2d6e'); sky.addColorStop(0.8, '#8a3b52'); sky.addColorStop(1, '#1a1a1a');
    gctx.fillStyle = sky; gctx.fillRect(0, 0, w, h);
    gctx.fillStyle = 'rgba(255,250,230,0.85)'; gctx.beginPath(); gctx.arc(w - 60, 55, 22, 0, Math.PI * 2); gctx.fill();
    for (let i = 0; i < 8; i++) { const bw = 55, bx = i * bw - 10, bh = 90 + ((i * 47) % 90); gctx.fillStyle = 'rgba(10, 15, 30, 0.65)'; gctx.fillRect(bx, h - 160 - bh, bw - 6, bh); }
    gctx.fillStyle = '#2a1f1a'; gctx.fillRect(0, 0, 110, h); gctx.strokeStyle = 'rgba(0,0,0,0.4)'; gctx.lineWidth = 1;
    for (let ry = 20; ry < h; ry += 26) { gctx.beginPath(); gctx.moveTo(0, ry); gctx.lineTo(110, ry); gctx.stroke(); }
    gctx.strokeStyle = '#555'; gctx.lineWidth = 3; gctx.strokeRect(15, 0, 70, h); 
    gctx.fillStyle = '#141c2b'; gctx.fillRect(w - 100, 0, 100, h); gctx.fillStyle = 'rgba(255, 200, 80, 0.25)';
    for (let wy = 15; wy < h; wy += 30) for (let wx = w - 90; wx < w - 15; wx += 24) { if ((wx + wy) % 3 === 0) gctx.fillRect(wx, wy, 14, 18); }
    gctx.fillStyle = '#111'; gctx.fillRect(0, h - 55, w, 55); gctx.strokeStyle = 'rgba(255,255,0,0.5)'; gctx.lineWidth = 3; gctx.setLineDash([18, 14]);
    gctx.beginPath(); gctx.moveTo(0, h - 27); gctx.lineTo(w, h - 27); gctx.stroke(); gctx.setLineDash([]);
    gctx.fillStyle = 'rgba(200,200,210,0.06)'; gctx.beginPath(); gctx.ellipse(w / 2, h - 40, 80, 25, 0, 0, Math.PI * 2); gctx.fill();
}

function drawGoblinScene() {
    drawNYStreet();
    spideyTrail.push({ x: spidey5.x, y: spidey5.y, t: performance.now() }); spideyTrail = spideyTrail.filter(p => performance.now() - p.t < 140);
    spideyTrail.forEach((p, idx) => { const alpha = (idx / spideyTrail.length) * 0.25; gctx.save(); gctx.globalAlpha = alpha; gctx.drawImage(spideyImg, p.x - 24, p.y - 24, 48, 48); gctx.restore(); });
    const bob = Math.sin(performance.now() / 300) * 3;
    gctx.save(); gctx.filter = spideyInvuln ? 'brightness(2.2)' : 'none'; gctx.drawImage(spideyImg, spidey5.x - 28, spidey5.y - 28 + bob, 56, 56); gctx.restore();
    gctx.save(); gctx.translate(goblin5.x, goblin5.y); gctx.font = '52px serif'; gctx.textAlign = 'center'; gctx.textBaseline = 'middle'; gctx.shadowColor = '#7CFC00'; gctx.shadowBlur = 14; gctx.fillText('🎃', 0, 0); gctx.restore();
    gctx.save(); gctx.fillStyle = 'rgba(0,0,0,0.6)'; gctx.fillRect(goblin5.x - 30, goblin5.y - 50, 60, 8); gctx.fillStyle = '#E23636'; gctx.fillRect(goblin5.x - 30, goblin5.y - 50, 60 * (goblinHP / goblinHPMax), 8); gctx.restore();

    for (const b of bombs5) {
        if (b.state === 'telegraph') {
            const elapsed = performance.now() - b.telegraphStart; const pulse = 20 + Math.sin(elapsed / 60) * 6;
            gctx.save(); gctx.translate(goblin5.x, goblin5.y); gctx.rotate(elapsed / 200); gctx.strokeStyle = (Math.floor(elapsed / 100) % 2 === 0) ? '#FFD700' : '#000';
            gctx.lineWidth = 4; gctx.beginPath(); gctx.arc(0, 0, pulse, 0, Math.PI * 1.4); gctx.stroke(); gctx.restore(); continue;
        }
        gctx.save(); gctx.font = '28px serif'; gctx.textAlign = 'center'; gctx.textBaseline = 'middle'; gctx.translate(b.x, b.y); gctx.rotate(performance.now() / 150); gctx.fillText('🎃', 0, 0); gctx.restore();
        if (b.state === 'flying') { gctx.strokeStyle = 'rgba(255, 215, 0, 0.5)'; gctx.lineWidth = 2; gctx.beginPath(); gctx.arc(b.x, b.y, TAP_HIT_RADIUS * 0.6, 0, Math.PI * 2); gctx.stroke(); }
        if (b.state === 'countered' && b.webFlashUntil && performance.now() < b.webFlashUntil) { const remain = (b.webFlashUntil - performance.now()) / 220; drawWebLine(b.webFrom.x, b.webFrom.y, b.x, b.y, remain, b.webFlashUntil); drawWebBurst(b.x, b.y, remain); }
    }
}

function goblinLoop() {
    if (!isGoblinGameActive) return;
    updateGoblin5(); updateBombs5(); drawGoblinScene();
    goblinFrame = requestAnimationFrame(goblinLoop);
}