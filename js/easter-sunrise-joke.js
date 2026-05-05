/**
 * Broma opcional: al hacer tap/clic en .brand-route-season ("Sunrise") se abre un modal festivo con confeti.
 * NO forma parte de cotizador-main ni del bundle principal. Quitar este script y su <script src> en index.html para eliminar la broma.
 */
(function () {
    'use strict';

    var COLORS = ['#e40303', '#ff8c00', '#ffed00', '#00c853', '#24408e', '#732982', '#ff218e', '#f472b6', '#38bdf8'];
    var root = document.getElementById('easterSunriseRoot');
    var backdrop = document.getElementById('easterSunriseBackdrop');
    var canvas = document.getElementById('easterSunriseConfetti');
    var closeBtn = document.getElementById('easterSunriseClose');
    var trigger = document.querySelector('.brand-route-season');

    if (!root || !backdrop || !canvas || !closeBtn || !trigger) return;

    var ctx = canvas.getContext('2d');
    var particles = [];
    var rafId = 0;
    var running = false;
    var dripId = 0;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function spawnBurst() {
        var w = canvas.width;
        var h = canvas.height;
        var cx = w * 0.5;
        var cy = h * 0.35;
        var i;
        var n = 110;
        for (i = 0; i < n; i++) {
            var ang = (Math.PI * 2 * i) / n + Math.random() * 0.5;
            var sp = 4 + Math.random() * 10;
            particles.push({
                x: cx,
                y: cy,
                vx: Math.cos(ang) * sp,
                vy: Math.sin(ang) * sp - 3,
                w: 5 + Math.random() * 7,
                h: 4 + Math.random() * 6,
                rot: Math.random() * Math.PI,
                vr: (Math.random() - 0.5) * 0.25,
                g: 0.12 + Math.random() * 0.08,
                life: 1,
                color: COLORS[(Math.random() * COLORS.length) | 0]
            });
        }
    }

    function tick() {
        if (!running) return;
        var w = canvas.width;
        var h = canvas.height;
        var i;
        ctx.clearRect(0, 0, w, h);
        for (i = 0; i < particles.length; i++) {
            var p = particles[i];
            p.vy += p.g;
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.vr;
            p.life -= 0.004;
            if (p.life <= 0 || p.y > h + 40) {
                particles.splice(i, 1);
                i--;
                continue;
            }
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        }
        if (particles.length > 0) {
            rafId = window.requestAnimationFrame(tick);
        } else {
            rafId = 0;
        }
    }

    function ensureTick() {
        if (running && particles.length > 0 && !rafId) {
            rafId = window.requestAnimationFrame(tick);
        }
    }

    function spawnTopDrizzle() {
        var w = canvas.width;
        var i;
        for (i = 0; i < 10; i++) {
            particles.push({
                x: Math.random() * w,
                y: -12 - Math.random() * 40,
                vx: (Math.random() - 0.5) * 2.2,
                vy: 2.5 + Math.random() * 3.5,
                w: 4 + Math.random() * 5,
                h: 3 + Math.random() * 5,
                rot: Math.random() * Math.PI,
                vr: (Math.random() - 0.5) * 0.2,
                g: 0.1 + Math.random() * 0.06,
                life: 0.85 + Math.random() * 0.15,
                color: COLORS[(Math.random() * COLORS.length) | 0]
            });
        }
        ensureTick();
    }

    function startConfetti() {
        resizeCanvas();
        particles.length = 0;
        spawnBurst();
        running = true;
        if (!rafId) rafId = window.requestAnimationFrame(tick);
    }

    function stopConfetti() {
        running = false;
        if (dripId) {
            window.clearInterval(dripId);
            dripId = 0;
        }
        if (rafId) {
            window.cancelAnimationFrame(rafId);
            rafId = 0;
        }
        particles.length = 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function openModal() {
        root.classList.remove('is-hidden');
        root.setAttribute('aria-hidden', 'false');
        document.body.classList.add('easter-sunrise-no-scroll');
        startConfetti();
        var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduced) {
            dripId = window.setInterval(function () {
                if (running && particles.length < 220) spawnTopDrizzle();
            }, 450);
        }
        closeBtn.focus();
    }

    function closeModal() {
        root.classList.add('is-hidden');
        root.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('easter-sunrise-no-scroll');
        stopConfetti();
        try {
            trigger.focus();
        } catch (e) { /* ignore */ }
    }

    function onTriggerTap(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        openModal();
    }

    trigger.addEventListener('click', onTriggerTap);
    trigger.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            openModal();
        }
    });
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-label', 'Sunrise: mensaje sorpresa');

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && !root.classList.contains('is-hidden')) {
            closeModal();
        }
    });

    window.addEventListener('resize', function () {
        if (!root.classList.contains('is-hidden')) resizeCanvas();
    });
})();
