// ===== Identificação de Visitante & Telemetria SIEM (Google Sheets + Vercel) =====
(function () {
    const modal = document.getElementById('gate-modal');
    const form = document.getElementById('gate-form');
    const inputNome = document.getElementById('gate-nome');
    const greeting = document.getElementById('visitor-greeting');
    const origemInicial = document.referrer || '';

    function obterNomeAtual() {
        return sessionStorage.getItem('visitor_name') || 'Visitante';
    }

    function aplicarSaudacao(nome) {
        if (greeting && nome) {
            greeting.textContent = `$ session --user "${nome}" [SIEM LOGGED]`;
        }
    }

    function enviarLog(nome, acao, pagina) {
        fetch('/api/log-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({
                nome: nome || obterNomeAtual(),
                acao: acao || '🔓 Entrou no Portfólio',
                origem: origemInicial,
                pagina: pagina || (location.pathname + location.hash)
            })
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
        enviarLog(nome, '🔓 Entrou no Portfólio', location.pathname + location.hash);
    });

    // Rastrear para onde o visitante foi (cliques em seções, certificados, projetos e contatos)
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;
        if (!sessionStorage.getItem('visitor_name')) return;

        const href = link.getAttribute('href') || '';
        const texto = (link.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);

        let acao = '';
        if (href.includes('google-cybersecurity-final.pdf')) {
            acao = '🏆 Abriu Certificado Final Google (PDF)';
        } else if (href.includes('coursera.org/verify')) {
            acao = `✓ Verificou Credencial Coursera (${texto})`;
        } else if (href.endsWith('.pdf') || href.endsWith('.jpg')) {
            const arq = href.split('/').pop();
            acao = `📄 Abriu Certificado (${arq})`;
        } else if (href.includes('github.com/Ninjinha64/luna-ai-pentest')) {
            acao = '🌙 Clicou no Projeto Luna AI Pentest (GitHub)';
        } else if (href.includes('github.com')) {
            acao = `💻 Abriu GitHub (${texto})`;
        } else if (href.includes('linkedin.com')) {
            acao = '🔗 Abriu Perfil no LinkedIn';
        } else if (href.includes('wa.me')) {
            acao = '📱 Clicou para Chamar no WhatsApp';
        } else if (href.startsWith('mailto:')) {
            acao = '✉ Clicou para Enviar E-mail';
        } else if (href.includes('instagram.com')) {
            acao = '📸 Abriu Instagram';
        } else if (href.startsWith('#')) {
            acao = `🧭 Navegou para seção ${href}`;
        }

        if (acao) {
            enviarLog(obterNomeAtual(), acao, href);
        }
    });

    // Rastrear quando copiam e-mail ou telefone
    document.querySelectorAll('.btn-copiar').forEach((btn) => {
        btn.addEventListener('click', () => {
            const texto = btn.dataset.copy;
            navigator.clipboard.writeText(texto).then(() => {
                const original = btn.textContent;
                btn.textContent = '✓ Copiado!';
                setTimeout(() => { btn.textContent = original; }, 1800);
            });
            if (sessionStorage.getItem('visitor_name')) {
                enviarLog(obterNomeAtual(), `📋 Copiou Contato (${texto})`, '#contato');
            }
        });
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
