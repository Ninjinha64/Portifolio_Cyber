(function () {
    const chatBox = document.getElementById('chat-box');
    const chatScroll = document.getElementById('chat-scroll');
    const inputPergunta = document.getElementById('input-pergunta');
    const btnEnviar = document.getElementById('btn-enviar');
    const btnNova = document.getElementById('btn-nova');
    const btnTema = document.getElementById('btn-tema');
    const welcomeHTML = document.getElementById('welcome').outerHTML;
    let gerando = false;

    function aplicarTema(tema) {
        document.documentElement.setAttribute('data-theme', tema);
        localStorage.setItem('mila_ai_tema', tema);
        const ico = document.getElementById('ico-tema');
        const lbl = document.getElementById('lbl-tema');
        if (tema === 'dark') {
            ico.innerHTML = '<use href="#i-sol"/>';
            lbl.innerText = 'Modo Pastel Claro';
        } else {
            ico.innerHTML = '<use href="#i-lua"/>';
            lbl.innerText = 'Modo Floresta';
        }
    }

    aplicarTema(localStorage.getItem('mila_ai_tema') || 'light');

    btnTema.addEventListener('click', () => {
        const atual = document.documentElement.getAttribute('data-theme') || 'light';
        aplicarTema(atual === 'light' ? 'dark' : 'light');
    });

    function vincularCards() {
        document.querySelectorAll('.card[data-prompt]').forEach((card) => {
            card.addEventListener('click', () => {
                inputPergunta.value = card.getAttribute('data-prompt');
                enviarPergunta();
            });
        });
    }
    vincularCards();

    btnNova.addEventListener('click', () => {
        if (gerando) return;
        chatBox.innerHTML = welcomeHTML;
        vincularCards();
    });

    btnEnviar.addEventListener('click', enviarPergunta);
    inputPergunta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            enviarPergunta();
        }
    });

    async function buscarWikipediaPT(pergunta) {
        const limpo = pergunta
            .replace(/^(o que é|quem foi|quem é|me explique|explique|fale sobre|como funciona)\s+/i, '')
            .replace(/[?!.;]+$/g, '')
            .trim();
        const urlBusca = 'https://pt.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=2&srsearch=' + encodeURIComponent(limpo);
        const r1 = await fetch(urlBusca);
        const d1 = await r1.json();
        const itens = (d1.query && d1.query.search) || [];
        if (itens.length === 0) return null;

        const titulo = itens[0].title;
        const urlExtrato = 'https://pt.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&format=json&origin=*&titles=' + encodeURIComponent(titulo);
        const r2 = await fetch(urlExtrato);
        const d2 = await r2.json();
        const pages = (d2.query && d2.query.pages) || {};
        const page = Object.values(pages)[0];
        return {
            titulo: page.title || titulo,
            extrato: (page.extract || '').trim(),
            url: 'https://pt.wikipedia.org/wiki/' + encodeURIComponent((page.title || titulo).replace(/ /g, '_'))
        };
    }

    async function enviarPergunta() {
        if (gerando) return;
        const pergunta = inputPergunta.value.trim();
        if (!pergunta) return;

        gerando = true;
        inputPergunta.value = '';
        const welcome = document.getElementById('welcome');
        if (welcome) welcome.remove();

        const rowUser = document.createElement('div');
        rowUser.className = 'row user';
        rowUser.innerHTML = '<div class="avatar user">V</div><div class="bubble"></div>';
        rowUser.querySelector('.bubble').innerText = pergunta;
        chatBox.appendChild(rowUser);

        const rowAi = document.createElement('div');
        rowAi.className = 'row ai';
        rowAi.innerHTML = `
            <div class="avatar ai"><img src="./assets/mila_robo.svg" alt="Mila"></div>
            <div class="bubble">
                <div class="nome-ai">Mila AI</div>
                <div class="rag-stepper"><svg class="i girar"><use href="#i-globo"/></svg><span>Consultando Wikipedia (PT) em tempo real...</span></div>
                <div class="sources" style="display:none"></div>
                <div class="conteudo"></div>
                <div class="meta" style="display:none"></div>
            </div>
        `;
        chatBox.appendChild(rowAi);
        chatScroll.scrollTop = chatScroll.scrollHeight;

        const stepper = rowAi.querySelector('.rag-stepper');
        const sources = rowAi.querySelector('.sources');
        const conteudo = rowAi.querySelector('.conteudo');
        const meta = rowAi.querySelector('.meta');

        let respostaTexto = '';
        const pLower = pergunta.toLowerCase();

        if (pLower.includes('bitnet') || pLower.includes('professor') || pLower.includes('surgiu') || pLower.includes('mila')) {
            sources.style.display = 'flex';
            sources.innerHTML = '<a class="source-badge" href="https://github.com/Ninjinha64/Mila_AI" target="_blank">Memória Local: Origem da Mila AI & BitNet</a>';
            respostaTexto = 'A **Mila AI** foi criada pelo **Artur Lima**! Tudo começou quando o professor dele comentou em aula sobre o **BitNet** (arquitetura de modelos de linguagem quantizados de forma extrema para rodar na CPU). A partir dessa inspiração, o Artur estruturou a Mila AI combinando motor C++ GGUF de 4 bits (`llama-cpp-python`), pesquisa RAG em tempo real na Wikipedia e na Web e esta interface em tons de verde pastel!';
        } else {
            try {
                const wiki = await buscarWikipediaPT(pergunta);
                if (wiki && wiki.extrato) {
                    sources.style.display = 'flex';
                    const a = document.createElement('a');
                    a.className = 'source-badge';
                    a.href = wiki.url;
                    a.target = '_blank';
                    a.innerText = 'Wikipedia (PT): ' + wiki.titulo;
                    sources.appendChild(a);
                    respostaTexto = `Com base na **Wikipedia (${wiki.titulo})**:\n\n${wiki.extrato}\n\n*(Na versão local completa em Python + GGUF 4-Bit no repositório GitHub, o modelo Qwen 2.5 analisa este contexto junto com buscas da Web para redigir explicações profundas e personalizadas!)*`;
                } else {
                    respostaTexto = 'Na demonstração web do portfólio eu consulto a API da Wikipedia em tempo real. Para rodar o cérebro completo **Qwen 2.5 (GGUF 4-Bit)** localmente na sua CPU, acesse o repositório oficial em **github.com/Ninjinha64/Mila_AI**!';
                }
            } catch (e) {
                respostaTexto = 'Não foi possível conectar à API da Wikipedia neste momento, mas você pode conferir o projeto completo com motor GGUF 4-Bit no GitHub: **github.com/Ninjinha64/Mila_AI**!';
            }
        }

        stepper.style.display = 'none';
        const palavras = respostaTexto.split(' ');
        let acum = '';
        for (let i = 0; i < palavras.length; i++) {
            acum += (i === 0 ? '' : ' ') + palavras[i];
            conteudo.innerHTML = acum
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/`(.*?)`/g, '<code>$1</code>')
                .replace(/\n\n/g, '</p><p>');
            chatScroll.scrollTop = chatScroll.scrollHeight;
            await new Promise((r) => setTimeout(r, 18));
        }

        meta.style.display = 'flex';
        meta.innerHTML = '<span>⚡ Demo Web RAG • Portfólio Artur Lima</span>';
        gerando = false;
    }
})();
