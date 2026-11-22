// ===== Toast Cyber de Feedback UX =====
function mostrarToast(msg) {
    const toast = document.getElementById('cyber-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('ativo');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('ativo'), 3200);
}

// ===== Identificação de Visitante & Telemetria Vice SIEM (Fingerprint Anti-Fake + Zero Escape + Sessão) =====
(function () {
    const modal = document.getElementById('gate-modal');
    const form = document.getElementById('gate-form');
    const inputNome = document.getElementById('gate-nome');
    const greeting = document.getElementById('visitor-greeting');
    const origemInicial = document.referrer || '';
    const inicioSessao = Date.now();
    let totalInteracoes = 0;
    let saidaEnviada = false;

    // Gera Impressão Digital Única do Aparelho (Device Fingerprint) + Hardware Real (GPU / Tela / Modelo)
    function coletarAssinaturaDispositivo() {
        let gpu = '';
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                const dbg = gl.getExtension('WEBGL_debug_renderer_info');
                if (dbg) {
                    const rawGpu = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '';
                    gpu = rawGpu
                        .replace(/ANGLE\s*\(([^,]+),\s*([^,]+).*?\)/i, '$2')
                        .replace(/OpenGL.*$/i, '')
                        .replace(/Direct3D.*$/i, '')
                        .trim()
                        .slice(0, 34);
                }
            }
        } catch {}

        const w = Math.min(window.screen.width, window.screen.height);
        const h = Math.max(window.screen.width, window.screen.height);
        const dpr = window.devicePixelRatio || 1;
        const tela = `${window.screen.width}x${window.screen.height}`;
        const cores = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency}c` : '';
        const ram = navigator.deviceMemory ? `${navigator.deviceMemory}GB` : '';
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        const lang = navigator.language || '';

        // Estimar modelo de iPhone pela resolução física + DPR (já que a Apple oculta o modelo no User-Agent)
        let modeloIphone = '';
        if (/iPhone/i.test(navigator.userAgent)) {
            const key = `${w}x${h}@${dpr}`;
            const mapaIphone = {
                '440x956@3': 'iPhone 16 Pro Max',
                '402x874@3': 'iPhone 16 Pro',
                '430x932@3': 'iPhone 14/15/16 Plus ou Pro Max',
                '393x852@3': 'iPhone 14 Pro / 15 / 16',
                '390x844@3': 'iPhone 12 / 13 / 14',
                '428x926@3': 'iPhone 12/13 Pro Max ou 14 Plus',
                '375x812@3': 'iPhone X / XS / 11 Pro / Mini',
                '414x896@2': 'iPhone XR / 11',
                '414x896@3': 'iPhone XS Max / 11 Pro Max',
                '375x667@2': 'iPhone SE / 7 / 8'
            };
            modeloIphone = mapaIphone[key] || `iPhone (${tela})`;
        }

        // Hash curto determinístico do aparelho (mesmo se a pessoa mentir o nome, o ID #XXXX continua igual!)
        const rawFp = [navigator.userAgent, tela, dpr, gpu, cores, ram, tz, lang, navigator.platform].join('|');
        let hash = 2166136261;
        for (let i = 0; i < rawFp.length; i++) {
            hash ^= rawFp.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        const fpId = 'ID:' + (hash >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 6);

        const hwPartes = [modeloIphone || gpu, tela, [cores, ram].filter(Boolean).join('/')].filter(Boolean);
        return { fp: fpId, hw: hwPartes.join(' · ') };
    }

    const assinatura = coletarAssinaturaDispositivo();

    function obterNomeAtual() {
        return sessionStorage.getItem('visitor_name') || 'Não identificado';
    }

    function aplicarSaudacao(nome) {
        if (greeting && nome) {
            greeting.textContent = `$ session --user "${nome}" [${assinatura.fp}]`;
        }
    }

    function enviarLog(nome, acao, pagina) {
        fetch('/api/log-access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({
                nome: nome || obterNomeAtual(),
                fp: assinatura.fp,
                hw: assinatura.hw,
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
        mostrarToast(`🌴 Acesso liberado para ${nome} · Sessão registrada no Vice SIEM!`);
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
                mostrarToast(`📋 Copiado para a área de transferência: ${texto}`);
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
        mostrarToast(isClassico ? '🟢 Tema Clássico (Verde Oliva) ativado!' : '🌴 Tema GTA VI / Vice City ativado!');
    });
})();

// ===== Animações de UX: Scroll Reveal, Decodificação Cyber, Spotlight 3D e ScrollSpy =====
(function () {
    // 1. Efeito Hacker Scramble / Decodificação nos títulos de seção
    const glyphs = '01ABCDEF#$%&*<>/_';
    function decodificarTexto(el) {
        if (el.dataset.animando === '1') return;
        const spanNum = el.querySelector('span');
        const prefixo = spanNum ? spanNum.outerHTML + ' ' : '';
        const textoAlvo = (el.dataset.original || el.textContent.replace(/^0\d\.\s*/, '')).trim();
        el.dataset.original = textoAlvo;
        el.dataset.animando = '1';

        let iter = 0;
        const timer = setInterval(() => {
            const parcial = textoAlvo
                .split('')
                .map((ch, idx) => {
                    if (ch === ' ') return ' ';
                    if (idx < iter) return textoAlvo[idx];
                    return glyphs[Math.floor(Math.random() * glyphs.length)];
                })
                .join('');
            el.innerHTML = prefixo + parcial;
            iter += 1.2;
            if (iter >= textoAlvo.length) {
                clearInterval(timer);
                el.innerHTML = prefixo + textoAlvo;
                el.dataset.animando = '0';
            }
        }, 28);
    }

    document.querySelectorAll('.secao__titulo').forEach((t) => {
        t.addEventListener('mouseenter', () => decodificarTexto(t));
    });

    // 2. Scroll Reveal em cascata para cards, janelas, certificados e títulos
    const elementosReveal = document.querySelectorAll(
        '.secao__titulo, .janela, .card, .contato-card, .google-spotlight, .comptia-banner, .github-sync-bar, .subtitulo-log, .log li'
    );
    elementosReveal.forEach((el, idx) => {
        el.classList.add('reveal');
        const delay = (idx % 6) * 55;
        el.style.setProperty('--delay', `${delay}ms`);
    });

    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visivel');
                        if (entry.target.classList.contains('secao__titulo')) {
                            decodificarTexto(entry.target);
                        }
                        io.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -30px 0px' }
        );
        elementosReveal.forEach((el) => io.observe(el));
    } else {
        elementosReveal.forEach((el) => el.classList.add('visivel'));
    }

    // 3. Spotlight Holográfico que segue o cursor nos cards
    document.querySelectorAll('.card, .contato-card').forEach((card) => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
            card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
        });
    });

    // 4. Barra de Progresso de Scroll + Botão Voltar ao Topo + Menu Ativo (ScrollSpy)
    const barraProgresso = document.getElementById('scroll-progress');
    const btnTopo = document.getElementById('back-to-top');
    const secoes = document.querySelectorAll('main section[id]');
    const linksMenu = document.querySelectorAll('.topo__menu a[href^="#"]');

    if (btnTopo) {
        btnTopo.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    function atualizarScroll() {
        const scrollY = window.scrollY;
        const alturaTotal = document.documentElement.scrollHeight - window.innerHeight;
        if (barraProgresso && alturaTotal > 0) {
            barraProgresso.style.width = `${Math.min((scrollY / alturaTotal) * 100, 100)}%`;
        }
        if (btnTopo) {
            btnTopo.classList.toggle('visivel', scrollY > 420);
        }

        let atual = 'home';
        secoes.forEach((sec) => {
            if (scrollY >= sec.offsetTop - 220) {
                atual = sec.id;
            }
        });
        linksMenu.forEach((a) => {
            a.classList.toggle('ativo', a.getAttribute('href') === `#${atual}`);
        });
    }

    window.addEventListener('scroll', atualizarScroll, { passive: true });
    atualizarScroll();
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
