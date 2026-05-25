# Web Audio Recorder

🔗 **Demonstração Online**: [https://rafaelsbitencourt.github.io/web-audio-recorder/](https://rafaelsbitencourt.github.io/web-audio-recorder/)

![ação de uso do Web Audio Recorder](.github/media/demo.gif)

O **Web Audio Recorder** é uma aplicação web de alta performance voltada para a gravação, processamento client-side e armazenamento seguro de áudios diretamente no navegador.

O sistema resolve o problema histórico de compatibilidade de formatos de mídia entre diferentes navegadores realizando a conversão do áudio nativo (geralmente `.webm` ou `.mp4`) para o formato universal `.mp3` no lado do cliente (Edge Computing via WebAssembly) antes de realizar o upload para a nuvem.

---

## 🚀 Tecnologias Utilizadas

- **Front-end**: [React](https://react.dev/) v19 (via [Vite](https://vite.dev/)) com [TypeScript](https://www.typescriptlang.org/)
- **Estilização**: CSS Puro com Variáveis Semânticas organizadas sob a regra de distribuição **60-30-10** (Suporte/Estrutura/Ação)
- **Processamento de Mídia**: [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) e [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- **Wasm Transcoding**: [FFmpeg.wasm](https://ffmpegwasm.netlify.app/) (rodando de forma isolada em um **Web Worker** dedicado)
- **Back-end as a Service (BaaS)**: [Supabase](https://supabase.com/) (Autenticação, Banco de Dados PostgreSQL e Storage Bucket privado)
- **Validação de Dados**: [Zod](https://zod.dev/) (validação rigorosa de metadados no cliente antes da inserção)

---

## 📐 Fluxo de Dados e Arquitetura

O processamento pesado ocorre totalmente no hardware do usuário para economizar largura de banda e recursos de nuvem:

```
[ Microfone ]
      │ (Captura de Stream)
      ▼
[ MediaRecorder API ]
      │ (Gera Blob bruto: .webm/.mp4)
      ▼
[ Web Worker (Fio Isolado) ] ──(FFmpeg.wasm executa em background)
      │
      ▼ (Retorna Blob convertido em .mp3)
[ Thread Principal React ]
      │
      ├─► [ Validação Zod ] (Garante consistência do payload)
      │
      ├─► [ Supabase Storage ] (Upload direto do arquivo .mp3 no bucket privado)
      │
      └─► [ Supabase Database ] (Gravação dos metadados da faixa: tamanho, duração, path)
```

---

## 💾 Estrutura de Banco de Dados e Segurança

### Tabela: `audio_metadata`

| Coluna         | Tipo        | Restrição     | Descrição                                           |
| :------------- | :---------- | :------------ | :-------------------------------------------------- |
| `id`           | `UUID`      | Primary Key   | Identificador único do registro (gen_random_uuid()) |
| `user_id`      | `UUID`      | Foreign Key   | Relacionamento com `auth.users` do Supabase         |
| `bucket_path`  | `TEXT`      | Not Null      | Caminho interno do arquivo dentro do Storage        |
| `size_bytes`   | `INTEGER`   | Not Null      | Tamanho do arquivo convertido para exibição na UI   |
| `duration_sec` | `INTEGER`   | Not Null      | Duração total do áudio em segundos                  |
| `created_at`   | `TIMESTAMP` | Default now() | Data e hora em que a gravação ocorreu               |

### Políticas de Segurança (Row Level Security - RLS)

- **Storage (Bucket `audio-records`)**:
  - `INSERT`: Permitido apenas para usuários autenticados fazendo upload para seu próprio diretório (`audio-records/{auth.uid()}/...`).
  - `SELECT`: Permitido gerar Signed URL (URL assinada temporária com expiração de 60s) apenas se o requisitante autenticado for o proprietário da pasta.
  - `DELETE`: Permitido excluir apenas se o requisitante for o proprietário.
- **Database (Tabela `audio_metadata`)**:
  - `INSERT`: Permitido apenas se `auth.uid() = user_id`.
  - `SELECT`: Permitido visualizar dados apenas se `auth.uid() = user_id`.
  - `DELETE`: Permitido excluir dados apenas se `auth.uid() = user_id`.

---

## 🛠️ Configuração e Instalação

### 1. Clonar o projeto e instalar dependências

Na pasta do projeto, execute:

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` ou `.env.local` na raiz do projeto baseado no arquivo `.env.example`:

```env
VITE_SUPABASE_URL=https://sua-url-do-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=seu-token-publico-anon-key
```

> 💡 **Fallback Local (Mock Mode)**:
> Se as chaves do Supabase forem deixadas vazias ou inválidas, o sistema iniciará automaticamente no **Modo Offline**. Os dados serão persistidos no navegador do usuário utilizando **IndexedDB** para os arquivos de áudio (Blob) e **localStorage** para a tabela de metadados, permitindo testes completos e instantâneos sem nenhuma configuração prévia!

### 3. Criar a Estrutura no Supabase

Copie o conteúdo do arquivo [supabase_schema.sql](file:///c:/Projetos/web-audio-recorder/supabase_schema.sql) e execute-o na aba **SQL Editor** do painel do Supabase para criar a tabela, o bucket privado e as políticas RLS automaticamente.

---

## 🏃 Como Executar

### Desenvolvimento

Inicie o servidor de desenvolvimento local:

```bash
npm run dev
```

### Produção

Gere a build de produção otimizada:

```bash
npm run build
```

Para testar a build localmente:

```bash
npm run preview
```

---

## 🔒 Segurança de Arquivos e Download

O sistema garante proteção absoluta sobre os arquivos gravados:

1. Os áudios são guardados em um bucket **privado**, impedindo o acesso via links públicos diretos.
2. Quando o usuário clica em tocar ou baixar na lista de histórico, o cliente solicita uma **Signed URL (URL assinada)** sob demanda à API do Supabase Storage.
3. Esta URL possui uma validade de apenas **60 segundos**, invalidando o acesso após esse período.
