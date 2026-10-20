# Gabarito

App de estudo médico (PWA): questões comentadas no padrão UFPR e USMLE, PT/EN, simulados, revisão espaçada e flashcards. Progresso sincronizado via Supabase.

- `index.html`: o app inteiro (HTML/CSS/JS, sem build)
- `config.js`: URL e chave pública do Supabase + e-mail do administrador
- `sw.js`: service worker (funciona offline)
- `setup.sql`: tabelas e regras de acesso do Supabase

O conteúdo (questões) **não** fica neste repositório: é importado no app (Banco → Importar JSON) e guardado no Supabase, acessível só com login.
