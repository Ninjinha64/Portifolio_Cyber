// ===== Identificação de Visitante & Registro no SIEM (Vercel Logs) =====
(function () {
    const modal = document.getElementById('gate-modal');
    const form = document.getElementById('gate-form');
    const inputNome = document.getElementById('gate-nome');
    const btnGuest = document.getElementById('gate-guest');
    const greeting = document.getElementById('visitor-greeting');

    function aplicarSaudacao(nome) {
        if (greeting && nome) {
            greeting.textContent = `$ session --user "${nome}" [SIEM LOGGED]`;
        }
    }

    function enviarLog(nome) {
        fetch('/api/log-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, pagina: location.pathname + location.hash })
        }).catch(() => {});
    }

    const salvo = sessionStorage.getItem('visitor_name');
    if (salvo) {
        modal.classList.add('oculto');
        aplicarSaudacao(salvo);
    } else {
        setTimeout(() => inputNome && inputNome.focus(), 150);
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const nome = (inputNome.value || '').trim();
        if (!nome) {
            inputNome.focus();
            return;
        }
        sessionStorage.setItem('visitor_name', nome);
        aplicarSaudacao(nome);
        modal.classList.add('oculto');
        enviarLog(nome);
    });
})();

// ===== Efeito digitação =====
(function () {
    const el = document.getElementById('typed');
    const frases = JSON.parse(el.dataset.frases);
    let f = 0, c = 0, apagando = false;

    function tick() {
        const frase = frases[f];
        el.textContent = frase.slice(0, c);
        if (!apagando && c === frase.length) { apagando = true; return setTimeout(tick, 1600); }
        if (apagando && c === 0) { apagando = false; f = (f + 1) % frases.length; }
        c += apagando ? -1 : 1;
        setTimeout(tick, apagando ? 40 : 90);
    }
    tick();
})();

// ===== Botões de copiar contato (e-mail / telefone) =====
document.querySelectorAll('.btn-copiar').forEach((btn) => {
    btn.addEventListener('click', () => {
        const texto = btn.dataset.copy;
        navigator.clipboard.writeText(texto).then(() => {
            const original = btn.textContent;
            btn.textContent = '✓ Copiado!';
            setTimeout(() => { btn.textContent = original; }, 1800);
        });
    });
});

// ===== Chuva estilo matrix (cores do portfólio antigo) =====
(function () {
    const canvas = document.getElementById('matrix');
    const ctx = canvas.getContext('2d');
    const chars = '01ABCDEF<>/{}[]#$%&*+=';
    const tam = 16;
    let gotas = [];

    function ajustar() {
        canvas.width = innerWidth;
        canvas.height = innerHeight;
        gotas = Array(Math.floor(canvas.width / tam)).fill(1);
    }
    addEventListener('resize', ajustar);
    ajustar();

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    setInterval(() => {
        ctx.fillStyle = 'rgba(12, 17, 10, .12)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#A4B465';
        ctx.font = tam + 'px monospace';
        gotas.forEach((y, i) => {
            ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * tam, y * tam);
            gotas[i] = y * tam > canvas.height && Math.random() > .975 ? 0 : y + 1;
        });
    }, 60);
})();
