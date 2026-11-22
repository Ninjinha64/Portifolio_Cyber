// ===== Identificação de Visitante & Telemetria Vice SIEM (Zero Escape + Sessão + Cliques) =====
(function () {
    const modal = document.getElementById('gate-modal');
    const form = document.getElementById('gate-form');
    const inputNome = document.getElementById('gate-nome');
    const greeting = document.getElementById('visitor-greeting');
    const origemInicial = document.referrer || '';
    const inicioSessao = Date.now();
    let totalInteracoes = 0;
    let saidaEnviada = false;

    function obterNomeAtual() {
        return sessionStorage.getItem('visitor_name') || 'Visitante (Na tela de login)';
    }

    function aplicarSaudacao(nome) {
        if (greeting && nome) {
            greeting.textContent = `$ session --user "${nome}" [VICE SIEM LOGGED]`;
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
        // 1. Automação Zero Escape: Registra que alguém abriu a página antes mesmo de digitar o nome!
        if (!sessionStorage.getItem('zero_escape_logged')) {
            sessionStorage.setItem('zero_escape_logged', '1');
            enviarLog('Não identificado (Abriu o site)', '👀 Abriu a Tela Inicial (Zero Escape)', location.pathname + location.hash);
        }
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
        totalInteracoes++;
        enviarLog(nome, '🔓 Entrou no Portfólio (Autenticado)', location.pathname + location.hash);
    });

    // 2. Rastrear para onde o visitante foi (cliques em seções, certificados, projetos e contatos)
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

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
            totalInteracoes++;
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
            totalInteracoes++;
            enviarLog(obterNomeAtual(), `📋 Copiou Contato (${texto})`, '#contato');
        });
    });

    // 3. Automação de Tempo de Sessão (registra quanto tempo a pessoa ficou ao fechar/sair da aba)
    function registrarSaida() {
        if (saidaEnviada) return;
        const segundos = Math.round((Date.now() - inicioSessao) / 1000);
        if (segundos < 3) return;
        saidaEnviada = true;
        const min = Math.floor(segundos / 60);
        const seg = segundos % 60;
        const tempoFmt = min > 0 ? `${min}m ${seg}s` : `${seg}s`;
        enviarLog(
            obterNomeAtual(),
            `⏱️ Encerrou Sessão (Tempo: ${tempoFmt} · Cliques: ${totalInteracoes})`,
            location.pathname + location.hash
        );
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') registrarSaida();
    });
    window.addEventListener('pagehide', registrarSaida);
})();

// ===== Alternador de Tema (GTA VI Vice City <-> Clássico Oliva) =====
(function () {
    const btnTema = document.getElementById('theme-toggle');
    if (!btnTema) return;

    function atualizarTextoBotao() {
        const isClassico = document.body.classList.contains('tema-classico');
        btnTema.textContent = isClassico ? '🟢 Modo Clássico' : '🌴 Modo Vice City';
    }

    if (localStorage.getItem('portfolio_tema') === 'classico') {
        document.body.classList.add('tema-classico');
        atualizarTextoBotao();
    }

    btnTema.addEventListener('click', () => {
        document.body.classList.toggle('tema-classico');
        const isClassico = document.body.classList.contains('tema-classico');
        localStorage.setItem('portfolio_tema', isClassico ? 'classico' : 'vice');
        atualizarTextoBotao();
    });
})();

// ===== Automação GitHub Auto-Sync (@Ninjinha64 em tempo real) =====
(function () {
    const statsEl = document.getElementById('github-stats');
    if (!statsEl) return;

    Promise.all([
        fetch('https://api.github.com/users/Ninjinha64').then((r) => (r.ok ? r.json() : null)),
        fetch('https://api.github.com/users/Ninjinha64/repos?sort=updated&per_page=3').then((r) => (r.ok ? r.json() : null))
    ])
        .then(([user, repos]) => {
            if (!user || !Array.isArray(repos)) return;
            const ultimoRepo = repos[0] ? repos[0].name : 'Portifolio_Cyber';
            statsEl.innerHTML =
                `<span>📦 Repositórios Públicos: <b>${user.public_repos}</b></span>` +
                `<span>⚡ Último Atualizado: <b>${ultimoRepo}</b></span>` +
                `<span>🟢 Status API: <b>Online</b></span>`;
        })
        .catch(() => {});
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

// ===== Chuva estilo Matrix (Cores Neon GTA VI Vice City / Clássico) =====
(function () {
    const canvas = document.getElementById('matrix');
    const ctx = canvas.getContext('2d');
    const chars = '01ABCDEF<>/{}[]#$%&*+=VICE6';
    const coresVice = ['#ff2a85', '#00f0ff', '#ff9e44', '#d946ef'];
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
        const isClassico = document.body.classList.contains('tema-classico');
        ctx.fillStyle = isClassico ? 'rgba(12, 17, 10, .14)' : 'rgba(11, 2, 26, .16)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = tam + 'px monospace';
        gotas.forEach((y, i) => {
            ctx.fillStyle = isClassico ? '#A4B465' : coresVice[i % coresVice.length];
            ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * tam, y * tam);
            gotas[i] = y * tam > canvas.height && Math.random() > .975 ? 0 : y + 1;
        });
    }, 60);
})();
